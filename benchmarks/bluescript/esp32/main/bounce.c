
#include "c-runtime.h"
#include "utils.c"

#define WARMUP 0
#define CYCLE 2
#define TAG "bounce"


int32_t _RESULT;
int32_t _randomSeed;
extern struct _randomNext {
  int32_t (*fptr)();
  const char* sig; } _randomNext;
int32_t _x;
int32_t _y;
int32_t _xVel;
int32_t _yVel;
extern struct _ballBounce {
  int32_t (*fptr)(value_t);
  const char* sig; } _ballBounce;
extern struct _bounce {
  int32_t (*fptr)();
  const char* sig; } _bounce;
extern struct _verify_result {
  int32_t (*fptr)(int32_t);
  const char* sig; } _verify_result;
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

static int32_t fbody_ballBounce(value_t _ball) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = _ball;
  {
    int32_t _xLimit = 500;
    int32_t _yLimit = 500;
    int32_t _bounced = VALUE_FALSE;
    (*gc_array_get(func_rootset.values[0], _x)) = int_to_value(safe_value_to_int(*gc_array_get(func_rootset.values[0], _x)) + safe_value_to_int(*gc_array_get(func_rootset.values[0], _xVel)));
    (*gc_array_get(func_rootset.values[0], _y)) = int_to_value(safe_value_to_int(*gc_array_get(func_rootset.values[0], _y)) + safe_value_to_int(*gc_array_get(func_rootset.values[0], _yVel)));
    if (safe_value_to_int(*gc_array_get(func_rootset.values[0], _x)) > _xLimit) {
      (*gc_array_get(func_rootset.values[0], _x)) = int_to_value(_xLimit);
      (*gc_array_get(func_rootset.values[0], _xVel)) = int_to_value(-_abs.fptr(safe_value_to_int(*gc_array_get(func_rootset.values[0], _xVel))));
      _bounced = VALUE_TRUE;
    }
    if (safe_value_to_int(*gc_array_get(func_rootset.values[0], _x)) < 0) {
      (*gc_array_get(func_rootset.values[0], _x)) = int_to_value(0);
      (*gc_array_get(func_rootset.values[0], _xVel)) = int_to_value(_abs.fptr(safe_value_to_int(*gc_array_get(func_rootset.values[0], _xVel))));
      _bounced = VALUE_TRUE;
    }
    if (safe_value_to_int(*gc_array_get(func_rootset.values[0], _y)) > _yLimit) {
      (*gc_array_get(func_rootset.values[0], _y)) = int_to_value(_yLimit);
      (*gc_array_get(func_rootset.values[0], _yVel)) = int_to_value(-_abs.fptr(safe_value_to_int(*gc_array_get(func_rootset.values[0], _yVel))));
      _bounced = VALUE_TRUE;
    }
    if (safe_value_to_int(*gc_array_get(func_rootset.values[0], _y)) < 0) {
      (*gc_array_get(func_rootset.values[0], _y)) = int_to_value(0);
      (*gc_array_get(func_rootset.values[0], _yVel)) = int_to_value(_abs.fptr(safe_value_to_int(*gc_array_get(func_rootset.values[0], _yVel))));
      _bounced = VALUE_TRUE;
    }
    { int32_t ret_value_ = (_bounced); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _ballBounce _ballBounce = { fbody_ballBounce, "([i)b" };

static int32_t fbody_bounce() {
  ROOT_SET(func_rootset, 2)
  {
    _randomSeed = 74755;
    int32_t _ballCount = 100;
    int32_t _bounces = 0;
    func_rootset.values[0] = _newArray.fptr(_ballCount, func_rootset.values[1]=int_to_value(0));
    for (
    int32_t _i = 0;_i < _ballCount; _i++) {
      func_rootset.values[1] = gc_make_array(4, int_to_value(_randomNext.fptr() % 500), int_to_value(_randomNext.fptr() % 500), int_to_value((_randomNext.fptr() % 300) - 150), int_to_value((_randomNext.fptr() % 300) - 150));
      (*gc_array_get(func_rootset.values[0], _i)) = (func_rootset.values[1]);
    }
    for (
    int32_t _i = 0;_i < 50; _i++) {
      for (
      int32_t _b = 0;_b < _ballCount; _b++) {
        if (_ballBounce.fptr(func_rootset.values[1]=((*gc_array_get(func_rootset.values[0], _b))))) {
          _bounces+=1;
        }
      }
    }
    { int32_t ret_value_ = (_bounces); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _bounce _bounce = { fbody_bounce, "()i" };

static int32_t fbody_verify_result(int32_t _result) {
  ROOT_SET(func_rootset, 0)
  {
    { int32_t ret_value_ = (_result == _RESULT); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _verify_result _verify_result = { fbody_verify_result, "(i)b" };

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 0)
  ROOT_SET(func_rootset, 0)
  _RESULT = 1331;
  _randomSeed = 74755;
  _x = 0;
  _y = 1;
  _xVel = 2;
  _yVel = 3;
  _result = _bounce.fptr();
  _assert.fptr(_verify_result.fptr(_result));
  DELETE_ROOT_SET(func_rootset)
}
