#include <stdio.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "include/shell.h"
#include "include/logger.h"
#include "include/event.h"
#include "include/ble.h"
#include "profiler.h"


void app_main(void) {
    bs_ble_init();
    bs_logger_register_sender(bs_ble_send_notification);
    bs_shell_register_sender(bs_ble_send_notification);

    xTaskCreatePinnedToCore(bs_shell_task, "bs_shell_task", 4096, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(bs_logger_task, "bs_logger_task", 4096, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(bs_event_handler_task, "bs_event_handler_task", 4096, NULL, 1, NULL, 0);

    // should be deleted
    bs_profiler_typecount(0, 0, 0, 0, 0, 0);
}
