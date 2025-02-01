
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

int32_t _RESULT;
value_t new_TowersDisk(value_t self, int32_t p0);
int32_t _movesDone;
extern struct func_body _pushDisk;
extern struct func_body _popDiskFrom;
extern struct func_body _moveTopDisk;
extern struct func_body _buildTowerAt;
extern struct func_body _moveDisks;
extern struct func_body _verifyResult;
extern struct func_body _benchamrk;
extern CLASS_OBJECT(object_class, 1);
extern struct func_body _assert;
void bluescript_main6();
ROOT_SET_DECL(global_rootset6, 2)
static const uint16_t plist_TowersDisk[] = { 13, 14 };
CLASS_OBJECT(class_TowersDisk, 0) = {
    .body = { .s = 2, .i = 1, .cn = "TowersDisk", .sc = &object_class.clazz , .pt = { .size = 2, .offset = 0,
    .unboxed = 1, .prop_names = plist_TowersDisk, .unboxed_types = "i" }, .vtbl = {  }}};

static void cons_TowersDisk(value_t self, int32_t _size) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    *get_obj_int_property(self, 0) = _size;
    set_obj_property(self, 1, self);
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_TowersDisk(value_t self, int32_t p0) { cons_TowersDisk(self, p0); return self; }


static void fbody_pushDisk(value_t self, value_t _disk, int32_t _pile) {
  ROOT_SET(func_rootset, 3)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _disk;
  {
    func_rootset.values[2] = (*gc_array_get(global_rootset6.values[1], _pile));
    if (*get_obj_int_property(func_rootset.values[2], 0) != -1&&*get_obj_int_property(func_rootset.values[0], 0) >= *get_obj_int_property(func_rootset.values[2], 0)) {
      ((void (*)(value_t, int32_t))_assert.fptr)(0, VALUE_FALSE);
    }
    set_obj_property(func_rootset.values[0], 1, func_rootset.values[2]);
    gc_array_set(global_rootset6.values[1], _pile, func_rootset.values[0]);
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _pushDisk = { fbody_pushDisk, "('TowersDisk'i)v" };

static value_t fbody_popDiskFrom(value_t self, int32_t _pile) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[0] = self;
  {
    func_rootset.values[1] = (*gc_array_get(global_rootset6.values[1], _pile));
    if (*get_obj_int_property(func_rootset.values[1], 0) == -1) {
      ((void (*)(value_t, int32_t))_assert.fptr)(0, VALUE_FALSE);
    }
    gc_array_set(global_rootset6.values[1], _pile, safe_value_to_value(&class_TowersDisk.clazz, get_obj_property(func_rootset.values[1], 1)));
    set_obj_property(func_rootset.values[1], 1, global_rootset6.values[0]);
    { value_t ret_value_ = (func_rootset.values[1]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _popDiskFrom = { fbody_popDiskFrom, "(i)'TowersDisk'" };

static void fbody_moveTopDisk(value_t self, int32_t _fromPile, int32_t _toPile) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[0] = self;
  {
    ((void (*)(value_t, value_t, int32_t))_pushDisk.fptr)(0, func_rootset.values[1]=((value_t (*)(value_t, int32_t))_popDiskFrom.fptr)(0, _fromPile), _toPile);
    _movesDone += 1;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _moveTopDisk = { fbody_moveTopDisk, "(ii)v" };

static void fbody_buildTowerAt(value_t self, int32_t _pile, int32_t _disks) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[0] = self;
  {
    for (
    int32_t _i = _disks;_i >= 0; (_i)--) {
      ((void (*)(value_t, value_t, int32_t))_pushDisk.fptr)(0, func_rootset.values[1]=new_TowersDisk(gc_new_object(&class_TowersDisk.clazz), _i), _pile);
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _buildTowerAt = { fbody_buildTowerAt, "(ii)v" };

static void fbody_moveDisks(value_t self, int32_t _disks, int32_t _fromPile, int32_t _toPile) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    if (_disks == 1) {
      ((void (*)(value_t, int32_t, int32_t))_moveTopDisk.fptr)(0, _fromPile, _toPile);
    }
    else {
      int32_t _otherPile = (3 - _fromPile) - _toPile;
      ((void (*)(value_t, int32_t, int32_t, int32_t))_moveDisks.fptr)(0, _disks - 1, _fromPile, _otherPile);
      ((void (*)(value_t, int32_t, int32_t))_moveTopDisk.fptr)(0, _fromPile, _toPile);
      ((void (*)(value_t, int32_t, int32_t, int32_t))_moveDisks.fptr)(0, _disks - 1, _otherPile, _toPile);
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _moveDisks = { fbody_moveDisks, "(iii)v" };

static int32_t fbody_verifyResult(value_t self, int32_t _result) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { int32_t ret_value_ = (_result == _RESULT); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _verifyResult = { fbody_verifyResult, "(i)b" };

static void fbody_benchamrk(value_t self, int32_t _cycle) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    for (
    int32_t _i = 0;_i < _cycle; (_i)++) {
      set_global_variable(&global_rootset6.values[0], new_TowersDisk(gc_new_object(&class_TowersDisk.clazz), -1));
      set_global_variable(&global_rootset6.values[1], gc_new_array(0, 3, global_rootset6.values[0]));
      _movesDone = 0;
      ((void (*)(value_t, int32_t, int32_t))_buildTowerAt.fptr)(0, 0, 13);
      ((void (*)(value_t, int32_t, int32_t, int32_t))_moveDisks.fptr)(0, 13, 0, 1);
      ((void (*)(value_t, int32_t))_assert.fptr)(0, ((int32_t (*)(value_t, int32_t))_verifyResult.fptr)(0, _movesDone));
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _benchamrk = { fbody_benchamrk, "(i)v" };

void bluescript_main6() {
  ROOT_SET_INIT(global_rootset6, 2)
  
  _RESULT = 8191;
  set_global_variable(&global_rootset6.values[0], new_TowersDisk(gc_new_object(&class_TowersDisk.clazz), -1));
  set_global_variable(&global_rootset6.values[1], gc_new_array(0, 3, global_rootset6.values[0]));
  _movesDone = 0;
  ((void (*)(value_t, int32_t))_benchamrk.fptr)(0, 3);
  
}
