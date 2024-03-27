#include <stdio.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "shell.h"
// #include "c-runtime.h"

#define TAG "BS_SHELL"

void bs_shell_execute_code(uint8_t *code, int code_len) {
    puts("foooo");
}


void bs_shell_soft_reset() {
    puts("bs_shell_soft_reset");
}


void bs_shell_task(void *arg) {

}
