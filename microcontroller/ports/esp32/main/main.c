#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "main-thread.h"
#include "profiler.h"


void app_main(void) {
    bs_main_thread_init();
}
