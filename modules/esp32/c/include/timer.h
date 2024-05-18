#ifndef __BS_TIMER__
#define __BS_TIMER__

#include <stdint.h>
#include "c-runtime.h"
#include "init.h"

int32_t MD_SECTION fbody_setInterval(value_t self, value_t _func, int32_t delay);
int32_t MD_SECTION fbody_setTimeout(value_t self, value_t _func, int32_t delay);
void MD_SECTION fbody_clearInterval(value_t self, int32_t timerId);
void MD_SECTION fbody_clearTimeout(value_t self, int32_t timerId);

extern struct func_body _setInterval;
extern struct func_body _setTimeout;
extern struct func_body _clearInterval;
extern struct func_body _clearTimeout;

#endif /* __BS_TIMER__ */
