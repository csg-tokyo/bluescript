#ifndef __BS_UTILS__
#define __BS_UTILS__

#include <stdint.h>

// #define BS_SHOW_LOG

int64_t bs_timer_get_time_us();

void bs_log_write_info(char* format, ...);

void bs_log_write_error(char* format, ...);

#ifdef BS_SHOW_LOG

#define BS_LOG_INFO(format, ...)   bs_log_write_info(format, ##__VA_ARGS__);
#define BS_LOG_ERROR(format, ...)  bs_log_write_error(format, ##__VA_ARGS__);

#else /* BS_SHOW_LOG */

#define BS_LOG_INFO(format, ...) 
#define BS_LOG_ERROR(format, ...)

#endif /* BS_SHOW_LOG */

#endif /* __BS_UTILS__ */