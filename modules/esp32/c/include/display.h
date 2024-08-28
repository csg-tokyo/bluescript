#ifndef __BS_DISPLAY__
#define __BS_DISPLAY__

#include "c-runtime.h"
#include "section.h"

value_t MD_SECTION_TEXT new_Display(value_t self);

typedef union { 
    struct class_object clazz; 
    struct { uint32_t s; uint32_t i; const char* const cn; const struct class_object* const sc; struct property_table pt; void* vtbl[6]; } body; 
} class_Display_t;

extern MD_SECTION_DATA class_Display_t class_Display;

#endif /* __BS_DISPLAY__ */
