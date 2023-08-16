
#include "c-runtime.h"
#include "utils.c"

#define WARMUP 0
#define CYCLE 3
#define TAG "permute"

int32_t _RESULT;
extern struct _swap {
  void (*fptr)(value_t, int32_t, int32_t);
  const char* sig; } _swap;
extern struct _permute {
  void (*fptr)(int32_t);
  const char* sig; } _permute;
extern struct _verify_result {
  int32_t (*fptr)(int32_t);
  const char* sig; } _verify_result;
int32_t _count;
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 1)

static void fbody_swap(value_t _v, int32_t _i, int32_t _j) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = _v;
  {
    int32_t _tmp = safe_value_to_int(*gc_array_get(func_rootset.values[0], _i));
    (*gc_array_get(func_rootset.values[0], _i)) = int_to_value(safe_value_to_int(*gc_array_get(func_rootset.values[0], _j)));
    (*gc_array_get(func_rootset.values[0], _j)) = int_to_value(_tmp);
  }
  DELETE_ROOT_SET(func_rootset)
}
struct _swap _swap = { fbody_swap, "([iii)v" };

static void fbody_permute(int32_t _n) {
  ROOT_SET(func_rootset, 1)
  {
    _count+=1;
    if (_n != 0) {
      int32_t _n1 = _n - 1;
      _permute.fptr(_n1);
      for (
      int32_t _i = _n1;_i > -1; _i--) {
        _swap.fptr(func_rootset.values[0]=global_rootset2.values[0], _n1, _i);
        _permute.fptr(_n1);
        _swap.fptr(func_rootset.values[0]=global_rootset2.values[0], _n1, _i);
      }
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct _permute _permute = { fbody_permute, "(i)v" };

static int32_t fbody_verify_result(int32_t _result) {
  ROOT_SET(func_rootset, 0)
  {
    { int32_t ret_value_ = (_result == _RESULT); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _verify_result _verify_result = { fbody_verify_result, "(i)b" };

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 1)
  ROOT_SET(func_rootset, 0)
  _RESULT = 8660;
  _count = 0;
  global_rootset2.values[0] = gc_make_array(6, int_to_value(0), int_to_value(0), int_to_value(0), int_to_value(0), int_to_value(0), int_to_value(0));
  _permute.fptr(6);
  _assert.fptr(_verify_result.fptr(_count));
  DELETE_ROOT_SET(func_rootset)
}
