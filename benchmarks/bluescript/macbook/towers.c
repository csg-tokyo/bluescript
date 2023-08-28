
#include "c-runtime.h"
#include "utils.c"

int32_t _RESULT;
int32_t _size;
int32_t _next;
int32_t _movesDone;
extern struct _pushDisk {
  void (*fptr)(value_t, int32_t);
  const char* sig; } _pushDisk;
extern struct _popDiskFrom {
  value_t (*fptr)(int32_t);
  const char* sig; } _popDiskFrom;
extern struct _moveTopDisk {
  void (*fptr)(int32_t, int32_t);
  const char* sig; } _moveTopDisk;
extern struct _buildTowerAt {
  void (*fptr)(int32_t, int32_t);
  const char* sig; } _buildTowerAt;
extern struct _moveDisks {
  void (*fptr)(int32_t, int32_t, int32_t);
  const char* sig; } _moveDisks;
extern struct _towers {
  int32_t (*fptr)();
  const char* sig; } _towers;
extern struct _verifyResult {
  int32_t (*fptr)(int32_t);
  const char* sig; } _verifyResult;
int32_t _result;
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 1)

static void fbody_pushDisk(value_t _disk, int32_t _pile) {
  ROOT_SET(func_rootset, 3)
  func_rootset.values[0] = _disk;
  {
    func_rootset.values[1] = (*gc_array_get(global_rootset2.values[0], _pile));
    if ((_arrayLength.fptr(func_rootset.values[2]=func_rootset.values[1]) == 2)&&any_greater_eq(((*gc_array_get(func_rootset.values[0], _size))), ((*gc_array_get(func_rootset.values[1], _size))))) {
      _assert.fptr(VALUE_FALSE);
    }
    (*gc_array_get(func_rootset.values[0], _next)) = (func_rootset.values[1]);
    (*gc_array_get(global_rootset2.values[0], _pile)) = func_rootset.values[0];
  }
  DELETE_ROOT_SET(func_rootset)
}
struct _pushDisk _pushDisk = { fbody_pushDisk, "([ai)v" };

static value_t fbody_popDiskFrom(int32_t _pile) {
  ROOT_SET(func_rootset, 2)
  {
    func_rootset.values[0] = (*gc_array_get(global_rootset2.values[0], _pile));
    if (_arrayLength.fptr(func_rootset.values[1]=func_rootset.values[0]) == 0) {
      _assert.fptr(VALUE_FALSE);
    }
    (*gc_array_get(global_rootset2.values[0], _pile)) = ((*gc_array_get(func_rootset.values[0], _next)));
    (*gc_array_get(func_rootset.values[0], _next)) = (gc_make_array(0));
    { value_t ret_value_ = (func_rootset.values[0]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _popDiskFrom _popDiskFrom = { fbody_popDiskFrom, "(i)[a" };

static void fbody_moveTopDisk(int32_t _fromPile, int32_t _toPile) {
  ROOT_SET(func_rootset, 1)
  {
    _pushDisk.fptr(func_rootset.values[0]=_popDiskFrom.fptr(_fromPile), _toPile);
    _movesDone+=1;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct _moveTopDisk _moveTopDisk = { fbody_moveTopDisk, "(ii)v" };

static void fbody_buildTowerAt(int32_t _pile, int32_t _disks) {
  ROOT_SET(func_rootset, 1)
  {
    for (
    int32_t _i = _disks;_i > -1; _i--) {
      _pushDisk.fptr(func_rootset.values[0]=gc_make_array(2, int_to_value(_i), (VALUE_NULL)), _pile);
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct _buildTowerAt _buildTowerAt = { fbody_buildTowerAt, "(ii)v" };

static void fbody_moveDisks(int32_t _disks, int32_t _fromPile, int32_t _toPile) {
  ROOT_SET(func_rootset, 0)
  {
    if (_disks == 1) {
      _moveTopDisk.fptr(_fromPile, _toPile);
    }
    else {
      int32_t _otherPile = (3 - _fromPile) - _toPile;
      _moveDisks.fptr(_disks - 1, _fromPile, _otherPile);
      _moveTopDisk.fptr(_fromPile, _toPile);
      _moveDisks.fptr(_disks - 1, _otherPile, _toPile);
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct _moveDisks _moveDisks = { fbody_moveDisks, "(iii)v" };

static int32_t fbody_towers() {
  ROOT_SET(func_rootset, 0)
  {
    global_rootset2.values[0] = gc_make_array(3, (gc_make_array(0)), (gc_make_array(0)), (gc_make_array(0)));
    _buildTowerAt.fptr(0, 13);
    _movesDone = 0;
    _moveDisks.fptr(13, 0, 1);
    { int32_t ret_value_ = (_movesDone); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _towers _towers = { fbody_towers, "()i" };

static int32_t fbody_verifyResult(int32_t _result) {
  ROOT_SET(func_rootset, 0)
  {
    { int32_t ret_value_ = (_result == _RESULT); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _verifyResult _verifyResult = { fbody_verifyResult, "(i)b" };

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 1)
  ROOT_SET(func_rootset, 0)
  _RESULT = 8191;
  _size = 0;
  _next = 1;
  global_rootset2.values[0] = gc_make_array(3, (gc_make_array(0)), (gc_make_array(0)), (gc_make_array(0)));
  _movesDone = 0;
  _result = _towers.fptr();
  _assert.fptr(_verifyResult.fptr(_result));
  DELETE_ROOT_SET(func_rootset)
}
