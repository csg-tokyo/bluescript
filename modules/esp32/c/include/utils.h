#ifndef __BS_PRINT__
#define __BS_PRINT__

#include <stdint.h>
#include "c-runtime.h"
#include "init.h"


void MD_SECTION fbody_print(value_t self, value_t _value);
int32_t MD_SECTION fbody_randInt(value_t self, int32_t _min, int32_t _max);

extern struct func_body _print;
extern struct func_body _randInt;

#endif /* __BS_PRINT__ */

