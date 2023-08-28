
#include "c-runtime.h"
#include "utils.c"

int32_t _RESULT;
int32_t _val;
int32_t _next;
extern struct _listLength {
  int32_t (*fptr)(value_t);
  const char* sig; } _listLength;
extern struct _isShorterThan {
  int32_t (*fptr)(value_t, value_t);
  const char* sig; } _isShorterThan;
extern struct _tail {
  value_t (*fptr)(value_t, value_t, value_t);
  const char* sig; } _tail;
extern struct _makeList {
  value_t (*fptr)(int32_t);
  const char* sig; } _makeList;
extern struct _list {
  int32_t (*fptr)();
  const char* sig; } _list;
extern struct _verifyResult {
  int32_t (*fptr)(int32_t);
  const char* sig; } _verifyResult;
int32_t _result;
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 0)

static int32_t fbody_listLength(value_t _e) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[0] = _e;
  {
    if (_arrayLength.fptr(func_rootset.values[1]=((*gc_array_get(func_rootset.values[0], _next)))) == 0) {
      { int32_t ret_value_ = (1); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    { int32_t ret_value_ = (1 + _listLength.fptr(func_rootset.values[1]=((*gc_array_get(func_rootset.values[0], _next))))); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _listLength _listLength = { fbody_listLength, "([a)i" };

static int32_t fbody_isShorterThan(value_t _x, value_t _y) {
  ROOT_SET(func_rootset, 5)
  func_rootset.values[0] = _x;
  func_rootset.values[1] = _y;
  {
    func_rootset.values[2] = func_rootset.values[0];
    func_rootset.values[3] = func_rootset.values[1];
    while (_arrayLength.fptr(func_rootset.values[4]=((*gc_array_get(func_rootset.values[3], _next)))) != 0) {
      if (_arrayLength.fptr(func_rootset.values[4]=((*gc_array_get(func_rootset.values[2], _next)))) == 0) {
        { int32_t ret_value_ = (VALUE_TRUE); DELETE_ROOT_SET(func_rootset); return ret_value_; }
      }
      func_rootset.values[2] = (*gc_array_get(func_rootset.values[2], _next));
      func_rootset.values[3] = (*gc_array_get(func_rootset.values[3], _next));
    }
    { int32_t ret_value_ = (VALUE_FALSE); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _isShorterThan _isShorterThan = { fbody_isShorterThan, "([a[a)b" };

static value_t fbody_tail(value_t _x, value_t _y, value_t _z) {
  ROOT_SET(func_rootset, 9)
  func_rootset.values[0] = _x;
  func_rootset.values[1] = _y;
  func_rootset.values[2] = _z;
  {
    if (_isShorterThan.fptr(func_rootset.values[3]=func_rootset.values[1], func_rootset.values[4]=func_rootset.values[0])) {
      { value_t ret_value_ = (_tail.fptr(func_rootset.values[3]=_tail.fptr(func_rootset.values[4]=((*gc_array_get(func_rootset.values[0], _next))), func_rootset.values[5]=func_rootset.values[1], func_rootset.values[6]=func_rootset.values[2]), func_rootset.values[4]=_tail.fptr(func_rootset.values[5]=((*gc_array_get(func_rootset.values[1], _next))), func_rootset.values[6]=func_rootset.values[2], func_rootset.values[7]=func_rootset.values[0]), func_rootset.values[5]=_tail.fptr(func_rootset.values[6]=((*gc_array_get(func_rootset.values[2], _next))), func_rootset.values[7]=func_rootset.values[0], func_rootset.values[8]=func_rootset.values[1]))); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    { value_t ret_value_ = (func_rootset.values[2]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _tail _tail = { fbody_tail, "([a[a[a)[a" };

static value_t fbody_makeList(int32_t _length) {
  ROOT_SET(func_rootset, 1)
  {
    if (_length == 0) {
      { value_t ret_value_ = (gc_make_array(0)); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    func_rootset.values[0] = gc_make_array(2, int_to_value(_length), (gc_make_array(0)));
    (*gc_array_get(func_rootset.values[0], _next)) = (_makeList.fptr(_length - 1));
    { value_t ret_value_ = (func_rootset.values[0]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _makeList _makeList = { fbody_makeList, "(i)[a" };

static int32_t fbody_list() {
  ROOT_SET(func_rootset, 4)
  {
    func_rootset.values[0] = _tail.fptr(func_rootset.values[1]=_makeList.fptr(15), func_rootset.values[2]=_makeList.fptr(10), func_rootset.values[3]=_makeList.fptr(6));
    { int32_t ret_value_ = (_listLength.fptr(func_rootset.values[1]=func_rootset.values[0])); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _list _list = { fbody_list, "()i" };

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
  _RESULT = 10;
  _val = 0;
  _next = 0;
  _result = _list.fptr();
  _assert.fptr(_verifyResult.fptr(_result));
  DELETE_ROOT_SET(func_rootset)
}
