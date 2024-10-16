#ifndef __BS_LOGGER__
#define __BS_LOGGER__

#include <stdio.h>
#include <stdlib.h>
#include <string.h>


/**
 * Register log sender.  
 */
void bs_logger_register_sender(void (* sender)(uint8_t*, uint32_t));


/**
 * Push the log string to the log queue.
 */
void bs_logger_push_log(char *str);

/**
 * Push the error string to the log queue.
 */
void bs_logger_push_error(char *str);

/**
 * Push the profiling data to the log queue.
 */
void bs_logger_push_profile(uint8_t *profile_buffer, int32_t len);

/**
 * Reset log queue.
 */
void bs_logger_reset();

/**
 * A task for handling the logs.
 */
void bs_logger_task(void *arg);


#endif /* __BS_LOGGER__ */

