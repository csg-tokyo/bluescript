#ifndef __BS_GPIO__
#define __BS_GPIO__

#include "c-runtime.h"
#include "section.h"

value_t MD_SECTION_TEXT new_GPIO(value_t self, int32_t p0);

typedef union { 
    struct class_object clazz; 
    struct { uint32_t s; uint32_t i; const char* const cn; const struct class_object* const sc; struct property_table pt; void* vtbl[1]; } body; 
} class_GPIO_t;

extern MD_SECTION_DATA class_GPIO_t class_GPIO;

#endif /* __BS_GPIO__ */
