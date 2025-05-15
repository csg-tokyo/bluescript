#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <string.h>

#include "std.h"
#include "protocol.h"
#include "assert.h"

char message[256];

void fbody_print(value_t self, value_t _value) {
  if (is_int_value(_value)) 
    sprintf(message, "%d\n", (int) value_to_int(_value));
  else if (is_float_value(_value))
    sprintf(message, "%f\n", value_to_float(_value));
  else if (_value == VALUE_NULL || _value == VALUE_UNDEF)
    sprintf(message, "undefined\n");
  else if (_value == VALUE_TRUE)
    sprintf(message, "true\n");
  else if (_value == VALUE_FALSE)
    sprintf(message, "false\n");
  else if (gc_is_string_object(_value))
    snprintf(message, sizeof(message), "%s\n", gc_string_to_cstr(_value));
  else {
    class_object* cls = gc_get_class_of(_value);
    if (cls == NULL)
      sprintf(message, "??\n");
    else
      snprintf(message, sizeof(message), "<class %s>\n", cls->name);
  }
  printf(message);
  bs_protocol_write_log(message);
}

int32_t fbody_randInt(value_t self, int32_t _min, int32_t _max) {
  return rand() % (_max - _min + 1) + _min;
}

void fbody_assert(value_t self, int32_t _test) {
    assert(_test);
}

int32_t fbody_abs(value_t self, int32_t _i) {
    int32_t _result = 0;
    _result = abs(_i);
    { int32_t ret_value_ = (_result); return ret_value_; }
}

float fbody_fabs(value_t self, float _f) {
    float _result = 0.0;
    _result = fabsf(_f);;
    { float ret_value_ = (_result); ; return ret_value_; }
}

float fbody_sqrt(value_t self, float _f) {
    float _result = 0.0;
    _result = sqrt(_f);;
    { float ret_value_ = (_result); ; return ret_value_; }
}

float fbody_cos(value_t self, float _f) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    float _result = 0.0;
    _result = cos(_f);
    { float ret_value_ = (_result); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

float fbody_sin(value_t self, float _f) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    float _result = 0.0;
    _result = sin(_f);
    { float ret_value_ = (_result); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

void fbody_anyArrayCopy(value_t self, value_t _src, value_t _dest) {
  ROOT_SET_N(func_rootset,3,VALUE_UNDEF_3)
  func_rootset.values[2] = self;
  func_rootset.values[0] = _src;
  func_rootset.values[1] = _dest;
  {
    int32_t _srcLength = *get_obj_int_property(func_rootset.values[0], 0);
    int32_t _destLength = *get_obj_int_property(func_rootset.values[1], 0);
    if (_srcLength <= _destLength) {
      pointer_t src_vector_p = value_to_ptr(value_to_ptr(func_rootset.values[0])->body[1]);
      pointer_t dest_vector_p = value_to_ptr(value_to_ptr(func_rootset.values[1])->body[1]);
      value_t* src_buffer = &src_vector_p->body[1];
      value_t* dest_buffer = &dest_vector_p->body[1];
      memcpy(dest_buffer, src_buffer, _srcLength * sizeof(value_t));
    }
    else {
      runtime_error("** array copy error: the length of src array must be equal or smaller than the length of dest array.");
    }
  }
  DELETE_ROOT_SET(func_rootset)
}

struct func_body _assert = { fbody_assert, "(b)v" };
struct func_body _abs = { fbody_abs, "(i)i" };
struct func_body _fabs = { fbody_fabs, "(f)f" };
struct func_body _sqrt = { fbody_sqrt, "(f)f" };
struct func_body _cos = { fbody_cos, "(f)f" };
struct func_body _sin = { fbody_sin, "(f)f" };
struct func_body _anyArrayCopy = { fbody_anyArrayCopy, "([a[a)v" };

struct func_body _print = { fbody_print, "(a)v" };
struct func_body _randInt = {fbody_randInt, "(ii)i"};