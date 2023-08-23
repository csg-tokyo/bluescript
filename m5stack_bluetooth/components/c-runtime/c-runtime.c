// Copyright (C) 2022- Shigeru Chiba.  All rights reserved.

/*
  To run on a 64bit machine (for testing/debugging purpose only),
  compile with -DBIT64.  To include test code, compile with -DTEST.
  So,
    cc -DTEST -DBIT64 gc.c
  will produce ./a.out that runs test code on a 64bit machine.

  Typical usecase:

  After calling gc_initialize() once at the beginning,
  a user function will be like this:

  value_t make_pair(value_t a, value_t b) {
    value_t obj;
    ROOT_SET(root_set, 3);    // declare root_set with 5 elements.
    root_set.values[0] = a;
    root_set.values[1] = b;

    root_set.values[2] = obj = gc_new_vector(2);
    gc_vector_set(obj, int_to_value(0), a);
    gc_vector_set(obj, int_to_value(1), b);

    DELETE_ROOT_SET(root_set);
    return obj;
  }
*/

#include <stdio.h>
#include <stdarg.h>
#include <setjmp.h>
#include <string.h>
#include "c-runtime.h"

#ifdef BIT64

#include <stdlib.h>

#define MASK32      0xffffffff
#define MASK64H     0xffffffff00000000

#define PTR_TABLE_SIZE     1000
static void* pointer_table[PTR_TABLE_SIZE];
static int pointer_table_num = 0;

static void initialize_pointer_table() {
    for (int i = 0; i < PTR_TABLE_SIZE; i++)
        pointer_table[i] = 0;
}

// pointers to literals only. not to heap values.
static void* record_64bit_pointer(void* ptr) {
    int index0 = ((uint64_t)ptr >> 3) % PTR_TABLE_SIZE;
    int index = index0;
    do {
        if (pointer_table[index] == 0) {
            pointer_table[index] = ptr;
            return &pointer_table[index];
        }
        else if (pointer_table[index] == ptr)
            return &pointer_table[index];

        index = (index + 23) % PTR_TABLE_SIZE;
    } while (index != index0);
    fputs("** too many 64bit pointers\n", stderr);
    exit(1);
}

static void* ptr32_to_ptr64(void* ptr32) {
    return *(void**)((uint64_t)pointer_table & MASK64H | (uint64_t)ptr32 & MASK32);
}

#endif /* BIT64 */

#define HEAP_SIZE       (1024 * 8 + 2) // words (even number)

static value_t heap_memory[HEAP_SIZE];

#ifdef BIT64
pointer_t gc_heap_pointer(pointer_t ptr) {
    return (pointer_t)((uint64_t)heap_memory & MASK64H | (uint64_t)ptr & MASK32);
}
#endif

// runtime error handling

static jmp_buf long_jump_buffer;
static char error_message[256];

// This returns 1 when an error is signaled.
// Otherwise, 0.
int32_t try_and_catch(void (*main_function)()) {
    error_message[0] = '\0';
    if (setjmp(long_jump_buffer) != 0) {
        fputs(error_message, stderr);
        return 1;
    }
    else {
        main_function();
        return 0;
    }
}

// arithmetic operators for any-type values

static value_t runtime_type_error(const char* msg) {
    const char fmt[] = "** runtime type error: %s\n";
    if (strlen(msg) + sizeof(fmt) / sizeof(fmt[0]) >= sizeof(error_message) / sizeof(error_message[0]))
        msg = "??";

    sprintf(error_message, fmt, msg);
    longjmp(long_jump_buffer, -1);
    return 0;
}

static void runtime_index_error(int32_t idx, int32_t len, char* name) {
    const char fmt[] = "** error: array index out of range: %d (len: %d) in %s\n";
    if (strlen(name) + sizeof(fmt) / sizeof(fmt[0]) + 22 >= sizeof(error_message) / sizeof(error_message[0]))
        name = "??";

    sprintf(error_message, fmt, idx, len, name);
    longjmp(long_jump_buffer, -1);
}

int32_t safe_value_to_int(value_t v) {
    if (!is_int_value(v))
        runtime_type_error("value_to_int");

    return value_to_int(v);
}

float safe_value_to_float(value_t v) {
    if (is_float_value(v))
        return value_to_float(v);
    else if (!is_int_value(v))
        runtime_type_error("value_to_float");

    return (float)value_to_int(v);
}

bool value_to_truefalse(value_t v) {
    return v != VALUE_NULL && v != VALUE_UNDEF && v != VALUE_FALSE && v != VALUE_ZERO && v != VALUE_FZERO;
}

value_t safe_value_to_null(value_t v) {
    if (v != VALUE_NULL)
        runtime_type_error("value_to_null");

    return v;
}

value_t safe_value_to_string(value_t v) {
    if (!gc_is_string_literal(v))
        runtime_type_error("value_to_string");

    return v;
}

value_t safe_value_to_object(value_t v) {
    // note: String is not a subtype of Object
    if (!is_ptr_value(v) || gc_is_string_literal(v))
        runtime_type_error("value_to_object");

    return v;
}

value_t safe_value_to_value(const class_object* const clazz, value_t v) {
    const class_object* type = gc_get_class_of(v);
    while (type != clazz && type != NULL)
        type = type->superclass;

    if (type == NULL)
        runtime_type_error(clazz->name);

    return v;
}

#define ANY_OP_FUNC(name, op) \
value_t any_##name(value_t a, value_t b) {\
    if (is_int_value(a)) {\
        if (is_int_value(b))\
            return int_to_value(value_to_int(a) op value_to_int(b));\
        else if (is_float_value(b))\
            return float_to_value(value_to_int(a) op value_to_float(b));\
    }\
    else if (is_float_value(a)) {\
        if (is_int_value(b))\
            return float_to_value(value_to_float(a) op value_to_int(b));\
        else if (is_float_value(b))\
            return float_to_value(value_to_float(a) op value_to_float(b));\
    }\
    return runtime_type_error("bad operand for " #op);\
}

ANY_OP_FUNC(add,+)
ANY_OP_FUNC(subtract,-)
ANY_OP_FUNC(multiply,*)
ANY_OP_FUNC(divide,/)

#define ANY_CMP_FUNC(name, op) \
bool any_##name(value_t a, value_t b) {\
    if (is_int_value(a)) {\
        if (is_int_value(b))\
            return value_to_int(a) op value_to_int(b);\
        else if (is_float_value(b))\
            return value_to_int(a) op value_to_float(b);\
    }\
    else if (is_float_value(a)) {\
        if (is_int_value(b))\
            return value_to_float(a) op value_to_int(b);\
        else if (is_float_value(b))\
            return value_to_float(a) op value_to_float(b);\
    }\
    return runtime_type_error("bad operand for " #op);\
}

ANY_CMP_FUNC(less,<)
ANY_CMP_FUNC(less_eq,<=)
ANY_CMP_FUNC(greater,>)
ANY_CMP_FUNC(greater_eq,>=)

#define ANY_ASSIGN_OP_FUNC(name, op) \
value_t any_##name##_assign(value_t* a, value_t b) {\
    if (is_int_value(*a)) {\
        if (is_int_value(b))\
            return *a = int_to_value(value_to_int(*a) op value_to_int(b));\
        else if (is_float_value(b))\
            return *a = float_to_value(value_to_int(*a) op value_to_float(b));\
    }\
    else if (is_float_value(*a)) {\
        if (is_int_value(b))\
            return *a = float_to_value(value_to_float(*a) op value_to_int(b));\
        else if (is_float_value(b))\
            return *a = float_to_value(value_to_float(*a) op value_to_float(b));\
    }\
    return runtime_type_error("bad operand for " #op);\
}

ANY_ASSIGN_OP_FUNC(add,+)
ANY_ASSIGN_OP_FUNC(subtract,-)
ANY_ASSIGN_OP_FUNC(multiply,*)
ANY_ASSIGN_OP_FUNC(divide,/)

#define ANY_UPDATE(name, op, code) \
value_t any_##name(value_t* expr) {\
    value_t v;\
    if (is_int_value(*expr))\
        v = int_to_value(value_to_int(*expr) op 1);\
    else if (is_float_value(*expr))\
        v = float_to_value(value_to_float(*expr) op 1);\
    else\
        return runtime_type_error("bad operand for " #op #op);\
    code }

ANY_UPDATE(increment,+,{return *expr=v;})
ANY_UPDATE(decrement,-,{return *expr=v;})
ANY_UPDATE(post_increment,+,{value_t nv = *expr; *expr=v; return nv;})
ANY_UPDATE(post_decrement,-,{value_t nv = *expr; *expr=v; return nv;})

value_t minus_any_value(value_t v) {
    if (is_int_value(v))
        return int_to_value(-value_to_int(v));
    else if (is_float_value(v))
        return float_to_value(-value_to_float(v));
    else
        return runtime_type_error("bad operand for unary minus");\
}

// heap objects

void gc_initialize() {
    heap_memory[0] = 2;  // points to the first word of linked free blocks.
    heap_memory[1] = 2;  // the size of the reserved space (first two words).
    heap_memory[2] = HEAP_SIZE;
    heap_memory[3] = HEAP_SIZE - 2;
#ifdef BIT64
    initialize_pointer_table();
#endif
}

static inline int object_size(pointer_t obj, class_object* clazz) {
    int32_t size = clazz->size;
    if (size >= 0)
        return size;
    else
        return value_to_int(obj->body[0]) + 1;
}

static bool class_has_no_pointer(class_object* obj) {
    return obj->is_raw_data;
}

// current default value (reprenting not marked) of mark bits.
static uint32_t current_no_mark = 0;

static void set_object_header(pointer_t obj, const class_object* clazz) {
#ifdef BIT64
    uint64_t clazz2 = (uint64_t)record_64bit_pointer((void*)(uintptr_t)clazz);
    obj->header = (((uint32_t)clazz2) & ~3) | current_no_mark;
#else
    obj->header = (((uint32_t)clazz) & ~3) | current_no_mark;
#endif
}

// Gets a pointer to the given object's class.
static class_object* get_objects_class(pointer_t obj) {
#ifdef BIT64
    class_object* clazz = (class_object*)(uint64_t)(obj->header & ~3);
    return ptr32_to_ptr64(clazz);
#else
    class_object* clazz = (class_object*)(obj->header & ~3);
    return clazz;
#endif
}

// Gets the class of the given value if it is an object.
// Otherwise, this returns NULL.
class_object* gc_get_class_of(value_t value) {
    if (is_ptr_value(value) && value != VALUE_NULL) {
        pointer_t obj = value_to_ptr(value);
        return get_objects_class(obj);
    }
    else
        return NULL;
}

static CLASS_OBJECT(object_class, 1) = {
    .clazz = { .size = 0, .is_raw_data = false, .name = "Object", .superclass = NULL }};

static pointer_t allocate_heap(uint16_t word_size);

pointer_t gc_allocate_object(const class_object* clazz) {
    int32_t size = clazz->size;
    if (size < 0)
        size = 0;

    pointer_t obj = allocate_heap(size);
    set_object_header(obj, clazz);
    for (int i = 0; i < size; i++)
        obj->body[i] = VALUE_UNDEF;

    return obj;
}

// string_literal is a class for objects that contain a pointer to a C string.
// This C string is not allocated in the heap memory managed by the garbage collector.

static CLASS_OBJECT(string_literal, 0) = { .clazz.size = 1, .clazz.is_raw_data = true,
                                           .clazz.name = "string", .clazz.superclass = NULL };

// str: a char array in the C language.
value_t gc_new_string(char* str) {
#ifdef BIT64
    str = (char*)record_64bit_pointer(str);
#endif
    pointer_t obj = gc_allocate_object(&string_literal.clazz);
    obj->body[0] = ptr_to_value((pointer_t)str);
    return ptr_to_value(obj);
}

// true if this is a string literal object.
bool gc_is_string_literal(value_t obj) {
    return gc_get_class_of(obj) == &string_literal.clazz;
}

// returns a pointer to a char array in the C language.
char* gc_string_literal_cstr(value_t obj) {
    pointer_t str = value_to_ptr(obj);
    pointer_t cstr = value_to_ptr(str->body[0]);
#ifdef BIT64
    return (char*)ptr32_to_ptr64(cstr);
#else
    return (char*)cstr;
#endif
}

// An int32_t array

static CLASS_OBJECT(intarray_object, 1) = {
    .clazz = { .size = -1, .is_raw_data = true, .name = "Array<integer>", .superclass = &object_class.clazz }};

value_t safe_value_to_intarray(value_t v) {
    return safe_value_to_value(&intarray_object.clazz, v);
}

static pointer_t gc_new_intarray_base(int32_t n) {
    if (n < 0)
        n = 0;

    pointer_t obj = allocate_heap(n + 1);
    set_object_header(obj, &intarray_object.clazz);
    obj->body[0] = n;
    return obj;
}

/*
  An int32_t array.  It cannot contain a pointer.
  n: the number of elements. n >= 0.

  1st word is the number of elements.
  2nd, 3rd, ... words hold elements.
*/
value_t gc_new_intarray(int32_t n, int32_t init_value) {
    pointer_t obj = gc_new_intarray_base(n);
    for (int32_t i = 1; i <= n; i++)
        obj->body[i] = init_value;

    return ptr_to_value(obj);
}

value_t gc_make_intarray(int32_t n, ...) {
    va_list args;
    pointer_t arrayp = gc_new_intarray_base(n);
    va_start(args, n);

    for (int32_t i = 1; i <= n; i++)
        arrayp->body[i] = va_arg(args, int32_t);

    va_end(args);
    return ptr_to_value(arrayp);
}

int32_t gc_intarray_length(value_t obj) {
    pointer_t objp = value_to_ptr(obj);
    return objp->body[0];
}

int32_t* gc_intarray_get(value_t obj, int32_t index) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = objp->body[0];
    if (0 <= index && index < len) {
        return (int32_t*)&objp->body[index + 1];
    }
    else {
        runtime_index_error(index, len, "Array<integer>.get");
        return 0;
    }
}

int32_t gc_intarray_set(value_t obj, int32_t index, int32_t new_value) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = objp->body[0];
    if (0 <= index && index < len) {
        objp->body[index + 1] = new_value;
        return new_value;
    }
    else {
        runtime_index_error(index, len, "Array<integer>.get");
        return 0;
    }
}

// A byte array

static CLASS_OBJECT(bytearray_object, 1) = {
    .clazz = { .size = -1, .is_raw_data = true, .name = "ByteArray", .superclass = &object_class.clazz }};

/*
  A byte (or unsigned 8 bit) array.  It cannot contain a pointer.
  n: the size of the array in bytes.
  the actual size will be a multiple of 4.

  Initially, the elements of this array hold random values.
  1st word is the number of elements.
  2nd, 3rd, ... words hold elements.
*/
value_t gc_new_bytearray(int32_t n) {
    if (n < 0)
        n = 0;
    else
        n = (n + 3) / 4;

    pointer_t obj = allocate_heap(n + 1);
    set_object_header(obj, &bytearray_object.clazz);
    obj->body[0] = int_to_value(n);
    return ptr_to_value(obj);
}

// the size of the array in bytes.
value_t gc_bytearray_size(value_t obj) {
    pointer_t objp = value_to_ptr(obj);
    return int_to_value(value_to_int(objp->body[0]) * 4);
}

// Obtains an unsigned 8bit value of the byte element at index.
// When index is 2, the 2nd element of an 8bit array is returned.
value_t gc_bytearray_get(value_t obj, value_t index) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = value_to_int(objp->body[0]) * 4;
    int32_t idx = value_to_int(index);
    if (0 <= idx && idx < len) {
        int32_t v = ((uint8_t*)objp->body)[idx + 4];
        return int_to_value(v);
    }
    else {
        runtime_index_error(idx, len, "bytearray.get");
        return VALUE_UNDEF;
    }
}

// Stores an unsigned 8bit value specified by new_value into the
// array element at index.
value_t gc_bytearray_set(value_t obj, value_t index, value_t new_value) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = value_to_int(objp->body[0]) * 4;
    int32_t idx = value_to_int(index);
    if (0 <= idx && idx < len) {
        ((uint8_t*)objp->body)[idx + 4] = (uint8_t)value_to_int(new_value);
        return new_value;
    }
    else {
        runtime_index_error(idx, len, "bytearray.get");
        return VALUE_UNDEF;
    }
}

// Stores a given raw unsigned 32bit value into an array.
// Note that index is a raw 32bit integer value and it specifies the position
// by assuming that each array element is 32bit long.
// This function returns a pointer to the array element where the value is stored.
value_t* gc_bytearray_set_raw_word(value_t obj, int32_t index, uint32_t new_value) {
    pointer_t objp = value_to_ptr(obj);
    objp->body[index + 1] = new_value;
    return &objp->body[index + 1];
}

// A fixed-length array

static CLASS_OBJECT(vector_object, 1) = {
    .clazz = { .size = -1, .is_raw_data = false, .name = "Vector", .superclass = &object_class.clazz }};

/*
  A fixed-length array.
  n: the number of vector elements.
     1st word is the number of elements.
     2nd, 3rd, ... words hold elements.
*/
value_t gc_new_vector(int32_t n) {
    if (n < 0)
        n = 0;

    pointer_t obj = allocate_heap(n + 1);
    set_object_header(obj, &vector_object.clazz);
    obj->body[0] = int_to_value(n);
    for (int i = 0; i < n; i++)
        obj->body[i + 1] = VALUE_UNDEF;

    return ptr_to_value(obj);
}

value_t gc_vector_size(value_t obj) {
    pointer_t objp = value_to_ptr(obj);
    return objp->body[0];
}

value_t gc_vector_get(value_t obj, value_t index) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = value_to_int(objp->body[0]);
    int32_t idx = value_to_int(index);
    if (0 <= idx && idx < len)
        return objp->body[idx + 1];
    else {
        runtime_index_error(idx, len, "vector.get");
        return VALUE_UNDEF;
    }
}

inline static value_t* fast_vector_get(value_t obj, int32_t index) {
    pointer_t objp = value_to_ptr(obj);
    return &objp->body[index + 1];
}

value_t gc_vector_set(value_t obj, value_t index, value_t new_value) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = value_to_int(objp->body[0]);
    int32_t idx = value_to_int(index);
    if (0 <= idx && idx < len) {
        objp->body[idx + 1] = new_value;
        return new_value;
    }
    else {
        runtime_index_error(index, len, "vector.set");
        return VALUE_UNDEF;
    }
}

inline static void fast_vector_set(value_t obj, uint32_t index, value_t new_value) {
    pointer_t objp = value_to_ptr(obj);
    objp->body[index + 1] = new_value;
}

// An any-type array

static CLASS_OBJECT(array_object, 1) = {
    .clazz = { .size = 2, .is_raw_data = false, .name = "Array", .superclass = &object_class.clazz }};

value_t safe_value_to_array(value_t v) {
    return safe_value_to_value(&array_object.clazz, v);
}

value_t gc_new_array(int32_t n) {
    pointer_t obj = gc_allocate_object(&array_object.clazz);
    value_t vec = gc_new_vector(n);
    obj->body[0] = vec;
    // the length must be less than or equal to the length of the vector.
    obj->body[1] = int_to_value(n);
    return ptr_to_value(obj);
}

value_t gc_make_array(int32_t n, ...) {
    va_list args;
    value_t array = gc_new_array(n);
    pointer_t arrayp = value_to_ptr(array);
    va_start(args, n);

    for (int32_t i = 0; i < n; i++)
        fast_vector_set(arrayp->body[0], i, va_arg(args, value_t));

    va_end(args);
    return array;
}

value_t gc_array_length(value_t obj) {
    pointer_t objp = value_to_ptr(obj);
    return objp->body[1];
}

value_t* gc_array_get(value_t obj, int32_t idx) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = value_to_int(objp->body[1]);
    if (0 <= idx && idx < len)
        return fast_vector_get(objp->body[0], idx);
    else {
        runtime_index_error(idx, len, "array.get");
        return VALUE_UNDEF;
    }
}

value_t gc_array_set(value_t obj, value_t index, value_t new_value) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = value_to_int(objp->body[1]);
    int32_t idx = value_to_int(index);
    if (0 <= idx && idx < len) {
        fast_vector_set(objp->body[0], idx, new_value);
        return new_value;
    }
    else {
        runtime_index_error(idx, len, "array.set");
        return VALUE_UNDEF;
    }
}

// Compute an object size.   It is always an even number.
//
// length: length of object_type.body[]
// returns the size including a header and a padding.
static uint16_t real_objsize(uint16_t length) {
    uint16_t size = length + 1;     // add the size of the header
    return (size + 1) & ~1;         // make it a even numbrer
}

static pointer_t no_more_memory() {
    puts("** memory exhausted **");
#ifdef BIT64
    exit(1);
#else
    return 0;
#endif
}

/*
  This finds an unused chunk of memory in linked free blocks.
  The first word of every free block is the index of the next free block.
  The second word is the size of its free block.
  These two words are values of normal uint32_t (not value_t).

  word_size: the length of object_type.body[], where object_type represents the class
  for an object which this function allocates memory for.

  The size of an allocated chunk is an even number.
*/
static pointer_t allocate_heap(uint16_t word_size) {
    word_size = real_objsize(word_size);
    value_t prev = 0;
    value_t current = heap_memory[0];
    while (current < HEAP_SIZE) {
        value_t* ptr = &heap_memory[current];
        value_t next = heap_memory[current];
        value_t sz = heap_memory[current + 1];
        if (sz > word_size) {
            value_t cur2 = current + word_size;
            heap_memory[prev] = cur2;
            heap_memory[cur2] = next;
            heap_memory[cur2 + 1] = sz - word_size;
            return (pointer_t)ptr;
        }
        else if (sz == word_size) {
            heap_memory[prev] = next;
            return (pointer_t)ptr;
        }

        prev = current;
        current = next;
    }

    return no_more_memory();
}

struct gc_root_set* gc_root_set_head = NULL;

#define GET_MARK_BIT(ptr)      (((ptr)->header & 1))
#define CLEAR_MARK_BIT(ptr)    ((ptr)->header &= ~1)
#define SET_MARK_BIT(ptr)      ((ptr)->header |= 1)
#define WRITE_MARK_BIT(ptr,mark)  (mark ? SET_MARK_BIT(ptr) : CLEAR_MARK_BIT(ptr))

#define STACK_SIZE      (HEAP_SIZE / 65)
static pointer_t gc_stack[STACK_SIZE];

static bool mark_an_object(uint32_t mark, uint32_t stack_top) {
    bool stack_overflowed = false;
    while (stack_top > 0) {
        pointer_t obj = gc_stack[--stack_top];
        class_object* clazz = get_objects_class(obj);
        if (!class_has_no_pointer(clazz)) {
            uint32_t size = object_size(obj, clazz);
            for (uint32_t j = 0; j < size; j++) {
                value_t next = obj->body[j];
                if (is_ptr_value(next) && next != VALUE_NULL) {
                    pointer_t nextp = value_to_ptr(next);
                    if (GET_MARK_BIT(nextp) != mark) {    // not visisted yet
                        WRITE_MARK_BIT(nextp, mark);
                        if (stack_top < STACK_SIZE)
                            gc_stack[stack_top++] = nextp;
                        else {
                            stack_overflowed = true;
                            break;
                        }
                    }
                }
            }
        }
    }

    return stack_overflowed;
}

// run this when a depth-first search fails due to stack overflow.
static bool scan_and_mark_objects(uint32_t mark) {
    bool found_untraced = false;
    uint32_t start = 2;
    uint32_t end = heap_memory[0];
    while (start < HEAP_SIZE) {
        // scan objects between start and end
        while (start < end) {
            pointer_t obj = (pointer_t)&heap_memory[start];
            class_object* clazz = get_objects_class(obj);
            uint32_t size = object_size(obj, clazz);
            if (GET_MARK_BIT(obj) == mark && !class_has_no_pointer(clazz)) {
                for (uint32_t j = 0; j < size; j++) {
                    value_t next = obj->body[j];
                    if (is_ptr_value(next) && next != VALUE_NULL) {
                        pointer_t nextp = value_to_ptr(next);
                        if (GET_MARK_BIT(nextp) != mark) {    // not visisted yet
                            WRITE_MARK_BIT(nextp, mark);
                            found_untraced = true;
                            gc_stack[0] = nextp;
                            uint32_t stack_top = 1;
                            mark_an_object(mark, stack_top);
                        }
                    }
                }
            }

            start += real_objsize(size);
        }

        if (end < HEAP_SIZE) {
            value_t next = heap_memory[end];
            value_t size = heap_memory[end + 1];
            start = end + size;
            end = next;
        }
        else
            break;
    }

    return found_untraced;
}

static void mark_objects(struct gc_root_set* root_set, uint32_t mark) {
    bool stack_overflowed = false;
    while (root_set != NULL) {
        for (int i = 0; i < root_set->length; i++) {
            value_t v = root_set->values[i];
            if (is_ptr_value(v) && v != VALUE_NULL) {
                pointer_t rootp = value_to_ptr(v);
                if (GET_MARK_BIT(rootp) != mark) {    // not visisted yet
                    WRITE_MARK_BIT(rootp, mark);
                    gc_stack[0] = rootp;
                    uint32_t stack_top = 1;
                    stack_overflowed |= mark_an_object(mark, stack_top);
                }
            }
        }

        root_set = root_set->next;
    }

    if (stack_overflowed)
        while (scan_and_mark_objects(mark))
            ;
}

static void sweep_objects(uint32_t mark) {
    /*
       heap memory
             -------------------------------------------------------
       value   |j|s| free... |                |k|?| free... |
             -------------------------------------------------------
       index    i                      ^       j
               prev                  start    end

        i + s <= start < end == j
    */
    bool previous_word_is_free = false;
    value_t prev = 0;
    uint32_t start = 2;
    uint32_t end = heap_memory[0];
    while (start < HEAP_SIZE) {
        // scan objects between start and end
        while (start < end) {
            pointer_t obj = (pointer_t)&heap_memory[start];
            class_object* clazz = get_objects_class(obj);
            uint32_t size = real_objsize(object_size(obj, clazz));
            if (GET_MARK_BIT(obj) == mark)
                previous_word_is_free = false;
            else
                if (previous_word_is_free)
                    heap_memory[prev + 1] += size;
                else {
                    heap_memory[prev] = start;
                    prev = start;
                    heap_memory[start] = end;
                    heap_memory[start + 1] = size;
                    previous_word_is_free = true;
                }

            start += size;
        }

        if (end < HEAP_SIZE) {
            value_t next = heap_memory[end];
            value_t size = heap_memory[end + 1];
            if (previous_word_is_free) {
                heap_memory[prev] = next;
                heap_memory[prev + 1] += size;
            }
            else {
                prev = end;
                previous_word_is_free = true;
            }

            start = end + size;
            end = next;
        }
        else
            break;
    }
}

void gc_run() {
    uint32_t mark = current_no_mark ? 0 : 1;
    mark_objects(gc_root_set_head, mark);
    sweep_objects(mark);
    current_no_mark = mark;
}

void gc_init_rootset(struct gc_root_set* set, uint32_t length) {
    set->next = gc_root_set_head;
    if (length > 0) {
        gc_root_set_head = set;
        set->length = length;
        for (uint32_t i = 0; i < length; i++)
            set->values[i] = VALUE_UNDEF;
    }
}

extern int32_t value_to_int(value_t v);
extern value_t int_to_value(int32_t v);
extern bool is_int_value(value_t v);

extern float value_to_float(value_t v);
extern value_t float_to_value(float v);
extern bool is_float_value(value_t v);

extern pointer_t value_to_ptr(value_t v);
extern value_t ptr_to_value(pointer_t v);
extern bool is_ptr_value(value_t v);

extern value_t bool_to_value(bool b);
extern bool value_to_bool(value_t v);
extern bool safe_value_to_bool(value_t v);

extern value_t get_obj_property(value_t obj, int index);
extern void set_obj_property(value_t obj, int index, value_t new_value);