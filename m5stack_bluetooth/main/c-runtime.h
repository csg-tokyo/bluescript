// Copyright (C) 2022- Shigeru Chiba.  All rights reserved.

#ifndef __C_RUNTIME_H__
#define __C_RUNTIME_H__

#include <stdint.h>
#include <stdbool.h>

/*
    All values are 32bit.  Its type is value_t.

    xxxx ... xxxx xx00          30 bit integer
    xxxx ... xxxx xx01          IEEE 754 binary32 but 21 bit (not 23 bit) fraction
    xxxx ... xxxx xx11          32 bit address (4 byte aligned)
    xxxx ... xxxx xx10          not used

    A 32bit address points to a structure of object_type type.
*/

#ifdef BIT64
#define ALGIN __attribute__ ((aligned(8)))
#else
#define ALGIN __attribute__ ((aligned(4)))
#endif

typedef uint32_t value_t;

struct object_type {
    /*
      class_ptr:  30 bits (pointer to a class_object)
      unused: 1 bit
      gc mark: 1 bit
    */
    uint32_t header;
    value_t body[1];
};

typedef struct object_type* pointer_t;

typedef struct class_object {
    int32_t size;          // instance size excluding a header.
                            // -1 if the instance is a variable-length array.
                            // Its size is stored in body[0].
    uint32_t is_raw_data;   // true if body does not contain pointers.
    uintptr_t body[1];
} class_object;

// A macro for declaring a class_object.
// n: the length of body (> 0).
#define CLASS_OBJECT(name, n)    ALGIN const union { struct class_object clazz; struct { uint32_t s; uint32_t i; uintptr_t body[n]; } body; } name

inline int32_t value_to_int(value_t v) { return (int32_t)v / 4; }
inline value_t int_to_value(int32_t v) { return (uint32_t)v << 2; }
inline bool is_int_value(value_t v) { return (v & 3) == 0; }

inline float value_to_float(value_t v) {
    value_t f = v & 0xfffffffc;
    return *(float*)&f;
}

inline value_t float_to_value(float v) { return (*(uint32_t*)&v & 0xfffffffc) | 1; }
inline bool is_float_value(value_t v) { return (v & 3) == 1; }

#ifdef BIT64
extern pointer_t gc_heap_pointer(pointer_t ptr);
inline pointer_t value_to_ptr(value_t v) { return gc_heap_pointer((pointer_t)((uint64_t)v & 0xfffffffc)); }
#else
inline pointer_t value_to_ptr(value_t v) { return (pointer_t)(v & 0xfffffffc); }
#endif

inline value_t ptr_to_value(pointer_t v) { return (value_t)(((uintptr_t)v & 0xfffffffc) | 3); }
inline bool is_ptr_value(value_t v) { return (v & 3) == 3; }

#define VALUE_NULL    3         // null pointer: 0000 ... 0011
#define VALUE_UNDEF   0
#define VALUE_ZERO    0         // integer 0
#define VALUE_FZERO   1         // float 0.0
#define VALUE_FALSE   0         // 0000 ... 0000 (integer 0)
#define VALUE_TRUE    4         // 0000 ... 0100 (integer 1)

inline value_t bool_to_value(bool b) { return b ? VALUE_TRUE : VALUE_FALSE; }
inline bool value_to_bool(value_t v) { return v != VALUE_FALSE; }

inline value_t get_obj_property(value_t obj, int index) {
    return value_to_ptr(obj)->body[index];
}

inline void set_obj_property(value_t obj, int index, value_t new_value) {
    value_to_ptr(obj)->body[index] = new_value;
}

struct gc_root_set {
    struct gc_root_set* next;
    uint32_t length;
    value_t values[1];
};

#define ROOT_SET(name,n)     struct { struct gc_root_set* next; uint32_t length; value_t values[n]; } name;\
gc_init_rootset((struct gc_root_set*)&name, n);

#define ROOT_SET_DECL(name,n)     struct { struct gc_root_set* next; uint32_t length; value_t values[n]; } name;
#define ROOT_SET_INIT(name,n)     gc_init_rootset((struct gc_root_set*)&name, n);

#define DELETE_ROOT_SET(name)     { gc_root_set_head = name.next; }

extern int32_t try_and_catch(void (*main_function)());

extern int32_t safe_value_to_int(value_t v);
extern float safe_value_to_float(value_t v);
extern bool safe_value_to_bool(value_t v);
extern bool value_to_truefalse(value_t v);

extern value_t any_add(value_t a, value_t b);
extern value_t any_subtract(value_t a, value_t b);
extern value_t any_multiply(value_t a, value_t b);
extern value_t any_divide(value_t a, value_t b);

extern bool any_less(value_t a, value_t b);
extern bool any_less_eq(value_t a, value_t b);
extern bool any_greater(value_t a, value_t b);
extern bool any_greater_eq(value_t a, value_t b);

extern value_t any_add_assign(value_t* a, value_t b);
extern value_t any_subtract_assign(value_t* a, value_t b);
extern value_t any_multiply_assign(value_t* a, value_t b);
extern value_t any_divide_assign(value_t* a, value_t b);

extern value_t any_increment(value_t* expr);
extern value_t any_decrement(value_t* expr);
extern value_t any_post_increment(value_t* expr);
extern value_t any_post_decrement(value_t* expr);

extern value_t minus_any_value(value_t v);

extern void gc_initialize();
extern class_object* gc_get_class_of(value_t value);
extern pointer_t gc_allocate_object(const class_object* clazz);
extern value_t gc_new_string(char* str);
extern bool gc_is_string_literal(value_t obj);
extern char* gc_string_literal_cstr(value_t obj);

extern value_t gc_new_bytearray(int32_t n);
extern value_t gc_bytearray_size(value_t obj);
extern value_t gc_bytearray_get(value_t obj, value_t index);
extern value_t gc_bytearray_set(value_t obj, value_t index, value_t new_value);
extern value_t* gc_bytearray_set_raw_word(value_t obj, int32_t index, uint32_t new_value);

extern value_t gc_new_vector(int32_t n);
extern value_t gc_vector_size(value_t obj); 
extern value_t gc_vector_get(value_t obj, value_t index);
extern value_t gc_vector_set(value_t obj, value_t index, value_t new_value);

// extern value_t gc_allocate_array(int32_t n);
extern value_t gc_make_array(int32_t n, ...);
extern value_t gc_array_length(value_t obj);
extern value_t* gc_array_get(value_t obj, int32_t index);
extern value_t gc_array_set(value_t obj, value_t index, value_t new_value);

extern void gc_init_rootset(struct gc_root_set* set, uint32_t length);
extern void gc_run();

extern struct gc_root_set* gc_root_set_head;

#endif
