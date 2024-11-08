#ifndef __BS_PROFILER__
#define __BS_PROFILER__

#include <stdint.h>
#include "c-runtime.h"

bool CR_SECTION bs_profiler_typecount(uint8_t id, uint8_t count, value_t p1, value_t p2, value_t p3, value_t p4);

extern void bs_logger_push_profile(uint8_t fid, uint8_t *profile_buffer, int32_t len);

#endif /* __BS_PROFILER__ */

