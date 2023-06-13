#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "bluetooth.h"
#include "executor.h"
#include "c-runtime.h"
#include "utils.h"
#include "bluescript-log.h"


void app_main(void)
{
    init_bluetooth();
    register_event_handler(0, executor_set_repl);
    register_event_handler(1, executor_set_onetime);
    register_event_handler(2, executor_crear);

    xTaskCreatePinnedToCore(exec_code_task, "exec_code_task", 4096, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(send_log_task, "send_log_task", 4096, NULL, 1, NULL, 0);
}
