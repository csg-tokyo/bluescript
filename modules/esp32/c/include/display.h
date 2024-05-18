#ifndef __BS_DISPLAY__
#define __BS_DISPLAY__

#include "c-runtime.h"
#include "init.h"

value_t new_Display(value_t self);

typedef union { 
    struct class_object clazz; 
    struct { uint32_t s; uint32_t i; const char* const cn; const struct class_object* const sc; struct property_table pt; void* vtbl[6]; } body; 
} class_Display_t;

extern class_Display_t class_Display;

#endif /* __BS_DISPLAY__ */
