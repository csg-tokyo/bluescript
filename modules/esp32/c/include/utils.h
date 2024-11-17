#ifndef __BS_PRINT__
#define __BS_PRINT__

#include <stdint.h>
#include "c-runtime.h"
#include "section.h"


void MD_SECTION_TEXT fbody_print(value_t self, value_t _value);
int32_t MD_SECTION_TEXT fbody_randInt(value_t self, int32_t _min, int32_t _max);
void MD_SECTION_TEXT fbody_assert(value_t self, int32_t _test);
int32_t MD_SECTION_TEXT fbody_abs(value_t self, int32_t _i);
float MD_SECTION_TEXT fbody_fabs(value_t self, float _f);
float MD_SECTION_TEXT fbody_sqrt(value_t self, float _f);

extern MD_SECTION_DATA struct func_body _print;
extern MD_SECTION_DATA struct func_body _randInt;
extern MD_SECTION_DATA struct func_body _assert;
extern MD_SECTION_DATA struct func_body _abs;
extern MD_SECTION_DATA struct func_body _fabs;
extern MD_SECTION_DATA struct func_body _sqrt;

#endif /* __BS_PRINT__ */

