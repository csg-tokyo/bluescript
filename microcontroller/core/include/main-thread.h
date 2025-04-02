#ifndef __BS_MAIN_THREAD__
#define __BS_MAIN_THREAD__

#include <stdint.h>
#include "c-runtime.h"

void bs_main_thread_init();

void bs_main_thread_reset();

void bs_main_thread_set_main(int32_t id, void* main);

void bs_main_thread_set_event(value_t fn);

#endif /* __BS_MAIN_THREAD__ */