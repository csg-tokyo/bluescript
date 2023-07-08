#include <stdio.h>
#include "c-runtime.h"
#include "assert.h"

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


void fbody_assert(int32_t test) {
    assert(test);
}

struct _assert { void (*fptr)(int32_t); const char* sig; } _assert = { fbody_assert, "" };
