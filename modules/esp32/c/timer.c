#include <stdbool.h>
#include "esp_timer.h"
#include "esp_log.h"
#include "include/timer.h"
#include "event.h"

#define BS_TIMER_TAG  "BS_TIMER"
#define NUM_TIMERS    10

esp_timer_handle_t timer_handlers[NUM_TIMERS] = {0};

static int32_t find_unused_timer_id() {
    for (uint32_t i = 0; i < NUM_TIMERS; i++) {
        if (timer_handlers[i] == 0) return i;
    }
    ESP_LOGE(BS_TIMER_TAG, "The number of used timers has exceeded the max numbers: %d", NUM_TIMERS);
    return -1;
}


int32_t fbody_setInterval(value_t self, value_t _func, int32_t _delayMs) {
    ROOT_SET(func_rootset, 1)
    func_rootset.values[0] = _func;
    int32_t timer_id = find_unused_timer_id();
    esp_timer_handle_t timer;
    const esp_timer_create_args_t timer_args = {
        .callback = &bs_event_push_from_isr,
        .arg = (void*) func_rootset.values[0],
    };
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &timer));
    esp_timer_start_periodic(timer, _delayMs*1000);
    timer_handlers[timer_id] = timer;
    { int32_t ret_value_ = (timer_id); DELETE_ROOT_SET(func_rootset); return ret_value_; }
}


int32_t fbody_setTimeout(value_t self, value_t _func, int32_t _delayMs) {
    ROOT_SET(func_rootset, 1)
    func_rootset.values[0] = _func;
    int32_t timer_id = find_unused_timer_id();
    esp_timer_handle_t timer;
    const esp_timer_create_args_t timer_args = {
        .callback = &bs_event_push_from_isr,
        .arg = (void*) func_rootset.values[0],
    };
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &timer));
    esp_timer_start_once(timer, _delayMs*1000);
    timer_handlers[timer_id] = timer;
    { int32_t ret_value_ = (timer_id); DELETE_ROOT_SET(func_rootset); return ret_value_; }
}


void fbody_clearInterval(value_t self, int32_t _timerId) {
    esp_timer_handle_t timer = timer_handlers[_timerId];
    esp_timer_stop(timer);
    esp_timer_delete(timer);
    timer_handlers[_timerId] = 0;
}


void fbody_clearTimeout(value_t self, int32_t _timerId) {
    esp_timer_handle_t timer = timer_handlers[_timerId];
    esp_timer_delete(timer);
    timer_handlers[_timerId] = 0;
}

int32_t fbody_getTimeUs(value_t self) {
    return (int32_t)esp_timer_get_time();
}


struct func_body _setInterval = { fbody_setInterval, "(()vi)i" };
struct func_body _setTimeout = { fbody_setTimeout, "(()vi)i" };
struct func_body _clearInterval = { fbody_clearInterval, "(i)v" };
struct func_body _clearTimeout = { fbody_clearTimeout, "(i)v" };
struct func_body _getTimeUs = { fbody_getTimeUs, "(v)i" };