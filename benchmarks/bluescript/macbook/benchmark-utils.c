#include <stdio.h>
#include <stdlib.h>
#include "../../../m5stack_bluetooth/main/c-runtime.h"
#include "assert.h"
#include "math.h"

value_t fbody_newArray(int32_t size, value_t init) {
    ROOT_SET(func_rootset, 1)
    {
        func_rootset.values[0] = gc_new_array(size);
        for (int32_t i = 0; i < size; i++) {
            (*gc_array_get(func_rootset.values[0], i)) = init;
        }

        { value_t ret_value_ = (func_rootset.values[0]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
}

struct _newArray { value_t (*fptr)(int32_t size, value_t init); const char* sig; } _newArray = { fbody_newArray, "" };


int32_t fbody_arrayLength(value_t arr) {
    value_t length = gc_array_length(arr);
    return length >> 2;
}

struct _arrayLength { int32_t (*fptr)(value_t); const char* sig; } _arrayLength = { fbody_arrayLength, "" };


void fbody_assert(int32_t test) {
    assert(test);
}

struct _assert { void (*fptr)(int32_t); const char* sig; } _assert = { fbody_assert, "" };


float fbody_sqrt(float f) {
    return sqrt(f);
}

struct _sqrt { float (*fptr)(float); const char* sig; } _sqrt = { fbody_sqrt, "" };

int32_t fbody_abs(int32_t i) {
    return abs(i);
}

struct _abs { int32_t (*fptr)(int32_t); const char* sig; } _abs = { fbody_abs, "" };

float fbody_fabs(float f) {
    return fabsf(f);
}

struct _fabs { float (*fptr)(float); const char* sig; } _fabs = { fbody_fabs, "" };


void fbody_console_log_float(float f) {
    printf("%f\n", f);
}

struct _console_log_float { void (*fptr)(float); const char* sig; } _console_log_float = { fbody_console_log_float, "" };

