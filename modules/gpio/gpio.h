#ifndef __BS_Display__
#define __BS_Display__

#include "c-runtime.h"

value_t new_000003GPIO(value_t self, int32_t p0);

typedef union { 
    struct class_object clazz; 
    struct { uint32_t s; uint32_t i; const char* const cn; const struct class_object* const sc; uint32_t f; struct property_table pt; void* vtbl[2]; } body;
} class_000003GPIO_t;

extern class_000003GPIO_t class_000003GPIO;

void bluescript_main0_000003();

#endif /* __BS_Display__ */
