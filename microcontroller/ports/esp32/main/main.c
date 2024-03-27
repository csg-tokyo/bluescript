#include <stdio.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "shell.h"
#include "logger.h"
#include "ble.h"


void app_main(void) {
    bs_ble_init();
    // bs_logger_register_sender(bs_ble_send_str);

    // xTaskCreatePinnedToCore(bs_shell_task, "bs_shell_task", 4096, NULL, 1, NULL, 0);
    // xTaskCreatePinnedToCore(bs_logger_task, "bs_logger_task", 4096, NULL, 1, NULL, 0);

    while (true){
        vTaskDelay(1000/portTICK_PERIOD_MS);
    }
}
