#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "main-thread.h"
#include "include/ble.h"
#include "profiler.h"


void app_main(void) {
    bs_ble_init();
    bs_main_thread_init();
}
