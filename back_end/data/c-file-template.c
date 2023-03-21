#include <stdint.h>
#include <stdbool.h>

typedef uint32_t value_t;
#define VALUE_NULL    3         // null pointer: 0000 ... 0011
#define VALUE_UNDEF   0
#define VALUE_FALSE   0         // 0000 ... 0000 (integer 0)
#define VALUE_TRUE    4         // 0000 ... 0100 (integer 1)

static inline int32_t value_to_int(value_t v) { return (int32_t)v / 4; }
static inline value_t int_to_value(int32_t v) { return (uint32_t)v << 2; }
static inline bool is_int_value(value_t v) { return (v & 3) == 0; }

static inline float value_to_float(value_t v) {
    value_t f = v & 0xfffffffc;
    return *(float*)&f;
}

static inline value_t float_to_value(float v) { return (*(uint32_t*)&v & 0xfffffffc) | 1; }
static inline bool is_float_value(value_t v) { return (v & 3) == 1; }

static inline value_t bool_to_value(bool b) { return b ? VALUE_TRUE : VALUE_FALSE; }
static inline bool value_to_bool(value_t v) { return v != VALUE_FALSE; }

#define ROOT_SET(name,n)     struct { struct gc_root_set* next; uint32_t length; value_t values[n]; } name;
#define DELETE_ROOT_SET(name)     { gc_root_set_head = name.next; }

