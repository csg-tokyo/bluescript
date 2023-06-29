#include <stdio.h>
#include "utils.h"
#include <math.h>
#include <sys/time.h>

void _console_log(void) {
    printf("Hello world\n");
}


void _console_log_float(float f) {
    printf("%f\n", f);
}


float _sqrt(float f) {
    return (float) sqrt(f);
}


float _get_time_ms() {
    struct timeval now;
    gettimeofday(&now, NULL);
    float ms = (float)now.tv_sec * 1000.0 + (float)now.tv_usec / 1000;
    printf("time: %f\n", ms);
    return ms;
}