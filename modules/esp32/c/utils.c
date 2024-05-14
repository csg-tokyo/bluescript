#include <stdio.h>
#include <stdlib.h>
#include "include/timer.h"
#include "logger.h"

char message[256];

static void fbody_print(value_t self, value_t _value) {
  if (is_int_value(_value)) 
    sprintf(message, "%d\n", (int) value_to_int(_value));
  else if (is_float_value(_value))
    sprintf(message, "%f\n", value_to_float(_value));
  else if (_value == VALUE_NULL)
    sprintf(message, "null\n");
  else if (gc_is_string_literal(_value))
    sprintf(message, "%s\n", gc_string_literal_cstr(_value));
  else
    sprintf(message, "??\n");
  bs_logger_push_log(message, strlen(message));
}

static int32_t fbody_randInt(value_t self, int32_t _min, int32_t _max) {
  int32_t ri = 0;
  return rand() % (_max - _min + 1) + _min;
}


struct func_body _print = { fbody_print, "(a)v" };
struct func_body _randInt = {fbody_randInt, "(ii)i"};
