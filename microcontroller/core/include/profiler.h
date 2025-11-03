#ifndef __BS_PROFILER__
#define __BS_PROFILER__

#include <stdint.h>
#include "c-runtime.h"

#ifdef LINUX64
typedef uint64_t typeint_t;
#define CORE_TEXT_SECTION 
#define CORE_DATA_SECTION 
#else
typedef uint32_t typeint_t;
#define CORE_TEXT_SECTION __attribute__((section(".core_text")))
#define CORE_DATA_SECTION __attribute__((section(".core_data")))
#endif


void CORE_TEXT_SECTION bs_profiler_profile(uint8_t fid, uint8_t* call_count, typeint_t** type_profile, value_t p1, value_t p2, value_t p3, value_t p4);

#endif /* __BS_PROFILER__ */

