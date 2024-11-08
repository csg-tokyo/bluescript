#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include "include/utils.h"
#include "logger.h"
#include "assert.h"

char message[256];

void fbody_print(value_t self, value_t _value) {
  if (is_int_value(_value)) 
    sprintf(message, "%d\n", (int) value_to_int(_value));
  else if (is_float_value(_value))
    sprintf(message, "%f\n", value_to_float(_value));
  else if (_value == VALUE_NULL)
    sprintf(message, "null\n");
  else if (gc_is_string_object(_value))
    sprintf(message, "%s\n", gc_string_literal_cstr(_value));
  else
    sprintf(message, "??\n");
  bs_logger_push_log(message);
}

int32_t fbody_randInt(value_t self, int32_t _min, int32_t _max) {
  int32_t ri = 0;
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

struct func_body _assert = { fbody_assert, "(b)v" };
struct func_body _abs = { fbody_abs, "(i)i" };
struct func_body _fabs = { fbody_fabs, "(f)f" };
struct func_body _sqrt = { fbody_sqrt, "(f)f" };

struct func_body _print = { fbody_print, "(a)v" };
struct func_body _randInt = {fbody_randInt, "(ii)i"};
