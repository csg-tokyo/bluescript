#include "my_utils.h"
#include "gc.h"

static const char *TAG = "blink";
#define BLINK_GPIO GPIO_NUM_15
#define LED_RMT_CHANNEL 0

static uint8_t s_led_state = 0;
static led_strip_t *pStrip_a;

void configure_led(void)
{
    ESP_LOGI(TAG, "Example configured to blink addressable LED!");
    pStrip_a = led_strip_init(LED_RMT_CHANNEL, BLINK_GPIO, 1);
    pStrip_a->clear(pStrip_a, 50);
}

void blink_led()
{
    int i = 0;
    while (i < 10)
    {
        if(i % 2 == 0) {
            pStrip_a->set_pixel(pStrip_a, 0.3, 255, 16, 16);
            pStrip_a->refresh(pStrip_a, 100);
        } else {
            pStrip_a->clear(pStrip_a, 50);
        }
        i++;
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
}

void led_on(uint32_t index, uint32_t red, uint32_t green, uint32_t blue) {
    pStrip_a->set_pixel(pStrip_a, index, red, green, blue);
    pStrip_a->refresh(pStrip_a, 100);
}

void led_off() {
    pStrip_a->clear(pStrip_a, 100);
}

void configure_speaker(void) {
    gpio_config_t config;
    config.intr_type = GPIO_INTR_DISABLE;
    config.pin_bit_mask = (1ull << GPIO_NUM_25);
    config.mode = GPIO_MODE_OUTPUT;
    config.pull_up_en = GPIO_PULLUP_DISABLE;
    config.pull_down_en = GPIO_PULLDOWN_DISABLE;
    gpio_config(&config);
}

void speaker_on(uint32_t freq) {
    ledc_timer_config_t timer_config;
    timer_config.speed_mode = LEDC_HIGH_SPEED_MODE;
    timer_config.duty_resolution = LEDC_TIMER_8_BIT;
    timer_config.timer_num = LEDC_TIMER_3;
    timer_config.freq_hz = freq;
    timer_config.clk_cfg = LEDC_AUTO_CLK;
    ledc_timer_config(&timer_config);

    ledc_channel_config_t channel_config;
    channel_config.gpio_num = GPIO_NUM_25;
    channel_config.speed_mode = LEDC_HIGH_SPEED_MODE;
    channel_config.channel = LEDC_CHANNEL_1;
    channel_config.intr_type = LEDC_INTR_DISABLE;
    channel_config.timer_sel = timer_config.timer_num;
    channel_config.duty = 0x7F;
    channel_config.hpoint = 0x0;
    ledc_channel_config(&channel_config);
}

void speaker_off() {
    ledc_timer_config_t timer_config;
    timer_config.speed_mode = LEDC_HIGH_SPEED_MODE;
    timer_config.duty_resolution = LEDC_TIMER_8_BIT;
    timer_config.timer_num = LEDC_TIMER_3;
    timer_config.freq_hz = 0;
    timer_config.clk_cfg = LEDC_AUTO_CLK;
    ledc_timer_config(&timer_config);

    ledc_channel_config_t channel_config;
    channel_config.gpio_num = GPIO_NUM_25;
    channel_config.speed_mode = LEDC_HIGH_SPEED_MODE;
    channel_config.channel = LEDC_CHANNEL_1;
    channel_config.intr_type = LEDC_INTR_DISABLE;
    channel_config.timer_sel = LEDC_TIMER_3;
    channel_config.duty = 0x00;
    channel_config.hpoint = 0x0;
    ledc_channel_config(&channel_config);
}


void wait_ms(int ms) {
    vTaskDelay(ms / portTICK_PERIOD_MS);
}

void console_log(char *str) {
    printf("%s\n", str);
    write_string_log(str);
}

void console_log_number(value_t n) {
    int i = value_to_int(n);
    printf("%d\n", i);
    write_number_log(i);
}

// TODO: 改善。以下がないと使わない関数のコードが消されてしまう。
struct my_rel_table_entry my_rel_table[10] = {
        {"blink_led", blink_led},
        {"led_on", led_on},
        {"led_off", led_off},
        {"wait", wait_ms},
        {"configure_speaker", configure_speaker},
        {"speaker_on", speaker_on},
        {"speaker_off", speaker_off},
        {"console_log", console_log},
        {"console_log_number", console_log_number},
        {"gc_run", gc_run}
};