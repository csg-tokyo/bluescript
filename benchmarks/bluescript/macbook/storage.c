
#include "c-runtime.h"
#include "utils.c"

int32_t _RESULT;
int32_t _randomSeed;
extern struct _randomNext {
  int32_t (*fptr)();
  const char* sig; } _randomNext;
int32_t _count;
extern struct _buildTreeDepth {
  value_t (*fptr)(int32_t);
  const char* sig; } _buildTreeDepth;
extern struct _storage {
  int32_t (*fptr)();
  const char* sig; } _storage;
extern struct _verifyResult {
  int32_t (*fptr)(int32_t);
  const char* sig; } _verifyResult;
int32_t _result;
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 0)

static int32_t fbody_randomNext() {
  ROOT_SET(func_rootset, 0)
  {
    _randomSeed = ((_randomSeed * 1309) + 13849) & 65535;
    { int32_t ret_value_ = (_randomSeed); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _randomNext _randomNext = { fbody_randomNext, "()i" };

static value_t fbody_buildTreeDepth(int32_t _depth) {
  ROOT_SET(func_rootset, 2)
  {
    _count+=1;
    if (_depth == 1) {
      { value_t ret_value_ = (_newArray.fptr(_randomNext.fptr() % 10 + 1, func_rootset.values[1]=int_to_value(0))); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    func_rootset.values[0] = _newArray.fptr(4, func_rootset.values[1]=int_to_value(0));
    for (
    int32_t _i = 0;_i < 4; _i++) {
      (*gc_array_get(func_rootset.values[0], _i)) = (_buildTreeDepth.fptr(_depth - 1));
    }
    { value_t ret_value_ = (func_rootset.values[0]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _buildTreeDepth _buildTreeDepth = { fbody_buildTreeDepth, "(i)[a" };

static int32_t fbody_storage() {
  ROOT_SET(func_rootset, 0)
  {
    _randomSeed = 74755;
    _randomSeed = 0;
    _buildTreeDepth.fptr(7);
    { int32_t ret_value_ = (_count); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _storage _storage = { fbody_storage, "()i" };

static int32_t fbody_verifyResult(int32_t _result) {
  ROOT_SET(func_rootset, 0)
  {
    { int32_t ret_value_ = (_result == _RESULT); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _verifyResult _verifyResult = { fbody_verifyResult, "(i)b" };

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 0)
  ROOT_SET(func_rootset, 0)
  _RESULT = 5461;
  _randomSeed = 74755;
  _count = 0;
  _result = _storage.fptr();
  _assert.fptr(_verifyResult.fptr(_result));
  DELETE_ROOT_SET(func_rootset)
}
