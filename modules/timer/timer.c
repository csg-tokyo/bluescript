
#include <stdint.h>
#include <stdbool.h>
#include "esp_timer.h"
#include "esp_log.h"

#include "shell.h"
#include "timer.h"

#define BS_TIMER_TAG  "BS_TIMER"
#define NUM_TIMERS    20

extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_116105109101114();
ROOT_SET_DECL(global_rootset0_116105109101114, NUM_TIMERS);



esp_timer_handle_t timer_handlers[NUM_TIMERS] = {0};

static int32_t find_unused_timer_id() {
    for (uint32_t i = 0; i < NUM_TIMERS; i++) {
        if (timer_handlers[i] == 0) return i;
    }
    return -1;
}

int32_t fbody_116105109101114setInterval(value_t self, value_t _func, int32_t _delay) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _func;
  {
    int32_t timer_id = find_unused_timer_id();
    if (timer_id == -1) {
      runtime_error("** timer module error: all available timers have been used up. Please use clearTimeout or clearInterval.");
    }
    set_global_variable(&global_rootset0_116105109101114.values[timer_id], _func);
    esp_timer_handle_t timer;
    const esp_timer_create_args_t timer_args = {
        .callback = &bs_event_push_from_isr,
        .arg = (void*) func_rootset.values[0],
    };
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &timer));
    esp_timer_start_periodic(timer, _delay*1000);
    timer_handlers[timer_id] = timer;
    { int32_t ret_value_ = (timer_id); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _116105109101114setInterval = { fbody_116105109101114setInterval, "(()vi)i" };

int32_t fbody_116105109101114setTimeout(value_t self, value_t _func, int32_t _delay) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _func;
  {
    int32_t timer_id = find_unused_timer_id();
    if (timer_id == -1) {
      runtime_error("** timer module error: all available timers have been used up. Please use clearTimeout or clearInterval.");
    }
    set_global_variable(&global_rootset0_116105109101114.values[timer_id], _func);
    esp_timer_handle_t timer;
    const esp_timer_create_args_t timer_args = {
        .callback = &bs_event_push_from_isr,
        .arg = (void*) func_rootset.values[0],
    };
    ESP_ERROR_CHECK(esp_timer_create(&timer_args, &timer));
    esp_timer_start_once(timer, _delay*1000);
    timer_handlers[timer_id] = timer;
    { int32_t ret_value_ = (timer_id); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _116105109101114setTimeout = { fbody_116105109101114setTimeout, "(()vi)i" };

void fbody_116105109101114clearInterval(value_t self, int32_t _timerId) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    if (_timerId < 0 || _timerId >= NUM_TIMERS) {
      runtime_error("** timer module error: unknown timer id."); 
    }
    esp_timer_handle_t timer = timer_handlers[_timerId];
    esp_timer_stop(timer);
    esp_timer_delete(timer);
    global_rootset0_116105109101114.values[_timerId] = VALUE_UNDEF;
    timer_handlers[_timerId] = 0;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _116105109101114clearInterval = { fbody_116105109101114clearInterval, "(i)v" };

void fbody_116105109101114clearTimeout(value_t self, int32_t _timerId) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    if (_timerId < 0 || _timerId >= NUM_TIMERS) {
      runtime_error("** timer module error: unknown timer id."); 
    }
    esp_timer_handle_t timer = timer_handlers[_timerId];
    esp_timer_delete(timer);
    global_rootset0_116105109101114.values[_timerId] = VALUE_UNDEF;
    timer_handlers[_timerId] = 0;
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _116105109101114clearTimeout = { fbody_116105109101114clearTimeout, "(i)v" };

float fbody_116105109101114getTimeMs(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    { float ret_value_ = (esp_timer_get_time() / 1000.0); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _116105109101114getTimeMs = { fbody_116105109101114getTimeMs, "()f" };

void bluescript_main0_116105109101114() {
  ROOT_SET_INIT(global_rootset0_116105109101114, 10)
}
