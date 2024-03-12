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
#include "esp_timer.h"

#include "esp_system.h"
#include "driver/spi_master.h"
#include "driver/gpio.h"
#include "freertos/queue.h"
#include "driver/gpio.h"

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

// Timer
extern struct func_body HL_ATTR _createOneShotTimer;
extern struct func_body HL_ATTR _startOneShotTimer;
extern struct func_body HL_ATTR _deleteOneShotTimer;


// Display
void fbody_displayReset(value_t self);
void fbody_displayInit(value_t self);
void fbody_displayShowIcon(value_t self, int32_t _icon, int32_t _color, int32_t _background);
void fbody_displayShowString(value_t self, value_t _str, int32_t _color, int32_t _background);
void fbody_displayFill(value_t self, int32_t _color);
int32_t fbody_getColor(value_t self, int32_t _r, int32_t _g, int32_t _b);
void fbody_buttonOnPressed(value_t self, int32_t _buttonPin, value_t _callback);
int32_t fbody_randInt(value_t self, int32_t _min, int32_t _max);

extern struct func_body HL_ATTR _displayInit;
extern struct func_body HL_ATTR _displayReset;
extern struct func_body HL_ATTR _displayShowIcon;
extern struct func_body HL_ATTR _displayShowString;
extern struct func_body HL_ATTR _displayShowInt;
extern struct func_body HL_ATTR _displayFill;
extern struct func_body HL_ATTR _getColor;

// Button
extern struct func_body HL_ATTR _buttonOnPressed;

// Util
extern struct func_body HL_ATTR _randInt;

#endif // __HARDWARELIB_H__