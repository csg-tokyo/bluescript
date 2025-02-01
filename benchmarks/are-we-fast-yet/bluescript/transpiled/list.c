
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

int32_t _RESULT;
value_t new_Element(value_t self, int32_t p0);
int32_t mth_0_Element(value_t self);
extern struct func_body _length;
extern struct func_body _makeList;
extern struct func_body _isShorterThan;
extern struct func_body _tail;
extern struct func_body _verifyResult;
extern struct func_body _benchamrk;
extern CLASS_OBJECT(object_class, 1);
void bluescript_main6();
ROOT_SET_DECL(global_rootset6, 0)
static const uint16_t plist_Element[] = { 13, 15, 14 };
CLASS_OBJECT(class_Element, 1) = {
    .body = { .s = 3, .i = 2, .cn = "Element", .sc = &object_class.clazz , .pt = { .size = 3, .offset = 0,
    .unboxed = 2, .prop_names = plist_Element, .unboxed_types = "ib" }, .vtbl = { mth_0_Element,  }}};

static void cons_Element(value_t self, int32_t _val) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    *get_obj_int_property(self, 0) = _val;
    set_obj_property(self, 2, self);
    *get_obj_int_property(self, 1) = VALUE_FALSE;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_Element(value_t self, int32_t p0) { cons_Element(self, p0); return self; }


int32_t mth_0_Element(value_t self) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[0] = self;
  {
    if (*get_obj_int_property(self, 1)) {
      { int32_t ret_value_ = (0); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    else {
      { int32_t ret_value_ = (1 + ((int32_t (*)(value_t, value_t))_length.fptr)(0, func_rootset.values[1]=safe_value_to_value(&class_Element.clazz, get_obj_property(self, 2)))); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
  }
}

static int32_t fbody_length(value_t self, value_t _e) {
  ROOT_SET(func_rootset, 3)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _e;
  {
    if (*get_obj_int_property(func_rootset.values[0], 1)) {
      { int32_t ret_value_ = (0); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    else {
      { int32_t ret_value_ = (1 + ((int32_t (*)(value_t, value_t))_length.fptr)(0, func_rootset.values[2]=safe_value_to_value(&class_Element.clazz, get_obj_property(func_rootset.values[0], 2)))); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
  }
}
struct func_body _length = { fbody_length, "('Element')i" };

static value_t fbody_makeList(value_t self, int32_t _length) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[0] = self;
  {
    if (_length == 0) {
      func_rootset.values[1] = new_Element(gc_new_object(&class_Element.clazz), 0);
      *get_obj_int_property(func_rootset.values[1], 1) = VALUE_TRUE;
      { value_t ret_value_ = (func_rootset.values[1]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    else {
      func_rootset.values[1] = new_Element(gc_new_object(&class_Element.clazz), _length);
      set_obj_property(func_rootset.values[1], 2, ((value_t (*)(value_t, int32_t))_makeList.fptr)(0, _length - 1));
      { value_t ret_value_ = (func_rootset.values[1]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
  }
}
struct func_body _makeList = { fbody_makeList, "(i)'Element'" };

static int32_t fbody_isShorterThan(value_t self, value_t _x, value_t _y) {
  ROOT_SET(func_rootset, 5)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _x;
  func_rootset.values[1] = _y;
  {
    func_rootset.values[3] = func_rootset.values[0];
    func_rootset.values[4] = func_rootset.values[1];
    while (!*get_obj_int_property(func_rootset.values[4], 1)) {
      if (*get_obj_int_property(func_rootset.values[3], 1)) {
        { int32_t ret_value_ = (VALUE_TRUE); DELETE_ROOT_SET(func_rootset); return ret_value_; }
      }
      func_rootset.values[3] = safe_value_to_value(&class_Element.clazz, get_obj_property(func_rootset.values[3], 2));
      func_rootset.values[4] = safe_value_to_value(&class_Element.clazz, get_obj_property(func_rootset.values[4], 2));
    }
    { int32_t ret_value_ = (VALUE_FALSE); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _isShorterThan = { fbody_isShorterThan, "('Element''Element')b" };

static value_t fbody_tail(value_t self, value_t _x, value_t _y, value_t _z) {
  ROOT_SET(func_rootset, 8)
  func_rootset.values[3] = self;
  func_rootset.values[0] = _x;
  func_rootset.values[1] = _y;
  func_rootset.values[2] = _z;
  {
    if (((int32_t (*)(value_t, value_t, value_t))_isShorterThan.fptr)(0, func_rootset.values[1], func_rootset.values[0])) {
      { value_t ret_value_ = (((value_t (*)(value_t, value_t, value_t, value_t))_tail.fptr)(0, func_rootset.values[4]=safe_value_to_value(&class_Element.clazz, ((value_t (*)(value_t, value_t, value_t, value_t))_tail.fptr)(0, func_rootset.values[5]=safe_value_to_value(&class_Element.clazz, get_obj_property(func_rootset.values[0], 2)), func_rootset.values[1], func_rootset.values[2])), func_rootset.values[5]=safe_value_to_value(&class_Element.clazz, ((value_t (*)(value_t, value_t, value_t, value_t))_tail.fptr)(0, func_rootset.values[6]=safe_value_to_value(&class_Element.clazz, get_obj_property(func_rootset.values[1], 2)), func_rootset.values[2], func_rootset.values[0])), func_rootset.values[6]=safe_value_to_value(&class_Element.clazz, ((value_t (*)(value_t, value_t, value_t, value_t))_tail.fptr)(0, func_rootset.values[7]=safe_value_to_value(&class_Element.clazz, get_obj_property(func_rootset.values[2], 2)), func_rootset.values[0], func_rootset.values[1])))); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    { value_t ret_value_ = (func_rootset.values[2]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _tail = { fbody_tail, "('Element''Element''Element')a" };

static int32_t fbody_verifyResult(value_t self, int32_t _result) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { int32_t ret_value_ = (_result == _RESULT); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _verifyResult = { fbody_verifyResult, "(i)b" };

static void fbody_benchamrk(value_t self, int32_t _cycle) {
  ROOT_SET(func_rootset, 5)
  func_rootset.values[0] = self;
  {
    for (
    int32_t _i = 0;_i < _cycle; (_i)++) {
      func_rootset.values[1] = safe_value_to_value(&class_Element.clazz, ((value_t (*)(value_t, value_t, value_t, value_t))_tail.fptr)(0, func_rootset.values[2]=((value_t (*)(value_t, int32_t))_makeList.fptr)(0, 15), func_rootset.values[3]=((value_t (*)(value_t, int32_t))_makeList.fptr)(0, 10), func_rootset.values[4]=((value_t (*)(value_t, int32_t))_makeList.fptr)(0, 6)));
      ((int32_t (*)(value_t, int32_t))_verifyResult.fptr)(0, ((int32_t (*)(value_t, value_t))_length.fptr)(0, func_rootset.values[1]));
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _benchamrk = { fbody_benchamrk, "(i)v" };

void bluescript_main6() {
  ROOT_SET_INIT(global_rootset6, 0)
  
  _RESULT = 10;
  ((void (*)(value_t, int32_t))_benchamrk.fptr)(0, 3);
  
}
