#ifndef __HARDWARELIB_H__
#define __HARDWARELIB_H__

#include <stdio.h>
#include <string.h>

#include "driver/ledc.h"
#include "esp_err.h"
#include "soc/gpio_sig_map.h"
#include "soc/ledc_periph.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "bluescript-log.h"
#include "c-runtime.h"
#include "led_strip.h"

#define HL_ATTR __attribute__((section(".hardwarelib")))

void init_hardwarelib();

extern struct func_body HL_ATTR _console_log_integer;
extern struct func_body HL_ATTR _waitMs;

// PWM
extern struct func_body HL_ATTR _initPWM;
extern struct func_body HL_ATTR _setPWMDuty;
extern struct func_body HL_ATTR _stopPWM;
extern struct func_body HL_ATTR _deinitPWM;

// LED
extern struct func_body HL_ATTR _configLED;
extern struct func_body HL_ATTR _setLEDPixel;
extern struct func_body HL_ATTR _refreshLED;
extern struct func_body HL_ATTR _clearLED;

#endif // __HARDWARELIB_H__