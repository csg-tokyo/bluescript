
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

int32_t _DEPTH;
int32_t _RESULT;
value_t new_Random(value_t self);
int32_t mth_0_Random(value_t self);
int32_t _count;
extern struct func_body _buildTreeDepth;
extern struct func_body _storage;
extern struct func_body _verifyResult;
extern struct func_body _benchamrk;
extern CLASS_OBJECT(object_class, 1);
void bluescript_main6();
ROOT_SET_DECL(global_rootset6, 0)
static const uint16_t plist_Random[] = { 13 };
CLASS_OBJECT(class_Random, 1) = {
    .body = { .s = 1, .i = 1, .cn = "Random", .sc = &object_class.clazz , .pt = { .size = 1, .offset = 0,
    .unboxed = 1, .prop_names = plist_Random, .unboxed_types = "i" }, .vtbl = { mth_0_Random,  }}};

static void cons_Random(value_t self) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    *get_obj_int_property(self, 0) = 74755;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_Random(value_t self) { cons_Random(self); return self; }


int32_t mth_0_Random(value_t self) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    *get_obj_int_property(self, 0) = ((*get_obj_int_property(self, 0) * 1309) + 13849) & 65535;
    { int32_t ret_value_ = (*get_obj_int_property(self, 0)); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

static value_t fbody_buildTreeDepth(value_t self, int32_t _depth, value_t _random) {
  ROOT_SET(func_rootset, 4)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _random;
  {
    _count += 1;
    if (_depth == 1) {
      { value_t ret_value_ = (gc_new_array(1, (func_rootset.values[3] = func_rootset.values[0], ((int32_t (*)(value_t))method_lookup(func_rootset.values[3], 0))(func_rootset.values[3])) % 10 + 1, func_rootset.values[3]=int_to_value(0))); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    func_rootset.values[2] = gc_new_array(1, 4, func_rootset.values[3]=int_to_value(0));
    for (
    int32_t _i = 0;_i < 4; (_i)++) {
      gc_array_set(func_rootset.values[2], _i, ((value_t (*)(value_t, int32_t, value_t))_buildTreeDepth.fptr)(0, _depth - 1, func_rootset.values[0]));
    }
    { value_t ret_value_ = (func_rootset.values[2]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _buildTreeDepth = { fbody_buildTreeDepth, "(i'Random')[a" };

static int32_t fbody_storage(value_t self) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[0] = self;
  {
    func_rootset.values[1] = new_Random(gc_new_object(&class_Random.clazz));
    _count = 0;
    ((value_t (*)(value_t, int32_t, value_t))_buildTreeDepth.fptr)(0, _DEPTH, func_rootset.values[1]);
    { int32_t ret_value_ = (_count); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _storage = { fbody_storage, "()i" };

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
      int32_t _result = ((int32_t (*)(value_t))_storage.fptr)(0);
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _benchamrk = { fbody_benchamrk, "(i)v" };

void bluescript_main6() {
  ROOT_SET_INIT(global_rootset6, 0)
  
  _DEPTH = 5;
  _RESULT = 1365;
  _count = 0;
  ((void (*)(value_t, int32_t))_benchamrk.fptr)(0, 3);
  
}
