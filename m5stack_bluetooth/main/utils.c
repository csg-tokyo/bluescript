
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <esp_task_wdt.h>
#include <driver/gpio.h>
#include "esp_log.h"
#include "led_strip.h"
#include <driver/gpio.h>
#include <driver/ledc.h>
#include "utils.h"
#include "c-runtime.h"
#include "bluescript-log.h"

static const char *TAG = "blink";
#define BLINK_GPIO GPIO_NUM_15
#define LED_RMT_CHANNEL 0


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


void _console_log_number(int32_t n) {
    int num_length = get_num_length(n);
    char str[num_length + 1];
    snprintf(str, num_length, "%d", n);
    push_log(str);
    printf("%d\n", n);
}

// TODO: 改善。以下がないと使わない関数のコードが消されてしまう。
struct my_rel_table_entry my_rel_table[100] = {
        {_console_log_number},
        {try_and_catch},
        {safe_value_to_int},
        {safe_value_to_float},
        {safe_value_to_bool},
        {value_to_truefalse},
        {any_add},
        {any_subtract},
        {any_multiply},
        {any_divide},
        {any_less},
        {any_less_eq},
        {any_greater},
        {any_greater_eq},
        {any_add_assign},
        {any_subtract_assign},
        {any_multiply_assign},
        {any_divide_assign},
        {minus_any_value},
        {gc_initialize},
        {gc_get_class_of},
        {gc_allocate_object},
        {gc_new_string},
        {gc_is_string_literal},
        {gc_string_literal_cstr},
        {gc_new_bytearray},
        {gc_bytearray_size},
        {gc_bytearray_get},
        {gc_bytearray_set},
        {gc_bytearray_set_raw_word},
        {gc_new_vector},
        {gc_vector_size},
        {gc_vector_get},
        {gc_vector_set},
        {gc_make_array},
        {gc_array_length},
        {gc_array_get},
        {gc_array_set},
        {gc_init_rootset},
        {gc_run},
        // {gc_root_set_head}
};
