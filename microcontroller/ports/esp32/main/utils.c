#include <stdio.h>
#include <stdarg.h>

#include "esp_timer.h"

#include "./include/utils.h"


int64_t bs_timer_get_time_us() {
    return esp_timer_get_time();
}

void bs_log_write_info(char* format, ...) {
#ifdef BS_SHOW_LOG
    va_list args;
    printf("\x1b[32m[INFO] ");
    va_start(args, format);
    vprintf(format, args);
    va_end(args);
    printf("\x1b[39m\n");
#endif
}

void bs_log_write_error(char* format, ...) {
#ifdef BS_SHOW_LOG
    va_list args;
    printf("\x1b[31m[ERROR] ");
    va_start(args, format);
    vprintf(format, args);
    va_end(args);
    printf("\x1b[39m\n");
#endif
}