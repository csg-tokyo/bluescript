#ifndef __BS_Display__
#define __BS_Display__

#include "c-runtime.h"

value_t new_10010511511210897000Display(value_t self);

typedef union { 
    struct class_object clazz; 
    struct { uint32_t s; uint32_t i; const char* const cn; const struct class_object* const sc; uint32_t f; struct property_table pt; void* vtbl[6]; } body;
} class_10010511511210897000Display_t;

extern class_10010511511210897000Display_t class_10010511511210897000Display;

void bluescript_main0_10010511511210897000();

#endif /* __BS_Display__ */
