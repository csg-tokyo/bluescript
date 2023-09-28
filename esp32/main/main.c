#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "bluetooth.h"
#include "executor.h"
#include "c-runtime.h"
#include "bluescript-log.h"
#include "hardwarelib.h"


void app_main(void)
{
    init_bluetooth();
    init_hardwarelib();
    register_event_handlers(executor_set_repl, executor_set_onetime, executor_clear);
    xTaskCreatePinnedToCore(exec_code_task, "exec_code_task", 4096, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(bluescript_log_task, "send_log_task", 4096, NULL, 1, NULL, 0);

    while (true){
        vTaskDelay(1000/portTICK_PERIOD_MS);
    }
}
