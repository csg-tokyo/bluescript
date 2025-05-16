#ifndef __BS_MAIN_THREAD__
#define __BS_MAIN_THREAD__

#include <stdint.h>
#include "c-runtime.h"

#define CORE_TEXT_SECTION __attribute__((section(".core_text")))

void CORE_TEXT_SECTION bs_main_thread_init();

void CORE_TEXT_SECTION bs_main_thread_reset();

void CORE_TEXT_SECTION bs_main_thread_set_main(int32_t id, void* address);

void CORE_TEXT_SECTION bs_main_thread_set_event(value_t fn);

void CORE_TEXT_SECTION bs_main_thread_set_event_from_isr(void* fn);

#endif /* __BS_MAIN_THREAD__ */