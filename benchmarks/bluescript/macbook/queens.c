
#include "c-runtime.h"
#include "utils.c"

extern struct _setRowColumn {
  void (*fptr)(int32_t, int32_t, int32_t);
  const char* sig; } _setRowColumn;
extern struct _getRowColumn {
  int32_t (*fptr)(int32_t, int32_t);
  const char* sig; } _getRowColumn;
extern struct _placeQueen {
  int32_t (*fptr)(int32_t);
  const char* sig; } _placeQueen;
extern struct _queens {
  int32_t (*fptr)();
  const char* sig; } _queens;
extern struct _verifyResult {
  int32_t (*fptr)(int32_t);
  const char* sig; } _verifyResult;
int32_t _result;
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 4)

static void fbody_setRowColumn(int32_t _r, int32_t _c, int32_t _v) {
  ROOT_SET(func_rootset, 0)
  {
    (*gc_array_get(global_rootset2.values[0], _r)) = bool_to_value(_v);
    (*gc_array_get(global_rootset2.values[1], _c + _r)) = bool_to_value(_v);
    (*gc_array_get(global_rootset2.values[2], _c - _r + 7)) = bool_to_value(_v);
  }
  DELETE_ROOT_SET(func_rootset)
}
struct _setRowColumn _setRowColumn = { fbody_setRowColumn, "(iib)v" };

static int32_t fbody_getRowColumn(int32_t _r, int32_t _c) {
  ROOT_SET(func_rootset, 0)
  {
    { int32_t ret_value_ = (value_to_truefalse((*gc_array_get(global_rootset2.values[0], _r)))&&value_to_truefalse((*gc_array_get(global_rootset2.values[1], _c + _r)))&&value_to_truefalse((*gc_array_get(global_rootset2.values[2], _c - _r + 7)))); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _getRowColumn _getRowColumn = { fbody_getRowColumn, "(ii)b" };

static int32_t fbody_placeQueen(int32_t _c) {
  ROOT_SET(func_rootset, 0)
  {
    for (
    int32_t _r = 0;_r < 8; _r++) {
      if (_getRowColumn.fptr(_r, _c)) {
        (*gc_array_get(global_rootset2.values[3], _r)) = int_to_value(_c);
        _setRowColumn.fptr(_r, _c, VALUE_FALSE);
        if (_c == 7) {
          { int32_t ret_value_ = (VALUE_TRUE); DELETE_ROOT_SET(func_rootset); return ret_value_; }
        }
        if (_placeQueen.fptr(_c + 1)) {
          { int32_t ret_value_ = (VALUE_TRUE); DELETE_ROOT_SET(func_rootset); return ret_value_; }
        }
        _setRowColumn.fptr(_r, _c, VALUE_TRUE);
      }
    }
    { int32_t ret_value_ = (VALUE_FALSE); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _placeQueen _placeQueen = { fbody_placeQueen, "(i)b" };

static int32_t fbody_queens() {
  ROOT_SET(func_rootset, 1)
  {
    global_rootset2.values[0] = _newArray.fptr(8, func_rootset.values[0]=bool_to_value(VALUE_TRUE));
    global_rootset2.values[1] = _newArray.fptr(16, func_rootset.values[0]=bool_to_value(VALUE_TRUE));
    global_rootset2.values[2] = _newArray.fptr(16, func_rootset.values[0]=bool_to_value(VALUE_TRUE));
    global_rootset2.values[3] = _newArray.fptr(8, func_rootset.values[0]=int_to_value(-1));
    { int32_t ret_value_ = (_placeQueen.fptr(0)); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _queens _queens = { fbody_queens, "()b" };

static int32_t fbody_verifyResult(int32_t _result) {
  ROOT_SET(func_rootset, 0)
  {
    { int32_t ret_value_ = (_result); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _verifyResult _verifyResult = { fbody_verifyResult, "(b)b" };

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 4)
  ROOT_SET(func_rootset, 0)
  global_rootset2.values[0] = 0;
  global_rootset2.values[1] = 0;
  global_rootset2.values[2] = 0;
  global_rootset2.values[3] = 0;
  _result = VALUE_TRUE;
  for (
  int32_t _i = 0;_i < 10; _i++) {
    _result = _result&&_queens.fptr();
  }
  _assert.fptr(_verifyResult.fptr(_result));
  DELETE_ROOT_SET(func_rootset)
}
