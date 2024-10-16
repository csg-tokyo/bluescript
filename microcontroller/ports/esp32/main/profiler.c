#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "esp_timer.h"

#include "include/profiler.h"
#include "include/logger.h"
#include "c-runtime.h"

// Used to prevent unused functions from being deleted during initialization.
#define PR_SECTION __attribute__((section(".text.profile")))

#define BS_PROFILER_TAG        "BS_PROFILER"
#define PROFILE_BUFFER_LENGTH  100
#define PROFILE_ITERATION_MS   10000


static volatile SemaphoreHandle_t semaphore;

static uint8_t profile_buffer[PROFILE_BUFFER_LENGTH];


void PR_SECTION bs_profiler_reset() {
    memset(profile_buffer, 0, PROFILE_BUFFER_LENGTH);
}


void PR_SECTION bs_profiler_countup(int32_t id) {
    if (profile_buffer[id] < UINT8_MAX) {
        profile_buffer[id] += 1;
    }
}


static void profiler_wakeup_event(void* arg) {
    xSemaphoreGiveFromISR(semaphore, NULL);
}


void PR_SECTION bs_profiler_task(void *arg) {
    vSemaphoreCreateBinary(semaphore);

    const esp_timer_create_args_t periodic_timer_args = {
            .callback = &profiler_wakeup_event,
            .name = "profiler_wakeup_event"
    };

    esp_timer_handle_t periodic_timer;
    esp_timer_create(&periodic_timer_args, &periodic_timer);
    esp_timer_start_periodic(periodic_timer, PROFILE_ITERATION_MS*1000);

    while (true) {
        xSemaphoreTake(semaphore, portMAX_DELAY);
        puts("get semaphore");
        bs_logger_push_profile(profile_buffer, PROFILE_BUFFER_LENGTH);
        bs_profiler_reset();
    }
    
}
