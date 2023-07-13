
#include "c-runtime.h"
#include "utils.c"

#define WARMUP 1
#define TIMES 3


int32_t _SIZE;
int32_t _RESULT;
extern struct _sieve {
  int32_t (*fptr)(value_t, int32_t);
  const char* sig; } _sieve;
extern struct _verify_result {
  int32_t (*fptr)(int32_t);
  const char* sig; } _verify_result;
int32_t _result;
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 1)

static int32_t fbody_sieve(value_t _flags, int32_t _size) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = _flags;
  {
    int32_t _primeCount = 0;
    for (
    int32_t _i = 2;_i < _size + 1; _i++) {
      if (value_to_truefalse((*gc_array_get(func_rootset.values[0], _i - 1)))) {
        _primeCount+=1;
        int32_t _k = _i * 2;
        while (_k <= _size) {
          (*gc_array_get(func_rootset.values[0], _k - 1)) = bool_to_value(VALUE_FALSE);
          _k+=_i;
        }
      }
    }
    { int32_t ret_value_ = (_primeCount); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _sieve _sieve = { fbody_sieve, "([ai)i" };

static int32_t fbody_verify_result(int32_t _result) {
  ROOT_SET(func_rootset, 0)
  {
    { int32_t ret_value_ = (_result == _RESULT); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _verify_result _verify_result = { fbody_verify_result, "(i)b" };

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 1)
  ROOT_SET(func_rootset, 1)
  _SIZE = 5000;
  _RESULT = 669;
  global_rootset2.values[0] = _newArray.fptr(_SIZE, func_rootset.values[0]=bool_to_value(VALUE_TRUE));
  _result = _sieve.fptr(func_rootset.values[0]=global_rootset2.values[0], _SIZE);
  _assert.fptr(_verify_result.fptr(_result));
  DELETE_ROOT_SET(func_rootset)
}
