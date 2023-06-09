#ifndef __UTILS__
#define __UTILS__
#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include "c-runtime.h"


void blink_led();

void configure_led(void);
void led_on(uint32_t index, uint32_t red, uint32_t green, uint32_t blue);
void led_off();

void configure_speaker(void);
void speaker_on(uint32_t freq);
void speaker_off(void);

void wait_ms(int ms);

void console_log(value_t str);
void console_log_number(int32_t n);

void _console_log_number(int32_t n);

struct my_rel_table_entry {
    void* address;
};
extern struct my_rel_table_entry my_rel_table[100];


#endif /* __UTILS__ */