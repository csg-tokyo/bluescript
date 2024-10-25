#ifndef __BS_PROFILER__
#define __BS_PROFILER__

#include <stdint.h>

/**
 * Reset profiler.
 */
void bs_profiler_reset();


/**
 * Increment the number specified by id.
 */
bool bs_profiler_countup(int32_t id);


/**
 * A task for handling the profiles.
 */
void bs_profiler_task(void *arg);


#endif /* __BS_PROFILER__ */

