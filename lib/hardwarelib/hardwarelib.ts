import { integer, code, float } from "../utils";

export function console_log_integer(n: integer) {
    code`
    int num_length = get_num_length(_n);
    char str[num_length + 1];
    snprintf(str, num_length, "%d", _n);
    push_log(str);
    printf("%d\n", _n);
    `
}

// UTILS
code`
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
`

export function waitMs(ms: integer) {
    code`
    vTaskDelay(_ms / portTICK_PERIOD_MS);
    `
}

// PWM
code`
#include "driver/ledc.h"
#include "esp_err.h"
#include "soc/gpio_sig_map.h"

#define LEDC_MODE               LEDC_LOW_SPEED_MODE
#define LEDC_DUTY_RES           LEDC_TIMER_13_BIT
#define LEDC_FREQUENCY          (5000)

typedef struct _channel_t {
    gpio_num_t pin_id;
    int timer_id;
} channel_t;

static channel_t channels[LEDC_CHANNEL_MAX];
`

export function initPWM(channelId: integer, timerId: integer, pinId: integer) {
    code`
    if (_channelId >= LEDC_CHANNEL_MAX) {
        printf("channelId should be less than %d\n", LEDC_CHANNEL_MAX);
        return;
    }

    ledc_timer_config_t ledc_timer = {
        .speed_mode       = LEDC_MODE,
        .timer_num        = _timerId,
        .duty_resolution  = LEDC_DUTY_RES,
        .freq_hz          = LEDC_FREQUENCY,
        .clk_cfg          = LEDC_AUTO_CLK
    };
    ESP_ERROR_CHECK(ledc_timer_config(&ledc_timer));

    ledc_channel_config_t ledc_channel = {
        .speed_mode     = LEDC_MODE,
        .channel        = _channelId,
        .timer_sel      = _timerId,
        .intr_type      = LEDC_INTR_DISABLE,
        .gpio_num       = _pinId,
        .duty           = 0, 
        .hpoint         = 0
    };
    ESP_ERROR_CHECK(ledc_channel_config(&ledc_channel));

    channels[_channelId].pin_id = _pinId;
    channels[_channelId].timer_id = _timerId;
    `
}

export function setPWMDuty(channelId: integer, duty: float) {
    code`
    if (_duty < 0 || _duty > 1) {
        printf("duty should be 0 < duty < 1\n");
        return;
    }
    uint32_t duty = ((0b01 << 13) - 1) * _duty;
    ESP_ERROR_CHECK(ledc_set_duty(LEDC_MODE, _channelId, duty));
    ESP_ERROR_CHECK(ledc_update_duty(LEDC_MODE, _channelId));
    `
}

export function stopPWM(channelId: integer) {
    code`
    ESP_ERROR_CHECK(ledc_stop(LEDC_MODE, _channelId, 0));
    `
}

export function deinitPWM(channelId: integer) {
    code`
    ESP_ERROR_CHECK(ledc_stop(LEDC_MODE, _channelId, 0));
    esp_rom_gpio_connect_out_signal(channels[_channelId].pin_id, LEDC_LS_SIG_OUT0_IDX + _channelId, false, true);
    `
}

// LED
code`
#include "led_strip.h"

static led_strip_t *pStrip_a;
`

export function configLED(channelId: integer, pinId: integer, numLED: integer) {
    code`
    pStrip_a = led_strip_init(_channelId, _pinId, _numLED);
    pStrip_a->clear(pStrip_a, 50);
    `
}

export function setLEDPixel(index: integer, red: integer, green: integer, blue: integer) {
    code`
    pStrip_a->set_pixel(pStrip_a, _index, _red, _green, _blue);
    `
}

export function refreshLED() {
    code`
    pStrip_a->refresh(pStrip_a, 50);
    `
}

export function clearLED() {
    code`
    pStrip_a->clear(pStrip_a, 50);
    `
}

// Timer
code`
#include "esp_timer.h"

esp_timer_handle_t oneshot_timer;

static cb_caller(void *cb) {
    ROOT_SET(func_rootset, 1)
    func_rootset.values[0] = _cb;
    ((void (*)(value_t))gc_function_object_ptr(func_rootset.values[0], 0))(get_obj_property(func_rootset.values[0], 2));
    DELETE_ROOT_SET(func_rootset)
}
`

export function createOneShotTimer(cb: () => void) {
    code`
    const esp_timer_create_args_t oneshot_timer_args = {
        .callback = &cb_caller,
        .arg = (void*) gc_new_function(_clearLED.fptr, _clearLED.signature, VALUE_UNDEF),
        .name = "one-shot"
    };
    ESP_ERROR_CHECK(esp_timer_create(&oneshot_timer_args, &oneshot_timer));
    `
}

export function startOneShotTimer(timeUs: integer) {
    code`
    esp_timer_start_once(oneshot_timer, _timerUs);
    `
}

export function deleteOneShotTimer() {
    code`
    ESP_ERROR_CHECK(esp_timer_delete(oneshot_timer));
    `
}