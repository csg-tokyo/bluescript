// Copyright (C) 2022- Shigeru Chiba.  All rights reserved.

/*
  To run on a 64bit machine (for testing/debugging purpose only),
  compile with -DLINUX64.

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

#include <stddef.h>     // for NULL
#include <stdio.h>      // for fputs(), sprintf()
#include <stdarg.h>
#include <setjmp.h>
#include <string.h>     // for strlen(), strcmp()
#include <math.h>       // for isnan(), pow()
#include "../include/c-runtime.h"

#ifdef LINUX64

#include <stdlib.h>

#define MASK32      0xffffffff
#define MASK64H     0xffffffff00000000

#define PTR_TABLE_SIZE     1000
static const void* pointer_table[PTR_TABLE_SIZE];
static int pointer_table_num = 0;

static void initialize_pointer_table() {
    for (int i = 0; i < PTR_TABLE_SIZE; i++)
        pointer_table[i] = 0;
}

// pointers to literals only. not to heap values.
static void* record_64bit_pointer(const void* ptr) {
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

static inline void* raw_value_to_ptr(value_t v) {
    uintptr_t ptr32 = (uintptr_t)v;
    return *(void**)((uint64_t)pointer_table & MASK64H | (uint64_t)ptr32 & MASK32);
}

static inline value_t raw_ptr_to_value(const void* v) { return (value_t)((uintptr_t)v & 0xffffffff); }

#else

#include "../include/protocol.h"

static inline void* raw_value_to_ptr(value_t v) { return (void*)v; }
static inline value_t raw_ptr_to_value(const void* v) { return (value_t)v; }

#endif /* LINUX64 */

#define HEAP_SIZE       (1024 * 8 + 2) // words (even number)

static value_t heap_memory[HEAP_SIZE];

#ifdef LINUX64
pointer_t gc_heap_pointer(pointer_t ptr) {
    return (pointer_t)((uint64_t)heap_memory & MASK64H | (uint64_t)ptr & MASK32);
}
#endif

#ifdef LINUX64

#define GC_ENTER_CRITICAL(m)
#define GC_EXIT_CRITICAL(m)

#else

#include <freertos/FreeRTOS.h>

#define GC_ENTER_CRITICAL(m)       portENTER_CRITICAL(&(m))
#define GC_EXIT_CRITICAL(m)        portEXIT_CRITICAL(&(m))

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
#ifndef LINUX64
        bs_protocol_write_error(error_message);
#endif
        return 1;
    }
    else {
        main_function();
        return 0;
    }
}

static value_t throw_runtime_error(const char* name, const char* msg) {
    size_t len = sizeof(error_message) / sizeof(error_message[0]);
    snprintf(error_message, len, "** runtime %serror: %s\n", name, msg);
    if (error_message[len - 2] != '\0') {
        error_message[len - 2] = '\n';
        error_message[len - 1] = '\0';
    }
    longjmp(long_jump_buffer, -1);
    return 0;
}

static value_t runtime_type_error(const char* msg) {
    return throw_runtime_error("type ", msg);
}

static void runtime_index_error(int32_t idx, int32_t len, char* name) {
    const char fmt[] = "** runtime error: array index out of range: %d (len: %d) in %s\n";
    snprintf(error_message, sizeof(error_message) / sizeof(error_message[0]), fmt, (int)idx, (int)len, name);
    longjmp(long_jump_buffer, -1);
}

static value_t runtime_memory_allocation_error(const char* msg) {
    return throw_runtime_error("memory allocation ", msg);
}

value_t runtime_error(const char* msg) {
    return throw_runtime_error("", msg);
}

// arithmetic operators for any-type values

#define INCREMENT_OP    'i'
#define DECREMENT_OP    'd'
#define POST_INCREMENT_OP    'p'
#define POST_DECREMENT_OP    'q'

int32_t safe_value_to_int(value_t v) {
    if (!is_int_value(v))
        runtime_type_error("value_to_int");

    return value_to_int(v);
}

typedef uint32_t value_t;
typedef union { uint32_t u; float f; } float_or_uint;

const uint32_t FLOAT_TAG = 0x1u;
const float_or_uint ENCODE_MULT = { 0x0F800000u };

value_t float_to_value(float f) {
    if (isnan(f)) {
        return 0x7F000000u | FLOAT_TAG;
    }
    float_or_uint v;
    v.f = f * ENCODE_MULT.f;
    if ((v.u & 0x60000000u) || (v.u | 0xE07FFFFFu) == 0xFFFFFFFFu) {
        // change to inf
        return (v.u & 0x80000000u) | 0x7E000000u | FLOAT_TAG;
    } else {
        return (v.u & 0x80000000u) | ((v.u & 0x1FFFFFFF) << 2) | FLOAT_TAG;
    }
}

float value_to_float(value_t v) {
    if ((v | ~0x7E000000) == 0xFFFFFFFF) {
        // inf, -inf, NaN
        float_or_uint f;
        f.u = (v & 0x80000000u) | 0x7F800000u | ((v & 0x01FFFFFC) >> 2);
        return f.f;
    } else {
        float_or_uint f = { (v & 0x80000000u) | ((v & 0x7FFFFFFCu) >> 2) };
        return f.f / ENCODE_MULT.f;
    }
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

value_t safe_value_to_func(const char* signature, value_t func) {
    if (!gc_is_function_object(func, signature))
        runtime_type_error("value_to_function");

    return func;
}

value_t safe_value_to_string(bool nullable, value_t v) {
    if (nullable && v == VALUE_NULL)
        return v;

    if (!gc_is_string_object(v))
        runtime_type_error("value_to_string");

    return v;
}

value_t safe_value_to_object(bool nullable, value_t v) {
    if (nullable && v == VALUE_NULL)
        return v;

    // note: String is not a subtype of Object
    if (!is_ptr_value(v) || gc_is_string_object(v))
        runtime_type_error("value_to_object");

    return v;
}

value_t safe_value_to_value(bool nullable, const class_object* const clazz, value_t v) {
    if (nullable && v == VALUE_NULL)
        return v;

    if (!gc_is_instance_of(clazz, v))
        runtime_type_error(clazz->name);

    return v;
}

#define ANY_OP_FUNC(name, op, rest) \
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
    rest\
    return runtime_type_error("bad operand for " #op);\
}

ANY_OP_FUNC(add,+,if (gc_is_string_object(a) || gc_is_string_object(b)) {\
    return gc_new_String(a, b); })
ANY_OP_FUNC(subtract,-,)
ANY_OP_FUNC(multiply,*,)
ANY_OP_FUNC(divide,/,)

value_t any_modulo(value_t a, value_t b) {
    if (is_int_value(a))
        if (is_int_value(b))
            return int_to_value(value_to_int(a) % value_to_int(b));

    return runtime_type_error("bad operand for %%");
}

value_t any_power(value_t a, value_t b) {
    double x, y;
    int int_type = 1;
    if (is_int_value(a))
        x = value_to_int(a);
    else if (is_float_value(a)) {
        x = value_to_float(a);
        int_type = 0;
    }
    else
        return runtime_type_error("bad operand for **");

    if (is_int_value(b))
        y = value_to_int(b);
    else if (is_float_value(b)) {
        y = value_to_float(b);
        int_type = 0;
    }
    else
        return runtime_type_error("bad operand for **");

    double z = pow(x, y);
    if (int_type)
        return int_to_value((int32_t)z);
    else
        return float_to_value((float)z);
}

double double_power(double a, double b) { return pow(a, b); }

bool any_eq(value_t a, value_t b) {
    if (gc_is_string_object(a))
        return gc_is_string_object(b)
            && strcmp(gc_string_to_cstr(a), gc_string_to_cstr(b)) == 0;
    else
        return a == b;
}

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
    else if (gc_is_string_object(a) && gc_is_string_object(b))\
        return strcmp(gc_string_to_cstr(a), gc_string_to_cstr(b)) op 0;\
    return runtime_type_error("bad operand for " #op);\
}

ANY_CMP_FUNC(less,<)
ANY_CMP_FUNC(less_eq,<=)
ANY_CMP_FUNC(greater,>)
ANY_CMP_FUNC(greater_eq,>=)

#define ANY_ASSIGN_OP_FUNC(name, op, rest) \
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
    rest\
    return runtime_type_error("bad operand for " #op);\
}

ANY_ASSIGN_OP_FUNC(add,+,else if (gc_is_string_object(*a)) {\
    return *a = gc_new_String(*a, b); })
ANY_ASSIGN_OP_FUNC(subtract,-,)
ANY_ASSIGN_OP_FUNC(multiply,*,)
ANY_ASSIGN_OP_FUNC(divide,/,)

value_t any_add_member(value_t obj, int index, value_t v) {
    value_t* ptr = &value_to_ptr(obj)->body[index];
    if (gc_is_string_object(*ptr)) {
        value_t s = gc_new_String(*ptr, v);
        return set_obj_property(obj, index, s);
    }
    else
        return any_add_assign(ptr, v);
}

value_t any_modulo_assign(value_t* a, value_t b) {
    if (is_int_value(*a))
        if (is_int_value(b))
            return *a = int_to_value(value_to_int(*a) % value_to_int(b));

    return runtime_type_error("bad operand for %%=");
}

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

static bool gc_is_running = false;

// An interrupt handler must count up this value at the beginning, and count down at the end.
// Note that an interrupt handler may be nested.
// When this value is 0, no interrupt handler is working.
static int nested_interrupt_handler = 0;

void interrupt_handler_start() { nested_interrupt_handler++ ; }
void interrupt_handler_end() { nested_interrupt_handler--; }

void gc_initialize() {
    heap_memory[0] = 2;  // points to the first word of linked free blocks.
    heap_memory[1] = 2;  // the size of the reserved space (first two words).
    heap_memory[2] = HEAP_SIZE;
    heap_memory[3] = HEAP_SIZE - 2;
#ifdef LINUX64
    initialize_pointer_table();
#endif
}

static inline int object_size(pointer_t obj, class_object* clazz) {
    int32_t size = clazz->size;
    if (size >= 0)      // != SIZE_NO_POINTER
        return size;
    else
        return obj->body[0] + 1;
}

// start_idnex is SIZE_NO_POINTER when the object does not hold a pointer
// managed by a garbage collector.
#define SIZE_NO_POINTER     -1

#define HAS_POINTER(s)      (s >= 0)

static int32_t class_has_pointers(class_object* obj) {
    return obj->start_index;
}

// current default value (reprenting not marked) of mark bits.
static uint32_t current_no_mark = 0;

static void set_object_header(pointer_t obj, const class_object* clazz) {
#ifdef LINUX64
    uint64_t clazz2 = (uint64_t)record_64bit_pointer((void*)(uintptr_t)clazz);
    obj->header = (((uint32_t)clazz2) & ~3) | current_no_mark;
#else
    obj->header = (((uint32_t)clazz) & ~3) | current_no_mark;
#endif
}

// Gets a pointer to the given object's class.
static class_object* get_objects_class(pointer_t obj) {
    return (class_object*)raw_value_to_ptr(obj->header & ~3);
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

bool gc_is_instance_of(const class_object* clazz, value_t obj) {
    const class_object* type = gc_get_class_of(obj);
    while (type != clazz)
        if (type == NULL)
            return false;
        else
            type = type->superclass;
    return true;
}

void* gc_method_lookup(value_t obj, uint32_t index) {
    return get_objects_class(value_to_ptr(obj))->vtbl[index];
}

// IS_ARRAY_TYPE(t) is true when t is an array object, Uint8Array, or Vector.
// t is an object accessible by the [] operator.
#define IS_ARRAY_TYPE(clazz)    (clazz != NULL && (clazz)->array_type_name != NULL)

#define DEFAULT_PTABLE      { .size = 0, .offset = 0, .unboxed = 0, .prop_names = NULL, .unboxed_types = NULL }
#define DEFAULT_MTABLE      { .size = 0, .names = NULL, .signatures = NULL }

CLASS_OBJECT(object_class, 1) = {
    .clazz = { .size = 0, .start_index = 0, .name = "object", .superclass = NULL, .array_type_name = NULL, .table = DEFAULT_PTABLE, .mtable = DEFAULT_MTABLE }};

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

static int get_anyobj_property2(const class_object* clazz, int property, char* type) {
    if (clazz == NULL)
        runtime_type_error("no such property is found");

    const uint16_t size = clazz->table.size;
    const uint16_t* names = clazz->table.prop_names;
    for (int i = 0; i < size; i++)
        if (names[i] == property) {
            int index = i + clazz->table.offset;
            if (index < clazz->table.unboxed)
                *type = clazz->table.unboxed_types[i];
            else
                *type = ' ';

            return index;
        }

    return get_anyobj_property2(clazz->superclass, property, type);
}

value_t* get_obj_property_addr(value_t obj, int index) {
    value_t* ptr = &value_to_ptr(obj)->body[index];
    if (is_ptr_value(*ptr))
        runtime_type_error("get_obj_property_addr() is called on a pointer value.");

    return ptr;
}

value_t get_anyobj_property(value_t obj, int property) {
    class_object* clazz = gc_get_class_of(obj);
    char type;
    int index = get_anyobj_property2(clazz, property, &type);
    if (type == ' ')
        return get_obj_property(obj, index);
    else if (type == 'i' || type == 'b')
        return int_to_value(*get_obj_int_property(obj, index));
    else if (type == 'f')
        return float_to_value(*get_obj_float_property(obj, index));
    else {
        runtime_type_error("get_anyobj_property");
        return VALUE_UNDEF;
    }
}

// see also get_anyobj_length_property()

value_t set_anyobj_property(value_t obj, int property, value_t new_value) {
    class_object* clazz = gc_get_class_of(obj);
    char type;
    int index = get_anyobj_property2(clazz, property, &type);
    if (type == ' ')
        return set_obj_property(obj, index, new_value);
    else if (type == 'i' || type == 'b')
        *get_obj_int_property(obj, index) = safe_value_to_int(new_value);
    else if (type == 'f')
        *get_obj_float_property(obj, index) = safe_value_to_float(new_value);
    else
        runtime_type_error("set_anyobj_property");

    return new_value;
}

// accumulate a value in a property of an any-type object
// this runs gc_write_barrier().
value_t acc_anyobj_property(value_t obj, char op, int property, value_t value) {
    class_object* clazz = gc_get_class_of(obj);
    char type;
    int index = get_anyobj_property2(clazz, property, &type);
    if (type == ' ') {
        value_t left = get_obj_property(obj, index);
        value_t new_value = VALUE_UNDEF;
        switch (op) {
            case '+': new_value = any_add(left, value); break;
            case '-': new_value = any_subtract(left, value); break;
            case '*': new_value = any_multiply(left, value); break;
            case '/': new_value = any_divide(left, value); break;
            case INCREMENT_OP: new_value = any_add(left, int_to_value(1)); break;
            case DECREMENT_OP: new_value = any_subtract(left, int_to_value(1)); break;
            case POST_INCREMENT_OP:
                new_value = any_add(left, int_to_value(1));
                set_obj_property(obj, index, new_value);
                return left;
            case POST_DECREMENT_OP:
                new_value = any_subtract(left, int_to_value(1));
                set_obj_property(obj, index, new_value);
                return left;
            default: runtime_type_error("acc_anyobj_property");
        }
        return set_obj_property(obj, index, new_value);
    }
    else if (type == 'i') {
        int32_t* left = get_obj_int_property(obj, index);
        int32_t right = safe_value_to_int(value);
        switch (op) {
        case '+': *left += right; break;
        case '-': *left -= right; break;
        case '*': *left *= right; break;
        case '/': *left /= right; break;
        case INCREMENT_OP: *left += 1; break;
        case DECREMENT_OP: *left -= 1; break;
        case POST_INCREMENT_OP: return int_to_value((*left)++);
        case POST_DECREMENT_OP: return int_to_value((*left)--);
        default: runtime_type_error("acc_anyobj_property:integer");
        }
        return int_to_value(*left);
    }
    else if (type == 'f') {
        float* left = get_obj_float_property(obj, index);
        float right = safe_value_to_float(value);
        switch (op) {
        case '+': *left += right; break;
        case '-': *left -= right; break;
        case '*': *left *= right; break;
        case '/': *left /= right; break;
        case INCREMENT_OP: *left += 1; break;
        case DECREMENT_OP: *left -= 1; break;
        case POST_INCREMENT_OP: return int_to_value((*left)++);
        case POST_DECREMENT_OP: return int_to_value((*left)--);
        default: runtime_type_error("acc_anyobj_property:float");
        }
        return float_to_value(*left);
    }
    else {
        runtime_type_error("acc_anyobj_property");
        return value;
    }
}

// a function object

static CLASS_OBJECT(function_object, 0) = {
     .clazz = { .size = 3, .start_index = 2, .name = "#Function",
                .superclass = &object_class.clazz, .array_type_name = NULL, .table = DEFAULT_PTABLE, .mtable = DEFAULT_MTABLE }};

// this_object may be VALUE_UNDEF.
value_t gc_new_function(void* fptr, const char* signature, value_t captured_values) {
#ifdef LINUX64
    fptr = record_64bit_pointer(fptr);
    signature = record_64bit_pointer(signature);
#endif
    ROOT_SET(rootset, 1)
    rootset.values[0] = captured_values;
    pointer_t obj = gc_allocate_object(&function_object.clazz);
    obj->body[0] = raw_ptr_to_value(fptr);
    obj->body[1] = raw_ptr_to_value(signature);
    obj->body[2] = captured_values;
    DELETE_ROOT_SET(rootset)
    return ptr_to_value(obj);
}

// true if this is a function object.
bool gc_is_function_object(value_t obj, const char* signature) {
    return gc_get_class_of(obj) == &function_object.clazz
           && !strcmp((const char*)raw_value_to_ptr(value_to_ptr(obj)->body[1]), signature);
}

const void* gc_function_object_ptr(value_t obj, int index) {
    pointer_t func = value_to_ptr(obj);
    return (void*)raw_value_to_ptr(func->body[index]);
}

// returns an instance of boxed_value or boxed_raw_value, returned by gc_new_box() etc.
value_t gc_function_captured_value(value_t obj, int index) {
    value_t vec = value_to_ptr(obj)->body[2];
    return gc_vector_get(vec, index);
}

// boxed_value and boxed_raw_value are classes for boxing.  Their instances hold one value_t value
// or one primitive value.  They are used for implementing a free variable.

static CLASS_OBJECT(boxed_value, 0) = {
    .clazz = { .size = 1, .start_index = 0, .name = "#boxed_value",
               .superclass = NULL, .array_type_name = NULL, .table = DEFAULT_PTABLE, .mtable = DEFAULT_MTABLE }};

static CLASS_OBJECT(boxed_raw_value, 0) = {
    .clazz = { .size = 1, .start_index = SIZE_NO_POINTER, .name = "#boxed_raw_value",
               .superclass = NULL, .array_type_name = NULL, .table = DEFAULT_PTABLE, .mtable = DEFAULT_MTABLE }};

value_t gc_new_box(value_t value) {
    ROOT_SET(rootset, 1)
    rootset.values[0] = value;
    value_t obj = ptr_to_value(gc_allocate_object(&boxed_value.clazz));
    set_obj_property(obj, 0, value);
    DELETE_ROOT_SET(rootset)
    return obj;
}

value_t gc_new_int_box(int32_t value) {
    value_t obj = ptr_to_value(gc_allocate_object(&boxed_raw_value.clazz));
    *get_obj_int_property(obj, 0) = value;
    return obj;
}

value_t gc_new_float_box(float value) {
    value_t obj = ptr_to_value(gc_allocate_object(&boxed_raw_value.clazz));
    *get_obj_float_property(obj, 0) = value;
    return obj;
}

// string object

static int32_t string_starts_with(value_t self, value_t prefix) {
    const char* str = gc_string_to_cstr(self);
    const char* pre = gc_string_to_cstr(prefix);
    return strncmp(str, pre, strlen(pre)) == 0;
}

static int32_t string_ends_with(value_t self, value_t suffix) {
    const char* str = gc_string_to_cstr(self);
    const char* suf = gc_string_to_cstr(suffix);
    int32_t len = strlen(str);
    int32_t len2 = strlen(suf);
    if (len2 > len)
        return false;

    return strncmp(str + len - len2, suf, len2) == 0;
}

static pointer_t make_string_object(int32_t len);

static value_t string_substring(value_t self, int32_t start, int32_t end) {
    ROOT_SET(rootset, 1)
    rootset.values[0] = self;
    const char* str = gc_string_to_cstr(self);
    int32_t len = strlen(str);
    if (start < 0)
        start = 0;
    if (end < 0)
        end = len;

    pointer_t obj = make_string_object(end - start);
    char* buf = (char*)&obj->body[1];
    for (int i = start; i < end; i++)
        *buf++ = str[i];

    *buf = '\0';
    DELETE_ROOT_SET(rootset)
    return ptr_to_value(obj);
}

// string_literal is a class for objects that contain a pointer to a C string.
// This C string is not allocated in the heap memory managed by the garbage collector.

static CLASS_OBJECT(string_literal, 3) = {
    .body = { .s = 1, .i = SIZE_NO_POINTER, .cn = "string", .sc = NULL, .an = NULL, .pt = DEFAULT_PTABLE,
              .mt = { .size = 3,
                      .names = (const uint16_t[]){ /* startsWith */ 1, /* endsWith */ 2, /* substring */ 3, },
                      .signatures = (const char* const[]){ "(s)b", "(s)b", "(ii)s" } },
              .vtbl = { string_starts_with, string_ends_with, string_substring } }};

static CLASS_OBJECT(class_String, 3) = {
    .body = { .s = -1, .i = SIZE_NO_POINTER, .cn = "String", .sc = &object_class.clazz, .an = NULL, .pt = DEFAULT_PTABLE,
              .mt = { .size = 3,
                      .names = (const uint16_t[]){ /* startsWith */ 1, /* endsWith */ 2, /* substring */ 3, },
                      .signatures = (const char* const[]){ "(s)b", "(s)b", "(ii)s" } },
              .vtbl = { string_starts_with, string_ends_with, string_substring } }};

// str: a char array in the C language.
value_t gc_new_string(char* str) {
#ifdef LINUX64
    str = (char*)record_64bit_pointer(str);
#endif
    pointer_t obj = gc_allocate_object(&string_literal.clazz);
    obj->body[0] = raw_ptr_to_value(str);
    return ptr_to_value(obj);
}

// true if this is a string literal object.
static bool gc_is_string_literal(value_t obj) {
    return gc_get_class_of(obj) == &string_literal.clazz;
}

// returns a pointer to a char array in the C language.
// this function is only used in test-code-generator.ts.
static const char* gc_string_literal_cstr(value_t obj) {
    pointer_t str = value_to_ptr(obj);
    return (const char*)raw_value_to_ptr(str->body[0]);
}

// true if this is a String object.
static bool gc_is_string_instance(value_t obj) {
    return gc_get_class_of(obj) == &class_String.clazz;
}

// returns a pointer to a char array in the C language.
// this function is only used in test-code-generator.ts.
static const char* gc_string_instance_cstr(value_t obj) {
    pointer_t str = value_to_ptr(obj);
    return (const char*)&str->body[1];
}

bool gc_is_string_object(value_t obj) {
    return gc_is_string_literal(obj) || gc_is_string_instance(obj);
}

const char* gc_string_to_cstr(value_t obj) {
    if (gc_is_string_literal(obj))
        return gc_string_literal_cstr(obj);
    else if (gc_is_string_instance(obj))
        return gc_string_instance_cstr(obj);
    else
        return NULL;
}

static int32_t string_length_for_int(int32_t n) {
    if (n == 0)
        return 1;
    else if (n < 0)
        return 1 + string_length_for_int(-n);
    else {
        int32_t len = 0;
        while (n > 0) {
            len++;
            n /= 10;
        }
        return len;
    }
}

static char* int_to_str(char* p, int32_t n) {
    if (n == 0) {
        *p++ = '0';
        *p = '\0';
        return p;
    }

    if (n < 0) {
        *p++ = '-';
        n = -n;
    }

    int32_t len = string_length_for_int(n);
    p += len;
    char* q = p;
    *q-- = '\0';
    while (n > 0) {
        *q-- = '0' + n % 10;
        n /= 10;
    }

    return p;
}

static int32_t string_length_for_float(float f) {
    if (isnan(f) || f == 0.0)
        return 3;   // nan or 0.0
    else if (f < 0.0)
        return 1 + string_length_for_float(-f);
    else {
        int32_t n = (int32_t)f;
        int32_t len = string_length_for_int(n) + 1;
        int32_t digits = 0;
        f -= n;
        float limit = 0.000001;
        if (f < limit)
            digits = 1;
        else
            while (f >= limit && digits < 6) {
                f *= 10;
                f -= (int32_t)f;
                digits++;
                limit *= 10.0;
            }

        return len + digits;
    }
}

static char* float_to_str(char* p, float f) {
    if (isnan(f)) {
        *p++ = 'n';
        *p++ = 'a';
        *p++ = 'n';
        *p = '\0';
        return p;
    }

    if (f == 0.0) {
        *p++ = '0';
        *p++ = '.';
        *p++ = '0';
        *p = '\0';
        return p;
    }

    if (f < 0.0) {
        *p++ = '-';
        f = -f;
    }

    int32_t n = (int32_t)f;
    p = int_to_str(p, n);
    *p++ = '.';
    f -= n;
    float limit = 0.000001;
    if (f < limit)
        *p++ = '0';
    else {
        int32_t digits = 0;
        while (f >= limit && digits < 6) {
            f *= 10;
            n = (int32_t)f;
            *p++ = '0' + n;
            f -= n;
            limit *= 10.0;
            digits++;
        }
    }

    *p = '\0';
    return p;
}

int32_t gc_string_length(value_t obj) {
    if (gc_is_string_literal(obj))
        return strlen(gc_string_literal_cstr(obj));
    else if (gc_is_string_instance(obj))
        return strlen(gc_string_instance_cstr(obj));
    else if (is_int_value(obj))
        return string_length_for_int(value_to_int(obj));
    else if (is_float_value(obj))
        return string_length_for_float(value_to_float(obj));
    else if (is_bool_value(obj))
        return value_to_bool(obj) ? 4 : 5; // true or false
    else if (obj == VALUE_UNDEF)    // undefined or null
        return 9; // undefined
    else {
        class_object* cls = gc_get_class_of(obj);
        if (cls == NULL)
            return 2;                     // ??
        else
            return strlen(cls->name) + 8; // <class class_name>
    }
}

// converts a value to a C string, returns a pointer to the end of the string.
// p: a pointer to a buffer.
// obj: a value to be converted.
char* gc_any_to_cstring(char* p, value_t obj) {
    if (gc_is_string_literal(obj))
        return stpcpy(p, gc_string_literal_cstr(obj));
    else if (gc_is_string_instance(obj))
        return stpcpy(p, gc_string_instance_cstr(obj));
    else if (is_int_value(obj))
        return int_to_str(p, value_to_int(obj));
    else if (is_float_value(obj))
        return float_to_str(p, value_to_float(obj));
    else if (is_bool_value(obj))
        return stpcpy(p, value_to_bool(obj) ? "true" : "false");
    else if (obj == VALUE_UNDEF)
        return stpcpy(p, "undefined");
    else {
        class_object* cls = gc_get_class_of(obj);
        if (cls == NULL)
            return stpcpy(p, "??");
        else {
            p = stpcpy(p, "<class ");
            p = stpcpy(p, cls->name);
            *p++ = '>';
            *p = '\0';
            return p;
        }
    }
}

// len: the length of the string excluding the null character.
static pointer_t make_string_object(int32_t len) {
    int32_t size = (len + 4) / 4;
    pointer_t obj = allocate_heap(size + 1);
    set_object_header(obj, &class_String.clazz);
    obj->body[0] = size;
    return obj;
}

value_t gc_new_String(value_t s1, value_t s2) {
    ROOT_SET(rootset, 2)
    rootset.values[0] = s1;
    rootset.values[1] = s2;
    int32_t len = gc_string_length(s1) + gc_string_length(s2);
    pointer_t obj = make_string_object(len);
    char* p = (char*)&obj->body[1];
    gc_any_to_cstring(gc_any_to_cstring(p, s1), s2);
    DELETE_ROOT_SET(rootset)
    return ptr_to_value(obj);
}

// An int32_t array

static CLASS_OBJECT(intarray_object, 1) = {
    .clazz = { .size = -1, .start_index = SIZE_NO_POINTER, .name = "integer[]",
               .superclass = &object_class.clazz, .array_type_name = "[i", .table = DEFAULT_PTABLE, .mtable = DEFAULT_MTABLE }};

value_t safe_value_to_intarray(bool nullable, value_t v) {
    return safe_value_to_value(nullable, &intarray_object.clazz, v);
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
    if (0 <= index && index < len)
        return (int32_t*)&objp->body[index + 1];
    else {
        runtime_index_error(index, len, "Array<integer>.get/set");
        return 0;
    }
}

bool gc_is_intarray(value_t v) {
    const class_object* type = gc_get_class_of(v);
    return type == &intarray_object.clazz;
}

// A float array

static CLASS_OBJECT(floatarray_object, 1) = {
    .clazz = { .size = -1, .start_index = SIZE_NO_POINTER, .name = "float[]",
               .superclass = &object_class.clazz, .array_type_name = "[f", .table = DEFAULT_PTABLE, .mtable = DEFAULT_MTABLE }};

value_t safe_value_to_floatarray(bool nullable, value_t v) {
    return safe_value_to_value(nullable, &floatarray_object.clazz, v);
}

static pointer_t gc_new_floatarray_base(int32_t n) {
    pointer_t obj = gc_new_intarray_base(n);
    set_object_header(obj, &floatarray_object.clazz);
    return obj;
}

/*
  A float array.  It cannot contain a pointer.
  n: the number of elements. n >= 0.

  1st word is the number of elements.
  2nd, 3rd, ... words hold elements.
*/
value_t gc_new_floatarray(int32_t n, float init_value) {
    pointer_t obj = gc_new_floatarray_base(n);
    for (int32_t i = 1; i <= n; i++)
        *(float*)&obj->body[i] = init_value;

    return ptr_to_value(obj);
}

value_t gc_make_floatarray(int32_t n, ...) {
    va_list args;
    pointer_t arrayp = gc_new_floatarray_base(n);
    va_start(args, n);

    for (int32_t i = 1; i <= n; i++) {
        // because float is promotable to double.
        float v = (float)va_arg(args, double);
        *(float*)&arrayp->body[i] = v;
    }

    va_end(args);
    return ptr_to_value(arrayp);
}

int32_t gc_floatarray_length(value_t obj) {
    pointer_t objp = value_to_ptr(obj);
    return objp->body[0];
}

float* gc_floatarray_get(value_t obj, int32_t index) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = objp->body[0];
    if (0 <= index && index < len)
        return (float*)&objp->body[index + 1];
    else {
        runtime_index_error(index, len, "Array<float>.get/set");
        return 0;
    }
}

bool gc_is_floatarray(value_t v) {
    const class_object* type = gc_get_class_of(v);
    return type == &floatarray_object.clazz;
}

// A byte array and a boolean array

CLASS_OBJECT(class_Uint8Array, 1) = {
    .clazz = { .size = -1, .start_index = SIZE_NO_POINTER, .name = "Uint8Array",
               .superclass = &object_class.clazz, .array_type_name = "'Uint8Array'", .table = DEFAULT_PTABLE, .mtable = DEFAULT_MTABLE }};

static CLASS_OBJECT(boolarray_object, 1) = {
    .clazz = { .size = -1, .start_index = SIZE_NO_POINTER, .name = "boolean[]",
               .superclass = &object_class.clazz, .array_type_name = "[b", .table = DEFAULT_PTABLE, .mtable = DEFAULT_MTABLE }};

value_t safe_value_to_boolarray(bool nullable, value_t v) {
    return safe_value_to_value(nullable, &boolarray_object.clazz, v);
}

/*
  A byte (or unsigned 8 bit) array.  It cannot contain a pointer.
  n: the size of the array in bytes.
  the actual size will be a multiple of 4.

  Initially, the elements of this array hold random values.
  1st word is the size of this array.
  2nd word is the number of elements.
  3rd, 4th, ... words hold elements.
*/
static pointer_t gc_new_bytearray_base(int32_t n, const struct class_object* clazz) {
    if (n < 0)
        n = 0;

    int32_t m =(n + 3) / 4 + 1;
    pointer_t obj = allocate_heap(m + 1);
    set_object_header(obj, clazz);
    obj->body[0] = m;
    obj->body[1] = n;
    return obj;
}

value_t gc_new_bytearray(bool is_boolean, int32_t n, int32_t init_value) {
    pointer_t obj = gc_new_bytearray_base(n, is_boolean ? &boolarray_object.clazz : &class_Uint8Array.clazz);
    uint32_t v = init_value & 0xff;
    uint8_t* elements = (uint8_t*)&obj->body[2];
    for (int i = 0; i < n; i++)
        elements[i] = v;

    return ptr_to_value(obj);
}

value_t gc_make_bytearray(bool is_boolean, int32_t n, ...) {
    va_list args;
    pointer_t arrayp = gc_new_bytearray_base(n, is_boolean ? &boolarray_object.clazz : &class_Uint8Array.clazz);
    va_start(args, n);

    uint8_t* elements = (uint8_t*)&arrayp->body[2];
    for (int32_t i = 0; i < n; i++) {
        int32_t v = va_arg(args, int32_t);
        elements[i] = (uint8_t)v;
    }

    va_end(args);
    return ptr_to_value(arrayp);
}

// the size of the array in bytes.
int32_t gc_bytearray_length(value_t obj) {
    pointer_t objp = value_to_ptr(obj);
    return objp->body[1];
}

// Obtains an unsigned 8bit value of the byte element at index.
// When index is 2, the 2nd element of an 8bit array is returned.
uint8_t* gc_bytearray_get(value_t obj, int32_t idx) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = objp->body[1];
    if (0 <= idx && idx < len)
        return (uint8_t*)&objp->body[2] + idx;
    else {
        if (gc_is_instance_of(&boolarray_object.clazz, obj))
            runtime_index_error(idx, len, "Array<boolean>.get/set");
        else
            runtime_index_error(idx, len, "Uint8Array.get/set");
        return 0;
    }
}

bool gc_is_boolarray(value_t v) {
    const class_object* type = gc_get_class_of(v);
    return type == &boolarray_object.clazz;
}

// A fixed-length array

CLASS_OBJECT(class_Vector, 1) = {
    .clazz = { .size = -1, .start_index = 1, .name = "Vector",
               .superclass = &object_class.clazz, .array_type_name = "'Vector'", .table = DEFAULT_PTABLE, .mtable = DEFAULT_MTABLE }};

value_t safe_value_to_vector(bool nullable, value_t v) {
    return safe_value_to_value(nullable, &class_Vector.clazz, v);
}

/*
  A fixed-length array.  We call it a vector.
  n: the number of vector elements.
     1st word is the number of elements.
     2nd, 3rd, ... words hold elements.
*/
value_t gc_new_vector(int32_t n, value_t init_value) {
    ROOT_SET(rootset, 1)
    rootset.values[0] = init_value;
    if (n < 0)
        n = 0;

    pointer_t obj = allocate_heap(n + 1);
    set_object_header(obj, &class_Vector.clazz);
    obj->body[0] = n;
    for (int i = 0; i < n; i++)
        obj->body[i + 1] = init_value;

    DELETE_ROOT_SET(rootset)
    return ptr_to_value(obj);
}

inline static value_t* fast_vector_get(value_t obj, int32_t index) {
    pointer_t objp = value_to_ptr(obj);
    return &objp->body[index + 1];
}

inline static void fast_vector_set(value_t obj, uint32_t index, value_t new_value) {
    pointer_t objp = value_to_ptr(obj);
    gc_write_barrier(objp, new_value);
    objp->body[index + 1] = new_value;
}

static value_t duplicate_vector(int32_t n, int32_t offset, value_t vec) {
    ROOT_SET(rootset, 1)
    rootset.values[0] = vec;
    int32_t len = gc_vector_length(vec);
    if (n < 0)
        n = 0;
    else if (n < len + offset)
        n = len + offset;

    pointer_t obj = allocate_heap(n + 1);
    set_object_header(obj, &class_Vector.clazz);
    obj->body[0] = n;
    for (int i = 1; i <= offset; i++)
        obj->body[i] = VALUE_UNDEF;

    pointer_t src = value_to_ptr(vec);
    memmove(&obj->body[offset + 1], &src->body[1], len * sizeof(value_t));

    for (int i = len + offset + 1; i <= n; i++)
        obj->body[i] = VALUE_UNDEF;

    DELETE_ROOT_SET(rootset)
    return ptr_to_value(obj);
}

int32_t gc_vector_length(value_t obj) {
    pointer_t objp = value_to_ptr(obj);
    return objp->body[0];
}

value_t gc_vector_get(value_t obj, int32_t idx) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = objp->body[0];
    if (0 <= idx && idx < len)
        return objp->body[idx + 1];
    else {
        runtime_index_error(idx, len, "Vector.get");
        return VALUE_UNDEF;
    }
}

value_t gc_vector_set(value_t obj, int32_t index, value_t new_value) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = objp->body[0];
    if (0 <= index && index < len) {
        gc_write_barrier(objp, new_value);
        objp->body[index + 1] = new_value;
        return new_value;
    }
    else {
        runtime_index_error(index, len, "Vector.set");
        return 0;
    }
}

/* The given vector elements are not stored in a root set.
   A caller function must guarantee that they are reachable
   from the root.
*/
value_t gc_make_vector(int32_t n, ...) {
    va_list args;
    value_t array = gc_new_vector(n, VALUE_UNDEF);
    va_start(args, n);
    for (int32_t i = 0; i < n; i++)
        fast_vector_set(array, i, va_arg(args, value_t));
    va_end(args);
    return array;
}

// any-type and other arrays

// Returns true when obj is an array of any kind of type, such as integer[] and any[].
bool gc_is_instance_of_array(value_t obj) {
    class_object* clazz = gc_get_class_of(obj);
    return IS_ARRAY_TYPE(clazz);
}

static CLASS_OBJECT(anyarray_object, 4) = {
    .body = { .s = 2, .i = 1, .cn = "any[]", .sc = &object_class.clazz, .an = "[a", .pt = DEFAULT_PTABLE,
              .mt = { .size = 4,
                      .names = (const uint16_t[]){ /* push */ 4, /* pop */ 5, /* unshift */ 6, /* shift */ 7, },
                      .signatures = (const char* const[]){ "(a)i", "()a", "(a)i", "()a" }},
              .vtbl = { gc_array_push, gc_array_pop, gc_array_unshift, gc_array_shift } }};

value_t safe_value_to_anyarray(bool nullable, value_t v) {
    return safe_value_to_value(nullable, &anyarray_object.clazz, v);
}

static inline int32_t real_array_length(int32_t n) { return ((n + 1) & ~7) + 7; }

value_t gc_new_array(const class_object* clazz, int32_t n, value_t init_value) {
    ROOT_SET(rootset, 2)
    rootset.values[0] = init_value;
    pointer_t obj = gc_allocate_object(clazz == NULL ? &anyarray_object.clazz : clazz);
    rootset.values[1] = ptr_to_value(obj);
    const int32_t size = real_array_length(n);
    value_t vec = gc_new_vector(size, init_value);
    pointer_t vecp = value_to_ptr(vec);
    if (init_value != VALUE_UNDEF)
        for (int i = n + 1; i <= size; i++)
            vecp->body[i] = VALUE_UNDEF;

    obj->body[1] = vec;
    // the length must be less than or equal to the length of the vector.
    obj->body[0] = n;
    DELETE_ROOT_SET(rootset)
    return ptr_to_value(obj);
}

static value_t gc_grow_array(value_t obj, int32_t addedElements, int32_t offset) {
    ROOT_SET(rootset, 1)
    rootset.values[0] = obj;
    pointer_t objp = value_to_ptr(obj);
    int32_t n = objp->body[0];
    int32_t new_n = n + addedElements;
    value_t vec = objp->body[1];
    pointer_t vecp = value_to_ptr(vec);
    int32_t size = vecp->body[0];
    if (new_n > size) {
        int32_t new_size = real_array_length(new_n);
        value_t new_vec = duplicate_vector(new_size, offset, vec);
        objp->body[1] = new_vec;
    }
    else
        if (offset > 0) {
            memmove(&vecp->body[offset + 1], &vecp->body[1], n * sizeof(value_t));
            for (int i = 1; i <= offset; i++)
                vecp->body[i] = VALUE_UNDEF;
        }
        else if (offset < 0) {
            memmove(&vecp->body[1], &vecp->body[1 - offset], (n + offset) * sizeof(value_t));
            for (int i = n + offset + 1; i <= n; i++)
                vecp->body[i] = VALUE_UNDEF;
        }

    objp->body[0] = new_n;
    DELETE_ROOT_SET(rootset)
    return obj;
}

/* The given array elements are not stored in a root set.
   A caller function must guarantee that they are reachable
   from the root.
*/
value_t gc_make_array(const class_object* clazz, int32_t n, ...) {
    va_list args;
    value_t array = gc_new_array(clazz, n, VALUE_UNDEF);
    pointer_t arrayp = value_to_ptr(array);
    va_start(args, n);

    for (int32_t i = 0; i < n; i++)
        fast_vector_set(arrayp->body[1], i, va_arg(args, value_t));

    va_end(args);
    return array;
}

int32_t gc_array_length(value_t obj) {
    pointer_t objp = value_to_ptr(obj);
    return objp->body[0];
}

value_t* gc_array_get(value_t obj, int32_t idx) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = objp->body[0];
    if (0 <= idx && idx < len)
        return fast_vector_get(objp->body[1], idx);
    else {
        runtime_index_error(idx, len, "Array.get");
        return 0;
    }
}

value_t gc_array_set(value_t obj, int32_t index, value_t new_value) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = objp->body[0];
    if (0 <= index && index < len) {
        fast_vector_set(objp->body[1], index, new_value);
        return new_value;
    } else {
        runtime_index_error(index, len, "Array.set");
        return 0;
    }
}

int32_t gc_array_push(value_t obj, value_t new_value) {
    ROOT_SET(rootset, 2)
    rootset.values[0] = obj;
    rootset.values[1] = new_value;
    gc_grow_array(obj, 1, 0);
    pointer_t objp = value_to_ptr(obj);
    int32_t len = objp->body[0];
    fast_vector_set(objp->body[1], len - 1, new_value);
    DELETE_ROOT_SET(rootset)
    return len;
}

value_t gc_array_pop(value_t obj) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = objp->body[0];
    if (len == 0)
        return VALUE_UNDEF;

    value_t value = gc_vector_get(objp->body[1], len - 1);
    gc_vector_set(objp->body[1], len - 1, VALUE_UNDEF);
    objp->body[0] = len - 1;
    return value;
}

int32_t gc_array_unshift(value_t obj, value_t new_value) {
    ROOT_SET(rootset, 2)
    rootset.values[0] = obj;
    rootset.values[1] = new_value;
    gc_grow_array(obj, 1, 1);
    pointer_t objp = value_to_ptr(obj);
    fast_vector_set(objp->body[1], 0, new_value);
    DELETE_ROOT_SET(rootset)
    return objp->body[0];
}

value_t gc_array_shift(value_t obj) {
    pointer_t objp = value_to_ptr(obj);
    int32_t len = objp->body[0];
    if (len == 0)
        return VALUE_UNDEF;

    value_t value = gc_vector_get(objp->body[1], 0);
    gc_grow_array(obj, -1, -1);
    return value;
}

int32_t get_all_array_length(value_t obj) {
    class_object* clazz = gc_get_class_of(obj);
    if (IS_ARRAY_TYPE(clazz))
        if (clazz == &class_Uint8Array.clazz || clazz == &boolarray_object.clazz)
            return value_to_ptr(obj)->body[1];
        else
            return value_to_ptr(obj)->body[0];
    else if (gc_is_string_object(obj))
        return gc_string_length(obj);
    else
        return -1;
}

// get the length if the object is an array.  Otherwise, get the value of the length property.
value_t get_anyobj_length_property(value_t obj, int property) {
    int32_t len = get_all_array_length(obj);
    if (len >= 0)
        return int_to_value(len);
    else
        return get_anyobj_property(obj, property);
}

value_t gc_safe_array_get(value_t obj, int32_t idx) {
    class_object* clazz = gc_get_class_of(obj);
    if (clazz == &intarray_object.clazz)
        return int_to_value(*gc_intarray_get(obj, idx));
    else if (clazz == &floatarray_object.clazz)
        return float_to_value(*gc_floatarray_get(obj, idx));
    else if (clazz == &class_Uint8Array.clazz)
        return int_to_value(*gc_bytearray_get(obj, idx));
    else if (clazz == &boolarray_object.clazz)
        return bool_to_value(*gc_bytearray_get(obj, idx));
    else if (clazz == &class_Vector.clazz)
        return gc_vector_get(obj, idx);
    else if (IS_ARRAY_TYPE(clazz))   // for arrays of value_t
        return *gc_array_get(obj, idx);
    else {
        runtime_type_error("reading a non array");
        return VALUE_UNDEF;
    }
}

value_t gc_safe_array_set(value_t obj, int32_t idx, value_t new_value) {
    class_object* clazz = gc_get_class_of(obj);
    if (clazz == &intarray_object.clazz)
        return int_to_value(*gc_intarray_get(obj, idx) = safe_value_to_int(new_value));
    else if (clazz == &floatarray_object.clazz)
        return float_to_value(*gc_floatarray_get(obj, idx) = safe_value_to_float(new_value));
    else if (clazz == &class_Uint8Array.clazz)
        return int_to_value(*gc_bytearray_get(obj, idx) = safe_value_to_int(new_value));
    else if (clazz == &boolarray_object.clazz) {
        uint8_t v = *gc_bytearray_get(obj, idx) = safe_value_to_bool(new_value);
        return bool_to_value(v);
    }
    else if (clazz == &class_Vector.clazz)
        return gc_vector_set(obj, idx, new_value);
    else if (IS_ARRAY_TYPE(clazz))  // for arrays of value_t
        return gc_array_set(obj, idx, new_value);
    else {
        runtime_type_error("assignment to a non array");
        return VALUE_UNDEF;
    }
}

// this runs gc_write_barrier().
value_t gc_safe_array_acc(value_t obj, int32_t index, char op, value_t value) {
    value_t left = gc_safe_array_get(obj, index);
    value_t new_value = VALUE_UNDEF;
    switch (op) {
        case '+': new_value = any_add(left, value); break;
        case '-': new_value = any_subtract(left, value); break;
        case '*': new_value = any_multiply(left, value); break;
        case '/': new_value = any_divide(left, value); break;
        case INCREMENT_OP: new_value = any_add(left, int_to_value(1)); break;
        case DECREMENT_OP: new_value = any_subtract(left, int_to_value(1)); break;
        case POST_INCREMENT_OP:
            new_value = any_add(left, int_to_value(1));
            gc_safe_array_set(obj, index, new_value);
            return left;
        case POST_DECREMENT_OP:
            new_value = any_subtract(left, int_to_value(1));
            gc_safe_array_set(obj, index, new_value);
            return left;
        default: runtime_type_error("gc_safe_array_acc");
    }
    return gc_safe_array_set(obj, index, new_value);
}

bool gc_is_anyarray(value_t v) {
    const class_object* type = gc_get_class_of(v);
    return type == &anyarray_object.clazz;
}

static bool is_subclass_of(value_t obj, const char** sig) {
    const class_object* clazz = gc_get_class_of(obj);
    while (clazz != NULL) {
        const char* name = clazz->name;
        const char* ptr = *sig;
        while (*name == *ptr) {
            name++;
            ptr++;
        }

        if (*name == '\0' && *ptr == '\'') {
            *sig = ptr + 1;
            return true;
        }

        clazz = clazz->superclass;
    }

    const char* ptr2 = *sig;
    while (*ptr2++ != '\'')
        ;

    *sig = ptr2;
    return false;        // not a subclass
}

static bool is_array_type(value_t obj, const char** sig) {
    const class_object* clazz = gc_get_class_of(obj);
    if (clazz != NULL) {
        const char* name = clazz->array_type_name;
        if (name != NULL) {
            const char* name2 = *sig;
            while (*name != '\0')
                if (*name++ != *name2++)
                    return false;

            *sig = name2;
            return true;
        }
    }
    return false;
}

// This is used by is_subtype_of().
// It is similar to gc_is_function_object(), but it is slightly different.
static bool is_function_type(value_t obj, const char** sig) {
    if (gc_get_class_of(obj) == &function_object.clazz) {
        const char* name = raw_value_to_ptr(value_to_ptr(obj)->body[1]);
        const char* name2 = *sig;
        while (*name != '\0')
            if (*name++ != *name2++)
                return false;

        *sig = name2;
        return true;
    }
    return false;
}

static bool is_subtype_of(value_t obj, const char** sig) {
    char t = **sig;
    *sig += 1;
    if (t == 'a')
        return true;
    else if (t == 'i' || t == 'b') {
        if (is_int_value(obj))
            return true;
    }
    else if (t == 'f') {
        if (is_float_value(obj))
            return true;
    }
    else if (t == 's') {
        if (gc_is_string_object(obj))
            return true;
    }
    else if (t == 'n') {
        if (obj == VALUE_NULL)
            return true;
    }
    else if (t == '[') {
        *sig -= 1;
        if (is_array_type(obj, sig))
            return true;
        else {
            *sig += 1;
            is_subtype_of(obj, sig);
        }
    }
    else if (t == '(') {
        *sig -= 1;
        if (is_function_type(obj, sig))
            return true;
        else {
            const char* sig2 = *sig;
            while (*sig2++ != ')')
                ;

            *sig = sig2;
            is_subtype_of(obj, sig);
            return false;
        }
    }
    else if (t == '\'')
        return is_subclass_of(obj, sig);
    else if (t == '|') {
        bool left = is_subtype_of(obj, sig);
        bool right = is_subtype_of(obj, sig);
        return left || right;
    }

    return false;
}

value_t gc_dynamic_method_call(value_t obj, uint32_t index, uint32_t num, ...) {
    value_t args[12];
    if (num > sizeof(args) / sizeof(args[0]))
        runtime_error("too many arguments; not supported");

    class_object* clazz = gc_get_class_of(obj);
    if (clazz == NULL)
        runtime_error("a method call on a non-object");

    const void* fptr = NULL;
    const char* sig = NULL;
    if (clazz == &function_object.clazz) {
        fptr = gc_function_object_ptr(obj, 0);
        sig = gc_function_object_ptr(obj, 1);
    }
    else
        for (int32_t i = 0; i < clazz->mtable.size; i++)
            if (clazz->mtable.names[i] == index) {
                fptr = clazz->vtbl[i];
                sig = clazz->mtable.signatures[i];
                break;
            }

    if (fptr == NULL)
        runtime_error("no such method is found");

    float fargs[4];

    va_list arguments;
    va_start(arguments, num);

    ++sig;
    int32_t i, j, k;
    for (i = j = k = 0; i < num && *sig != ')'; i++) {
        value_t v = va_arg(arguments, value_t);
        char t = *sig;
        if (!is_subtype_of(v, &sig))
            runtime_type_error("wrong type argument");

        if (t == 'i' || t == 'b')
            args[j++] = (value_t)safe_value_to_int(v);
        else if (t == 'f') {
#ifdef __XTENSA__
            /* The Xtensa processor does not use a floating-point register when passing a float argumenbt.
               It uses an AR register as it uses for an integer argument.
               See Xtensa Instruction Set Architecture (ISA) Summary, Section 10.
            */
            float w = safe_value_to_float(v);
            args[j++] = *(value_t*)&w;
#else
            /* Arm32, Arm64, x86-64 uses a floating-point register for a float argument.
            */
            if (k < sizeof(fargs) / sizeof(fargs[0]))
                fargs[k++] = safe_value_to_float(v);
            else
                runtime_error("too many float arguments; not supported");
#endif
        }
        else
            args[j++] = v;
    }

    va_end(arguments);
    if (i != num || *sig != ')')
        runtime_error("wrong number of arguments for dynamic method call");

    char t = *++sig;
    if (t == 'f') {
        float r = ((float (*)(value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, float, float, float, float))fptr)
                        (obj, args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10], args[11], fargs[0], fargs[1], fargs[2], fargs[3]);
        return float_to_value(r);
    }
    else {
        value_t r = ((value_t (*)(value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, value_t, float, float, float, float))fptr)
                        (obj, args[0], args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], args[10], args[11], fargs[0], fargs[1], fargs[2], fargs[3]);
        if (t == 'i')
            return int_to_value(r);
        else if (t == 'b')
            return bool_to_value(r);
        else
            return r;
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
    fputs("** memory exhausted **", stderr);
#ifdef LINUX64
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
static pointer_t allocate_heap_base(uint16_t word_size) {
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
    return NULL;
}

static pointer_t allocate_heap(uint16_t word_size) {
    if (nested_interrupt_handler > 0) {
        runtime_memory_allocation_error("you cannot create objects in an interrupt handler.");
    }

    pointer_t ptr = allocate_heap_base(word_size);
    if (ptr != NULL)
        return ptr;
    else {
        gc_run();
        ptr = allocate_heap_base(word_size);
        if (ptr != NULL)
            return ptr;
        else
            return no_more_memory();
    }
}

struct gc_root_set* gc_root_set_head = NULL;

#define GET_MARK_BIT(ptr)      ((ptr)->header & 1)
#define CLEAR_MARK_BIT(ptr)    ((ptr)->header &= ~1)
#define SET_MARK_BIT(ptr)      ((ptr)->header |= 1)
#define WRITE_MARK_BIT(ptr,mark)  (mark ? SET_MARK_BIT(ptr) : CLEAR_MARK_BIT(ptr))

// Three colors are used to get object status during the marking phase.
// WHITE: The object which is not verified to be alive.
// GRAY: The object which is verified to be alive, but it's children aren't traced.
// BLACK: The object which is verified to be alive, and it's children are also traced.
#define IS_WHITE(ptr, mark)            (((ptr)->header & 1) != mark) 
#define IS_GRAY(ptr)                   (((ptr)->header & 0b10) == 0b10) 
#define IS_BLACK(ptr, mark)            (((ptr)->header & 1) == mark) 

// Handle gray bit.
// 0: The object is not gray.
// 1: The object is gray.
#define CLEAR_GRAY_BIT(ptr)                ((ptr)->header &= ~0b10)
#define SET_GRAY_BIT(ptr)                  ((ptr)->header |= 0b10)

#define STACK_SIZE      (HEAP_SIZE / 65)
static pointer_t gc_stack[STACK_SIZE];
static uint32_t gc_stack_top = 0;
static bool gc_stack_overflowed = false;

#define ISTACK_SIZE     (STACK_SIZE / 2)
static pointer_t gc_intr_stack[ISTACK_SIZE];    // used by interrupt handlers
static uint32_t gc_intr_stack_top = 0;

static void push_object_to_stack(pointer_t obj, uint32_t mark) {
    WRITE_MARK_BIT(obj, mark);
    SET_GRAY_BIT(obj);
    if (gc_stack_top < STACK_SIZE) 
        gc_stack[gc_stack_top++] = obj;
    else 
        gc_stack_overflowed = true;
}

#ifndef LINUX64
static portMUX_TYPE gc_mux = portMUX_INITIALIZER_UNLOCKED;
#endif

/* This barrier is invoked when a (possibly) reference value is stored
 * in a heap object.  It is not invoked when the value is stored in
 * a stack frame.
 * This is fine because an interrupt handler ends and clears its stack
 * frames before an interrupted garbage collector resumes.
*/
void gc_write_barrier(pointer_t obj, value_t value) {
    if (nested_interrupt_handler > 0 && gc_is_running) {
        if (is_ptr_value(value)) {
            uint32_t mark = current_no_mark ? 0 : 1;
            pointer_t ptr = value_to_ptr(value);
            if (IS_WHITE(ptr, mark) && (obj == NULL || IS_BLACK(obj, mark))) {
                GC_ENTER_CRITICAL(gc_mux);
                if (gc_intr_stack_top < ISTACK_SIZE) 
                    gc_intr_stack[gc_intr_stack_top++] = ptr;
                else {
                    WRITE_MARK_BIT(ptr, mark);
                    SET_GRAY_BIT(ptr);
                    gc_stack_overflowed = true;
                }
                GC_EXIT_CRITICAL(gc_mux);
            }
        }
    }
}

static void copy_from_intr_stack(uint32_t mark) {
    uint32_t num = gc_intr_stack_top;
    uint32_t i = 0;
    int failure;
    do {
        while (i < num)
            push_object_to_stack(gc_intr_stack[i++], mark);

        GC_ENTER_CRITICAL(gc_mux);
        if (num == gc_intr_stack_top) {
            failure = 0;
            gc_intr_stack_top = 0;
        }
        else {
            num = gc_intr_stack_top;
            failure = 1;
        }
        GC_EXIT_CRITICAL(gc_mux);
    } while (failure);
}

static void trace_from_an_object(uint32_t mark) {
    while (gc_stack_top > 0) {
        pointer_t obj = gc_stack[--gc_stack_top];
        class_object* clazz = get_objects_class(obj);
        int32_t j = class_has_pointers(clazz);
        CLEAR_GRAY_BIT(obj);
        if (HAS_POINTER(j)) {
            uint32_t size = object_size(obj, clazz);
            for (; j < size; j++) {
                value_t next = obj->body[j];
                if (is_ptr_value(next) && next != VALUE_NULL) {
                    pointer_t nextp = value_to_ptr(next);
                    if (GET_MARK_BIT(nextp) != mark) {    // not visisted yet
                        push_object_to_stack(nextp, mark);
                    }
                }
            }
        }
    }
}

// run this when a depth-first search fails due to stack overflow.
static void scan_and_mark_objects(uint32_t mark) {
    uint32_t start = 2;
    uint32_t end = heap_memory[0];
    while (start < HEAP_SIZE) {
        // scan objects between start and end
        while (start < end) {
            pointer_t obj = (pointer_t)&heap_memory[start];
            class_object* clazz = get_objects_class(obj);
            // int32_t j = class_has_pointers(clazz);
            uint32_t size = object_size(obj, clazz);
            if (IS_GRAY(obj)) {
                gc_stack[0] = obj;
                gc_stack_top = 1;
                if (gc_intr_stack_top > 0)
                    copy_from_intr_stack(mark);

                trace_from_an_object(mark);
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
}

static void mark_objects(struct gc_root_set* root_set, uint32_t mark) {
    gc_stack_overflowed = false;
    while (root_set != NULL) {
        for (int i = 0; i < root_set->length; i++) {
            value_t v = root_set->values[i];
            if (is_ptr_value(v) && v != VALUE_NULL) {
                pointer_t rootp = value_to_ptr(v);
                if (GET_MARK_BIT(rootp) != mark) {    // not visisted yet
                    WRITE_MARK_BIT(rootp, mark);
                    SET_GRAY_BIT(rootp);
                    gc_stack[0] = rootp;
                    gc_stack_top = 1;
                    if (gc_intr_stack_top > 0)
                        copy_from_intr_stack(mark);

                    trace_from_an_object(mark);
                }
            }
        }

        root_set = root_set->next;
    }

    do {
        while (gc_stack_overflowed) {
            gc_stack_overflowed = false;
            scan_and_mark_objects(mark);
        }

        if (gc_intr_stack_top > 0) {
            gc_stack_top = 0;
            copy_from_intr_stack(mark);
            trace_from_an_object(mark);
        }
    } while (gc_stack_overflowed || gc_intr_stack_top > 0);
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
    gc_is_running = true;
    uint32_t mark = current_no_mark ? 0 : 1;
    mark_objects(gc_root_set_head, mark);
    sweep_objects(mark);
    current_no_mark = mark;
    gc_is_running = false;
}

#ifdef LINUX64
uint32_t gc_test_run() {
    gc_is_running = true;
    return current_no_mark ? 0 : 1;
}
#endif

// when you modify this function, also modify ROOT_SET_N macro.
void gc_init_rootset(struct gc_root_set* set, uint32_t length) {
    set->next = gc_root_set_head;
    if (length > 0) {
        gc_root_set_head = set;
        set->length = length;
        for (uint32_t i = 0; i < length; i++)
            set->values[i] = VALUE_UNDEF;
    }
}

extern CR_SECTION int32_t value_to_int(value_t v);
extern CR_SECTION value_t int_to_value(int32_t v);
extern CR_SECTION bool is_int_value(value_t v);

extern CR_SECTION bool is_float_value(value_t v);

extern CR_SECTION pointer_t value_to_ptr(value_t v);
extern CR_SECTION value_t ptr_to_value(pointer_t v);
extern CR_SECTION bool is_ptr_value(value_t v);

extern CR_SECTION value_t bool_to_value(bool b);
extern CR_SECTION bool value_to_bool(value_t v);
extern CR_SECTION bool is_bool_value(value_t v);
extern CR_SECTION bool safe_value_to_bool(value_t v);

extern CR_SECTION value_t gc_new_object(const class_object* clazz);
extern CR_SECTION value_t get_obj_property(value_t obj, int index);
extern CR_SECTION value_t set_obj_property(value_t obj, int index, value_t new_value);
extern CR_SECTION value_t set_global_variable(value_t* ptr, value_t new_value);
extern CR_SECTION int32_t* get_obj_int_property(value_t obj, int index);
extern CR_SECTION float* get_obj_float_property(value_t obj, int index);
