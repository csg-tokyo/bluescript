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
#include "gc.h"

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
    if (is_ptr_value(value)) {
        pointer_t obj = value_to_ptr(value);
        return get_objects_class(obj);
    }
    else
        return NULL;
}

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

static CLASS_OBJECT(string_literal, 0) = { .clazz.size = 1, .clazz.is_raw_data = true };

// str: a char array in the C language.
value_t gc_new_string(char* str) {
#ifdef BIT64
    str = (char*)record_64bit_pointer(str);
#endif
    pointer_t obj = gc_allocate_object(&string_literal.clazz);
    obj->body[0] = ptr_to_value((pointer_t)str);
    return ptr_to_value(obj);
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

static CLASS_OBJECT(bytearray_object, 1) = { .clazz = { .size = -1, .is_raw_data = true }};

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
        printf("** error: bytearray.get out of range: %d (len: %d)\n", idx, len);
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
        printf("** error: bytearray.get out of range: %d (len: %d)\n", idx, len);
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

static CLASS_OBJECT(vector_object, 1) = { .clazz = { .size = -1, .is_raw_data = false }};

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
        printf("** error: vector.get out of range: %d (len: %d)\n", idx, len);
        return VALUE_UNDEF;
    }
}

inline static value_t fast_vector_get(value_t obj, int32_t index) {
    pointer_t objp = value_to_ptr(obj);
    return objp->body[index + 1];
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
        printf("** error: vector.set out of range: %d (len: %d)\n", index, len);
        return VALUE_UNDEF;
    }
}

inline static void fast_vector_set(value_t obj, uint32_t index, value_t new_value) {
    pointer_t objp = value_to_ptr(obj);
    objp->body[index + 1] = new_value;
}

static CLASS_OBJECT(array_object, 1) = { .clazz = { .size = 2, .is_raw_data = false }};

/*
  An array.
*/
value_t gc_new_array(int32_t n) {
    pointer_t obj = gc_allocate_object(&array_object.clazz);
    value_t vec = gc_new_vector(n);
    obj->body[0] = vec;
    // the length must be less than or equal to the length of the vector.
    obj->body[1] = int_to_value(n);
    return ptr_to_value(obj);
}

value_t gc_array_length(value_t obj) {
    pointer_t objp = value_to_ptr(obj);
    return objp->body[1];
}

value_t gc_array_get(value_t obj, value_t index) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = value_to_int(objp->body[1]);
    int32_t idx = value_to_int(index);
    if (0 <= idx && idx < len)
        return fast_vector_get(objp->body[0], idx);
    else {
        printf("** error: array.get out of range: %d (len: %d)\n", idx, len);
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
        printf("** error: array.set out of range: %d (len: %d)\n", idx, len);
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

extern value_t get_obj_property(value_t obj, int index);
extern void set_obj_property(value_t obj, int index, value_t new_value);


// Test code

#ifdef TEST

#include <string.h>

#define Assert_true(v)     assert_true(v, __LINE__)

static void assert_true(bool value, int line) {
    if (!value)
        printf("*** ERROR line %d\n", line);
}

#define Assert_equals(a, b)     assert_equals(a, b, __LINE__)

static void assert_equals(int a, int b, int line) {
    if (a != b)
        printf("*** ERROR line %d: %d, %d\n", line, a, b);
}

#define Assert_fequals(a, b)     assert_fequals(a, b, __LINE__)

static void assert_fequals(float a, float b, int line) {
    if (a != b) {
        printf("*** ERROR line %d: %f (%x), %f (%x)\n",
        line, a, *(uint32_t*)&a, b, *(uint32_t*)&b);
    }
}

#define Assert_fequals2(a, b)     assert_fequals2(a, b, __LINE__)

static void assert_fequals2(float a, float b, int line) {
    if (a < b) {
        float f = b;
        b = a;
        a = f;
    }

    if (a - b > (a > 0 ? a : -a) / 10000.0) {
        printf("*** ERROR line %d: %f (%x), %f (%x)\n",
        line, a, *(uint32_t*)&a, b, *(uint32_t*)&b);
    }
}

#define Assert_pequals(a, b)     assert_pequals(a, b, __LINE__)

static void assert_pequals(const void* a, const void* b, int line) {
    if (a != b)
        printf("*** ERROR line %d: %p, %p\n", line, a, b);
}

#define Assert_str_equals(a, b)     assert_str_equals(a, b, __LINE__)

static void assert_str_equals(const char* a, const char* b, int line) {
    if (strcmp(a, b) != 0)
        printf("*** ERROR line %d: %p, %p\n", line, a, b);
}

#ifdef BIT64

void test_pointer_table() {
    initialize_pointer_table();

    struct { void* ptr; uint32_t ptr32; } table[PTR_TABLE_SIZE];

    for (int i = 0; i < PTR_TABLE_SIZE; i++) {
        void* ptr = malloc(1001);
        uint32_t ptr32 = (uint64_t)record_64bit_pointer(ptr);
        table[i].ptr = ptr;
        table[i].ptr32 = ptr32;
    }

    for (int i = 0; i < PTR_TABLE_SIZE; i++) {
        Assert_pequals(ptr32_to_ptr64((void*)(uint64_t)table[i].ptr32), table[i].ptr);
        free(table[i].ptr);
    }
}

#endif /* BIT64 */

bool is_live_object(value_t obj) {
    value_t address = (value_t)((value_t*)value_to_ptr(obj) - heap_memory);
    value_t current = heap_memory[0];
    while (current < HEAP_SIZE) {
        value_t next = heap_memory[current];
        value_t sz = heap_memory[current + 1];
        if (current <= address && address < current + sz)
            return false;

        current = next;
    }

    return true;
}

void test_converters() {
    value_t v = int_to_value(8);
    Assert_equals(v, 32);
    Assert_equals(value_to_int(v), 8);
    Assert_true(is_int_value(v));
    Assert_true(!is_float_value(v));
    Assert_true(!is_ptr_value(v));

    v = int_to_value(-9);
    Assert_equals(v & 3, 0);
    Assert_equals(value_to_int(v), -9);
    Assert_true(is_int_value(v));
    Assert_true(!is_float_value(v));
    Assert_true(!is_ptr_value(v));

    v = float_to_value(0.1);
    Assert_equals(v & 3, 1);
    // Assert_fequals(value_to_float(v), 0.1);
    Assert_fequals2(value_to_float(v), 0.1);
    Assert_true(!is_int_value(v));
    Assert_true(is_float_value(v));
    Assert_true(!is_ptr_value(v));

    v = float_to_value(-0.2);
    Assert_equals(v & 3, 1);
    // Assert_fequals(value_to_float(v), -0.2);
    Assert_fequals2(value_to_float(v), -0.2);
    Assert_true(!is_int_value(v));
    Assert_true(is_float_value(v));
    Assert_true(!is_ptr_value(v));

    Assert_equals(bool_to_value(true), VALUE_TRUE);
    Assert_equals(bool_to_value(false), VALUE_FALSE);
    Assert_true(value_to_bool(VALUE_TRUE));
    Assert_true(!value_to_bool(VALUE_FALSE));
}

void test_string() {
    char cstr[] = "test";
    value_t v = gc_new_string(cstr);
    Assert_equals(v & 3, 3);
    Assert_pequals(gc_get_class_of(v), &string_literal);
    Assert_equals((uintptr_t)value_to_ptr(v) & 3, 0);
    Assert_true(ptr_to_value(value_to_ptr(v)) == v);
    Assert_str_equals(gc_string_literal_cstr(v), cstr);

    Assert_true(!is_int_value(v));
    Assert_true(!is_float_value(v));
    Assert_true(is_ptr_value(v));
}

void test_bytearray() {
    value_t arr = gc_new_bytearray(3);
    value_t arr2 = gc_new_bytearray(7);
    for (int i = 0; i < 7; i++) {
        value_t v = int_to_value(257 - i);
        Assert_equals(gc_bytearray_set(arr2, int_to_value(i), v), v);
    }
    for (int i = 0; i < 3; i++)
        gc_bytearray_set(arr, i, int_to_value(i));
    for (int i = 0; i < 7; i++) {
        value_t e = gc_bytearray_get(arr2, int_to_value(i));
        Assert_equals(value_to_int(e), 257 - i > 255 ? 1 - i : 257 - i);
    }
    Assert_equals(value_to_int(gc_bytearray_size(arr)), 4);
    Assert_equals(value_to_int(gc_bytearray_size(arr2)), 8);
}

void test_vector() {
    value_t arr = gc_new_vector(4);
    value_t arr2 = gc_new_vector(4);
    for (int i = 0; i < 4; i++)
        Assert_equals(gc_vector_set(arr2, int_to_value(i), int_to_value(i)), int_to_value(i));
    for (int i = 0; i < 4; i++)
        gc_vector_set(arr, i, int_to_value(i));
    for (int i = 0; i < 4; i++) {
        value_t e = gc_vector_get(arr2, int_to_value(i));
        Assert_equals(value_to_int(e), i);
    }
    Assert_equals(value_to_int(gc_array_length(arr)), 4);
    Assert_equals(value_to_int(gc_array_length(arr2)), 4);
}

void test_array() {
    value_t arr = gc_new_array(4);
    value_t arr2 = gc_new_array(4);
    for (int i = 0; i < 4; i++)
        Assert_equals(gc_array_set(arr2, int_to_value(i), int_to_value(i)), int_to_value(i));
    for (int i = 0; i < 4; i++)
        gc_array_set(arr, int_to_value(i), int_to_value(i));
    for (int i = 0; i < 4; i++) {
        value_t e = gc_array_get(arr2, int_to_value(i));
        Assert_equals(value_to_int(e), i);
    }
    Assert_equals(value_to_int(gc_array_length(arr)), 4);
    Assert_equals(value_to_int(gc_array_length(arr2)), 4);
}

void test_allocate_heap() {
    gc_initialize();
    value_t heap_size = heap_memory[3];
    value_t index = 2;
    value_t vec_size = heap_size / 1024;
    for (int i = 0; i < 1024; i++) {
        value_t arr = gc_new_vector(vec_size - 2);
        Assert_pequals(value_to_ptr(arr), &heap_memory[index]);
        index += vec_size;
    }
    Assert_equals(heap_memory[0], heap_size + 2);
    gc_run();
    Assert_equals(heap_memory[0], 2);
    Assert_equals(heap_memory[2], heap_size + 2);
    Assert_equals(heap_memory[3], heap_size);
}

void test_root_set() {
    gc_initialize();
    value_t heap_size = heap_memory[2];

    ROOT_SET(root_set, 3);
    root_set.values[0] = gc_new_string("hello");
    value_t obj;
    for (int i = 0; i < 3; i++)
        obj = gc_new_vector(4);

    gc_run();
    Assert_equals(heap_memory[0], 4);
    Assert_equals(heap_memory[4], heap_size);
    Assert_equals(heap_memory[5], heap_size - 4);
    Assert_true(is_live_object(root_set.values[0]));
    Assert_true(!is_live_object(obj));

    DELETE_ROOT_SET(root_set);
}

void test_root_set2() {
    gc_initialize();
    value_t heap_size = heap_memory[2];

    ROOT_SET(root_set, 3);
    root_set.values[0] = gc_new_string("hello");
    root_set.values[1] = gc_new_string("hello2");
    for (int i = 0; i < 3; i++)
        gc_new_vector(3);

    root_set.values[0] = VALUE_NULL;
    gc_run();
    Assert_equals(heap_memory[0], 2);
    Assert_equals(heap_memory[2], 6);
    Assert_equals(heap_memory[3], 2);
    Assert_equals(heap_memory[6], heap_size);
    Assert_equals(heap_memory[7], heap_size - 6);

    DELETE_ROOT_SET(root_set);
}

void test_nested_root_set2() {
    ROOT_SET(root_set, 3);
    root_set.values[0] = gc_new_vector(1);
    DELETE_ROOT_SET(root_set);
}

void test_nested_root_set3() {
    ROOT_SET(root_set, 3);
    root_set.values[0] = gc_new_vector(1);
    gc_run();
    DELETE_ROOT_SET(root_set);
}

void test_nested_root_set() {
    gc_initialize();
    value_t heap_size = heap_memory[2];

    ROOT_SET(root_set, 3);
    root_set.values[0] = gc_new_string("hello");
    root_set.values[1] = gc_new_string("hello2");
    for (int i = 0; i < 3; i++)
        gc_new_vector(3);

    test_nested_root_set2();
    root_set.values[0] = VALUE_NULL;
    test_nested_root_set3();

    Assert_equals(heap_memory[0], 2);
    Assert_equals(heap_memory[2], 6);
    Assert_equals(heap_memory[3], 2);
    Assert_equals(heap_memory[6], 32);
    Assert_equals(heap_memory[7], 22);
    Assert_pequals(get_objects_class((pointer_t)&heap_memory[28]), &vector_object);
    Assert_equals(heap_memory[32], heap_size);
    Assert_equals(heap_memory[33], heap_size - 32);

    gc_run();
    Assert_equals(heap_memory[0], 2);
    Assert_equals(heap_memory[2], 6);
    Assert_equals(heap_memory[3], 2);
    Assert_equals(heap_memory[6], heap_size);
    Assert_equals(heap_memory[7], heap_size - 6);

    DELETE_ROOT_SET(root_set);
}

void test_gc_long_chain() {
    gc_initialize();
    value_t heap_size = heap_memory[2];
    ROOT_SET(root_set, 3);
    value_t obj = gc_new_array(2);
    for (int i = 0; i < STACK_SIZE * 3; ++i) {
        value_t obj2 = gc_new_array(2);
        value_t obj3 = gc_new_array(1);
        gc_array_set(obj2, int_to_value(1), obj);
        gc_array_set(obj2, int_to_value(0), obj3);
        obj = obj2;
    }
    root_set.values[0] = obj;
    gc_run();

    int n = 0;
    while (obj != VALUE_UNDEF) {
        value_t obj2 = gc_array_get(obj, int_to_value(1));
        Assert_true(is_live_object(obj2));
        obj = gc_array_get(obj, int_to_value(1));
        Assert_true(is_live_object(obj));
        n++;
    }
    Assert_equals(n, STACK_SIZE * 3 + 1);
    DELETE_ROOT_SET(root_set);
}

void test_gc_liveness() {
    gc_initialize();
    value_t heap_size = heap_memory[2];
    ROOT_SET(root_set, 3);

    value_t obj, obj2, obj3;
    root_set.values[0] = obj = gc_new_array(4);
    gc_new_array(1);
    gc_array_set(obj, int_to_value(0), obj2 = gc_new_bytearray(8));
    gc_bytearray_set(obj2, int_to_value(0), obj);
    gc_new_array(1);
    gc_new_array(1);
    gc_array_set(obj, int_to_value(1), obj3 = gc_new_array(2));
    gc_array_set(obj3, int_to_value(0), obj);
    root_set.values[1] = gc_new_string("test");

    gc_run();
    Assert_true(is_live_object(obj));
    Assert_true(is_live_object(obj2));
    Assert_true(is_live_object(obj3));
    Assert_true(is_live_object(root_set.values[1]));
    DELETE_ROOT_SET(root_set);
}

void test_gc_liveness2() {
    gc_initialize();
    value_t heap_size = heap_memory[2];
    ROOT_SET(root_set, 3);

    value_t obj, obj2, obj3, obj4;
    root_set.values[0] = obj = gc_new_vector(4);
    obj4 = gc_new_vector(1);
    gc_vector_set(obj, int_to_value(0), obj2 = gc_new_bytearray(8));
    gc_bytearray_set_raw_word(obj2, 0, obj4);
    gc_new_vector(1);
    gc_new_vector(1);
    gc_vector_set(obj, int_to_value(1), obj3 = gc_new_vector(2));
    gc_vector_set(obj3, int_to_value(0), obj);
    root_set.values[1] = gc_new_string("test");

    gc_run();
    Assert_true(is_live_object(obj));
    Assert_true(is_live_object(obj2));
    Assert_true(is_live_object(obj3));
    Assert_true(!is_live_object(obj4));
    Assert_true(is_live_object(root_set.values[1]));
    DELETE_ROOT_SET(root_set);
}

void test_gc_sweep() {
    gc_initialize();
    value_t heap_size = heap_memory[2];

    ROOT_SET(root_set, 5);

    value_t obj, obj2;
    gc_new_string("test");
    gc_new_string("test1");
    root_set.values[0] = gc_new_string("test2");
    root_set.values[1] = gc_new_string("test3");
    root_set.values[2] = gc_new_string("test4");
    gc_new_string("test5");
    gc_new_vector(2);
    gc_new_vector(3);
    root_set.values[3] = obj = gc_new_vector(4);
    obj2 = gc_new_vector(3);
    gc_vector_set(obj, 0, obj2);

    gc_run();

    Assert_true(is_live_object(root_set.values[0]));
    root_set.values[0] = VALUE_NULL;
    Assert_true(is_live_object(root_set.values[2]));
    root_set.values[2] = VALUE_NULL;

    gc_run();

    Assert_true(is_live_object(root_set.values[1]));
    root_set.values[1] = VALUE_NULL;
    root_set.values[3] = VALUE_NULL;

    gc_run();

    Assert_equals(heap_memory[2], heap_size);
    Assert_equals(heap_memory[0], 2);

    DELETE_ROOT_SET(root_set);

    gc_run();
}

int main() {
#ifdef BIT64
    test_pointer_table();
#endif
    gc_initialize();
    test_converters();
    test_string();
    test_bytearray();
    test_array();
    test_allocate_heap();
    test_root_set();
    test_root_set2();
    test_nested_root_set();
    test_gc_long_chain();
    test_gc_liveness();
    test_gc_liveness2();
    test_gc_sweep();
    puts("done");
    return 0;
}

#endif /* TEST */
