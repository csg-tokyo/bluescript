#include <stdio.h>
#include <stdlib.h>
#include "include/utils.h"
#include "logger.h"

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
    snprintf(message, sizeof(message), "%s\n", gc_string_literal_cstr(_value));
  else {
    class_object* cls = gc_get_class_of(_value);
    if (cls == NULL)
      sprintf(message, "??\n");
    else
      snprintf(message, sizeof(message), "<class %s>\n", cls->name);
  }
  bs_logger_push_log(message);
}

int32_t fbody_randInt(value_t self, int32_t _min, int32_t _max) {
  int32_t ri = 0;
  return rand() % (_max - _min + 1) + _min;
}


struct func_body _print = { fbody_print, "(a)v" };
struct func_body _randInt = {fbody_randInt, "(ii)i"};
