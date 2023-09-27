
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <driver/gpio.h>
#include "esp_log.h"
#include "utils.h"
#include "c-runtime.h"
#include "bs-log.h"

static const char *TAG = "UTILS";

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


void fbody_console_log_number(int32_t n) {
    int num_length = get_num_length(n);
    char str[num_length + 1];
    snprintf(str, num_length, "%d", n);
    push_log(str);
    printf("%d\n", n);
}

struct _console_log_number { void (*fptr)(value_t); const char* sig; } _console_log_number = { fbody_console_log_number, "" };
