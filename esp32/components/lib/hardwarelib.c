#include "hardwarelib.h"

char* HL_ATTR dummy_str = "";

// This function should be called so that .hardwarelib won't be deleted by linker.
void init_hardwarelib() {
    printf("%s", dummy_str);
    return;
}

static int get_num_length(int n) {
    if (n == 0) { return 1; }
    int current_num = n;
    int digit = 0;
    while(current_num != 0){
        current_num = current_num / 10;
        digit += 1;
    }
    return n;
}

void fbody_console_log_integer(value_t self, int32_t _n) {
    printf("%d\n", _n);
    int num_length = get_num_length(_n);
    char str[num_length + 1];
    snprintf(str, num_length, "%d", _n);
    bluescript_log_push(str);
}
struct func_body HL_ATTR _console_log_integer = { fbody_console_log_integer, "(i)v" };


// UTILS
static void fbody_waitMs(value_t self, int32_t _ms) {
    vTaskDelay(_ms / portTICK_PERIOD_MS);
}
struct func_body HL_ATTR _waitMs = { fbody_waitMs, "(i)v" };

// PWM
#define LEDC_MODE               LEDC_LOW_SPEED_MODE
#define LEDC_DUTY_RES           LEDC_TIMER_13_BIT
#define LEDC_FREQUENCY          (5000)

typedef struct _channel_t {
    gpio_num_t pin_id;
    int timer_id;
} channel_t;

static channel_t channels[LEDC_CHANNEL_MAX];

static void fbody_initPWM(value_t self, int32_t _channelId, int32_t _timerId, int32_t _pinId) {
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
}
struct func_body HL_ATTR _initPWM = { fbody_initPWM, "(iii)v" };

static void fbody_setPWMDuty(value_t self, int32_t _channelId, float _duty) {
    if (_duty < 0 || _duty > 1) {
        printf("duty should be 0 < duty < 1\n");
        return;
    }
    uint32_t duty = ((0b01 << 13) - 1) * _duty;
    ESP_ERROR_CHECK(ledc_set_duty(LEDC_MODE, _channelId, duty));
    ESP_ERROR_CHECK(ledc_update_duty(LEDC_MODE, _channelId));
}
struct func_body HL_ATTR _setPWMDuty = { fbody_setPWMDuty, "(if)v" };

static void fbody_stopPWM(value_t self, int32_t _channelId) {
    ESP_ERROR_CHECK(ledc_stop(LEDC_MODE, _channelId, 0));
}
struct func_body HL_ATTR _stopPWM = { fbody_stopPWM, "(i)v" };

static void fbody_deinitPWM(value_t self, int32_t _channelId) {
    ESP_ERROR_CHECK(ledc_stop(LEDC_MODE, _channelId, 0));
    esp_rom_gpio_connect_out_signal(channels[_channelId].pin_id, LEDC_LS_SIG_OUT0_IDX + _channelId, false, true);
}
struct func_body HL_ATTR _deinitPWM = { fbody_deinitPWM, "(i)v" };


// LED
static led_strip_t *pStrip_a;

static void fbody_configLED(value_t self, int32_t _channelId, int32_t _pinId, int32_t _numLED) {
    pStrip_a = led_strip_init(_channelId, _pinId, _numLED);
    pStrip_a->clear(pStrip_a, 50);
}
struct func_body HL_ATTR _configLED = { fbody_configLED, "(iii)v" };

static void fbody_setLEDPixel(value_t self, int32_t _index, int32_t _red, int32_t _green, int32_t _blue) {
    pStrip_a->set_pixel(pStrip_a, _index, _red, _green, _blue);
}
struct func_body HL_ATTR _setLEDPixel = { fbody_setLEDPixel, "(iiii)v" };

static void fbody_refreshLED(value_t self) {
    pStrip_a->refresh(pStrip_a, 50);
}
struct func_body HL_ATTR _refreshLED = { fbody_refreshLED, "()v" };

static void fbody_clearLED(value_t self) {
    pStrip_a->clear(pStrip_a, 50);
}
struct func_body HL_ATTR _clearLED = { fbody_clearLED, "()v" };
