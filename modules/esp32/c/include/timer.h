#ifndef __BS_TIMER__
#define __BS_TIMER__

#include <stdint.h>
#include "c-runtime.h"
#include "section.h"

int32_t MD_SECTION_TEXT fbody_setInterval(value_t self, value_t _func, int32_t delay);
int32_t MD_SECTION_TEXT fbody_setTimeout(value_t self, value_t _func, int32_t delay);
void MD_SECTION_TEXT fbody_clearInterval(value_t self, int32_t timerId);
void MD_SECTION_TEXT fbody_clearTimeout(value_t self, int32_t timerId);
int32_t MD_SECTION_TEXT fbody_getTimeUs(value_t self);

extern MD_SECTION_DATA struct func_body _setInterval;
extern MD_SECTION_DATA struct func_body _setTimeout;
extern MD_SECTION_DATA struct func_body _clearInterval;
extern MD_SECTION_DATA struct func_body _clearTimeout;
extern MD_SECTION_DATA struct func_body _getTimeUs;

#endif /* __BS_TIMER__ */
