#include <stdio.h>

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "../include/main-thread.h"

void main_thread(void *arg) {

}

void bs_main_thread_init();

void bs_main_thread_reset();

void bs_main_thread_set_main(int32_t id, void* main);

void bs_main_thread_set_event(value_t fn);