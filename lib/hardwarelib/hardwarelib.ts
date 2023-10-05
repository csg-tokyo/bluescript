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