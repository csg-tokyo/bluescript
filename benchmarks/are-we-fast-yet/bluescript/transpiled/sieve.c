
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

int32_t _SIZE;
int32_t _RESULT;
extern struct func_body _sieve;
extern struct func_body _verify_result;
extern struct func_body _benchamrk;
extern CLASS_OBJECT(object_class, 1);
extern struct func_body _assert;
void bluescript_main6();
ROOT_SET_DECL(global_rootset6, 0)

static int32_t fbody_sieve(value_t self, value_t _flags, int32_t _size) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _flags;
  {
    int32_t _primeCount = 0;
    for (
    int32_t _i = 2;_i < _size + 1; (_i)++) {
      if ((*gc_bytearray_get(func_rootset.values[0], _i - 1))) {
        _primeCount += 1;
        int32_t _k = _i * 2;
        while (_k <= _size) {
          (*gc_bytearray_get(func_rootset.values[0], _k - 1)) = VALUE_FALSE;
          _k += _i;
        }
      }
    }
    { int32_t ret_value_ = (_primeCount); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _sieve = { fbody_sieve, "([bi)i" };

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
      func_rootset.values[1] = gc_new_bytearray(_SIZE, VALUE_TRUE);
      int32_t _result = ((int32_t (*)(value_t, value_t, int32_t))_sieve.fptr)(0, func_rootset.values[1], _SIZE);
      ((void (*)(value_t, int32_t))_assert.fptr)(0, ((int32_t (*)(value_t, int32_t))_verify_result.fptr)(0, _result));
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _benchamrk = { fbody_benchamrk, "(i)v" };

void bluescript_main6() {
  ROOT_SET_INIT(global_rootset6, 0)
  
  _SIZE = 5000;
  _RESULT = 669;
  ((void (*)(value_t, int32_t))_benchamrk.fptr)(0, 3);
  
}
