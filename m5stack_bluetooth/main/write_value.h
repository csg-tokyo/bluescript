#ifndef __WRITE_VALUE__
#define __WRITE_VALUE__
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "esp_gatts_api.h"

extern uint8_t __attribute__((section(".iram0.data"))) my_text[1000];
extern int my_literal_size; // literalは必ずtext領域の最初にくる。
extern uint8_t exec_func_num;
extern uint8_t exec_func_offsets[20];
extern int can_exec;


void write_value_A(uint8_t *value, int value_len);

void write_value_B(uint8_t *value, int value_len);

void write_value_C(uint8_t *value, int value_len);

#endif /* __WRITE_VALUE__ */