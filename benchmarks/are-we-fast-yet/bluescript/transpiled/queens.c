
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

extern struct func_body _setRowColumn;
extern struct func_body _getRowColumn;
extern struct func_body _placeQueen;
extern struct func_body _queens;
extern struct func_body _verifyResult;
extern struct func_body _benchamrk;
extern CLASS_OBJECT(object_class, 1);
extern struct func_body _assert;
void bluescript_main7();
ROOT_SET_DECL(global_rootset7, 4)

static void fbody_setRowColumn(value_t self, int32_t _r, int32_t _c, int32_t _v) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    (*gc_bytearray_get(global_rootset7.values[0], _r)) = _v;
    (*gc_bytearray_get(global_rootset7.values[1], _c + _r)) = _v;
    (*gc_bytearray_get(global_rootset7.values[2], _c - _r + 7)) = _v;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _setRowColumn = { fbody_setRowColumn, "(iib)v" };

static int32_t fbody_getRowColumn(value_t self, int32_t _r, int32_t _c) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { int32_t ret_value_ = ((*gc_bytearray_get(global_rootset7.values[0], _r))&&(*gc_bytearray_get(global_rootset7.values[1], _c + _r))&&(*gc_bytearray_get(global_rootset7.values[2], _c - _r + 7))); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _getRowColumn = { fbody_getRowColumn, "(ii)b" };

static int32_t fbody_placeQueen(value_t self, int32_t _c) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    for (
    int32_t _r = 0;_r < 8; (_r)++) {
      if (((int32_t (*)(value_t, int32_t, int32_t))_getRowColumn.fptr)(0, _r, _c)) {
        (*gc_intarray_get(global_rootset7.values[3], _r)) = safe_value_to_int(int_to_value(_c));
        ((void (*)(value_t, int32_t, int32_t, int32_t))_setRowColumn.fptr)(0, _r, _c, VALUE_FALSE);
        if (_c == 7) {
          { int32_t ret_value_ = (VALUE_TRUE); DELETE_ROOT_SET(func_rootset); return ret_value_; }
        }
        if (((int32_t (*)(value_t, int32_t))_placeQueen.fptr)(0, _c + 1)) {
          { int32_t ret_value_ = (VALUE_TRUE); DELETE_ROOT_SET(func_rootset); return ret_value_; }
        }
        ((void (*)(value_t, int32_t, int32_t, int32_t))_setRowColumn.fptr)(0, _r, _c, VALUE_TRUE);
      }
    }
    { int32_t ret_value_ = (VALUE_FALSE); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _placeQueen = { fbody_placeQueen, "(i)b" };

static int32_t fbody_queens(value_t self) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    set_global_variable(&global_rootset7.values[0], gc_new_bytearray(8, VALUE_TRUE));
    set_global_variable(&global_rootset7.values[1], gc_new_bytearray(16, VALUE_TRUE));
    set_global_variable(&global_rootset7.values[2], gc_new_bytearray(16, VALUE_TRUE));
    set_global_variable(&global_rootset7.values[3], gc_new_intarray(8, -1));
    { int32_t ret_value_ = (((int32_t (*)(value_t, int32_t))_placeQueen.fptr)(0, 0)); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _queens = { fbody_queens, "()b" };

static int32_t fbody_verifyResult(value_t self, int32_t _result) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { int32_t ret_value_ = (_result); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _verifyResult = { fbody_verifyResult, "(b)b" };

static void fbody_benchamrk(value_t self, int32_t _cycle) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    for (
    int32_t _i = 0;_i < _cycle; (_i)++) {
      int32_t _result = VALUE_TRUE;
      for (
      int32_t _i = 0;_i < 10; (_i)++) {
        _result = _result&&((int32_t (*)(value_t))_queens.fptr)(0);
      }
      ((void (*)(value_t, int32_t))_assert.fptr)(0, ((int32_t (*)(value_t, int32_t))_verifyResult.fptr)(0, _result));
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _benchamrk = { fbody_benchamrk, "(i)v" };

void bluescript_main7() {
  ROOT_SET_INIT(global_rootset7, 4)
  
  global_rootset7.values[0] = 0;
  global_rootset7.values[1] = 0;
  global_rootset7.values[2] = 0;
  global_rootset7.values[3] = 0;
  ((void (*)(value_t, int32_t))_benchamrk.fptr)(0, 3);
  
}
