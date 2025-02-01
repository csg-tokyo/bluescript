
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

int32_t _RESULT;
value_t new_Random(value_t self);
int32_t mth_0_Random(value_t self);
value_t new_Ball(value_t self, value_t p0);
int32_t mth_0_Ball(value_t self);
extern struct func_body _verify_result;
extern struct func_body _benchamrk;
extern CLASS_OBJECT(object_class, 1);
extern struct func_body _abs;
extern struct func_body _assert;
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
static const uint16_t plist_Ball[] = { 15, 16, 17, 18 };
CLASS_OBJECT(class_Ball, 1) = {
    .body = { .s = 4, .i = 4, .cn = "Ball", .sc = &object_class.clazz , .pt = { .size = 4, .offset = 0,
    .unboxed = 4, .prop_names = plist_Ball, .unboxed_types = "iiii" }, .vtbl = { mth_0_Ball,  }}};

static void cons_Ball(value_t self, value_t _random) {
  ROOT_SET(func_rootset, 3)
  func_rootset.values[0] = self;
  func_rootset.values[1] = _random;
  {
    *get_obj_int_property(self, 0) = (func_rootset.values[2] = func_rootset.values[1], ((int32_t (*)(value_t))method_lookup(func_rootset.values[2], 0))(func_rootset.values[2])) % 500;
    *get_obj_int_property(self, 1) = (func_rootset.values[2] = func_rootset.values[1], ((int32_t (*)(value_t))method_lookup(func_rootset.values[2], 0))(func_rootset.values[2])) % 500;
    *get_obj_int_property(self, 2) = ((func_rootset.values[2] = func_rootset.values[1], ((int32_t (*)(value_t))method_lookup(func_rootset.values[2], 0))(func_rootset.values[2])) % 300) - 150;
    *get_obj_int_property(self, 3) = ((func_rootset.values[2] = func_rootset.values[1], ((int32_t (*)(value_t))method_lookup(func_rootset.values[2], 0))(func_rootset.values[2])) % 300) - 150;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_Ball(value_t self, value_t p0) { cons_Ball(self, p0); return self; }


int32_t mth_0_Ball(value_t self) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    int32_t _xLimit = 500;
    int32_t _yLimit = 500;
    int32_t _bounced = VALUE_FALSE;
    *get_obj_int_property(self, 0) += *get_obj_int_property(self, 2);
    *get_obj_int_property(self, 1) += *get_obj_int_property(self, 3);
    if (*get_obj_int_property(self, 0) > _xLimit) {
      *get_obj_int_property(self, 0) = _xLimit;
      *get_obj_int_property(self, 2) = 0 - ((int32_t (*)(value_t, int32_t))_abs.fptr)(0, *get_obj_int_property(self, 2));
      _bounced = VALUE_TRUE;
    }
    if (*get_obj_int_property(self, 0) < 0) {
      *get_obj_int_property(self, 0) = 0;
      *get_obj_int_property(self, 2) = ((int32_t (*)(value_t, int32_t))_abs.fptr)(0, *get_obj_int_property(self, 2));
      _bounced = VALUE_TRUE;
    }
    if (*get_obj_int_property(self, 1) > _yLimit) {
      *get_obj_int_property(self, 1) = _yLimit;
      *get_obj_int_property(self, 3) = 0 - ((int32_t (*)(value_t, int32_t))_abs.fptr)(0, *get_obj_int_property(self, 3));
      _bounced = VALUE_TRUE;
    }
    if (*get_obj_int_property(self, 1) < 0) {
      *get_obj_int_property(self, 1) = 0;
      *get_obj_int_property(self, 3) = ((int32_t (*)(value_t, int32_t))_abs.fptr)(0, *get_obj_int_property(self, 3));
      _bounced = VALUE_TRUE;
    }
    { int32_t ret_value_ = (_bounced); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

static int32_t fbody_verify_result(value_t self, int32_t _result) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { int32_t ret_value_ = (_result == _RESULT); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _verify_result = { fbody_verify_result, "(i)b" };

static void fbody_benchamrk(value_t self, int32_t _cycle) {
  ROOT_SET(func_rootset, 6)
  func_rootset.values[0] = self;
  {
    for (
    int32_t _i = 0;_i < _cycle; (_i)++) {
      func_rootset.values[1] = new_Random(gc_new_object(&class_Random.clazz));
      int32_t _ballCount = 100;
      int32_t _bounces = 0;
      func_rootset.values[2] = new_Ball(gc_new_object(&class_Ball.clazz), func_rootset.values[1]);
      func_rootset.values[3] = gc_new_array(0, _ballCount, func_rootset.values[2]);
      int32_t _i = 0;
      for (_i = 1; _i < _ballCount; _i += 1) {
        gc_array_set(func_rootset.values[3], _i, new_Ball(gc_new_object(&class_Ball.clazz), func_rootset.values[1]));
      }
      for (_i = 0; _i < 50; _i += 1) {
        for (
        int32_t _j = 0;_j < _ballCount; (_j)++) {
          func_rootset.values[4] = (*gc_array_get(func_rootset.values[3], _j));
          if ((func_rootset.values[5] = func_rootset.values[4], ((int32_t (*)(value_t))method_lookup(func_rootset.values[5], 0))(func_rootset.values[5]))) {
          _bounces += 1;
          }
        }
      }
      ((void (*)(value_t, int32_t))_assert.fptr)(0, ((int32_t (*)(value_t, int32_t))_verify_result.fptr)(0, _bounces));
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _benchamrk = { fbody_benchamrk, "(i)v" };

void bluescript_main6() {
  ROOT_SET_INIT(global_rootset6, 0)
  
  _RESULT = 1331;
  ((void (*)(value_t, int32_t))_benchamrk.fptr)(0, 3);
  
}
