
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

int32_t _RESULT;
int32_t _count;
extern struct func_body _swap;
extern struct func_body _permute;
extern struct func_body _verify_result;
extern struct func_body _benchamrk;
extern CLASS_OBJECT(object_class, 1);
extern struct func_body _assert;
void bluescript_main8();
ROOT_SET_DECL(global_rootset8, 0)

static void fbody_swap(value_t self, value_t _v, int32_t _i, int32_t _j) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _v;
  {
    int32_t _tmp = (*gc_intarray_get(func_rootset.values[0], _i));
    (*gc_intarray_get(func_rootset.values[0], _i)) = (*gc_intarray_get(func_rootset.values[0], _j));
    (*gc_intarray_get(func_rootset.values[0], _j)) = _tmp;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _swap = { fbody_swap, "([iii)v" };

static void fbody_permute(value_t self, value_t _v, int32_t _n) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _v;
  {
    _count += 1;
    if (_n != 0) {
      int32_t _n1 = _n - 1;
      ((void (*)(value_t, value_t, int32_t))_permute.fptr)(0, func_rootset.values[0], _n1);
      for (
      int32_t _i = _n1;_i > -1; (_i)--) {
        ((void (*)(value_t, value_t, int32_t, int32_t))_swap.fptr)(0, func_rootset.values[0], _n1, _i);
        ((void (*)(value_t, value_t, int32_t))_permute.fptr)(0, func_rootset.values[0], _n1);
        ((void (*)(value_t, value_t, int32_t, int32_t))_swap.fptr)(0, func_rootset.values[0], _n1, _i);
      }
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _permute = { fbody_permute, "([ii)v" };

static int32_t fbody_verify_result(value_t self, int32_t _result) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { int32_t ret_value_ = (_result == _RESULT); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _verify_result = { fbody_verify_result, "(i)b" };

static void fbody_benchamrk(value_t self, int32_t _cycle) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[0] = self;
  {
    for (
    int32_t _i = 0;_i < _cycle; (_i)++) {
      _count = 0;
      func_rootset.values[1] = gc_new_intarray(6, 0);
      ((void (*)(value_t, value_t, int32_t))_permute.fptr)(0, func_rootset.values[1], 6);
      ((void (*)(value_t, int32_t))_assert.fptr)(0, ((int32_t (*)(value_t, int32_t))_verify_result.fptr)(0, _count));
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _benchamrk = { fbody_benchamrk, "(i)v" };

void bluescript_main8() {
  ROOT_SET_INIT(global_rootset8, 0)
  
  _RESULT = 8660;
  _count = 0;
  ((void (*)(value_t, int32_t))_benchamrk.fptr)(0, 3);
  
}
