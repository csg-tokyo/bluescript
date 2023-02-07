#ifndef __MY_UTILS__
#define __MY_UTILS__
#include <stdio.h>
#include <string.h>
#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <esp_task_wdt.h>
#include <driver/gpio.h>
#include "esp_log.h"
#include "led_strip.h"
#include <driver/gpio.h>
#include <driver/ledc.h>
#include "handle_log.h"
#include "gc.h"


void blink_led();

void configure_led(void);
void led_on(uint32_t index, uint32_t red, uint32_t green, uint32_t blue);
void led_off();

void configure_speaker(void);
void speaker_on(uint32_t freq);
void speaker_off(void);

void wait_ms(int ms);

void console_log(char *str);
void console_log_number(value_t n);

struct my_rel_table_entry {
    char symbol_name[50];
    void* address;
};
extern struct my_rel_table_entry my_rel_table[10];


#endif /* __UTILS__ */