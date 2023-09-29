#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"

#include "c-runtime.h"
#include "bluescript-log.h"
#include "bluescript-init.h"
#include "executor.h"
#include "bluetooth.h"

 
void bluescript_init() {
    init_bluetooth();
    register_event_handlers(executor_set_repl, executor_set_onetime, executor_clear);

    xTaskCreatePinnedToCore(exec_code_task, "exec_code_task", 4096, NULL, 1, NULL, 0);
    xTaskCreatePinnedToCore(bluescript_log_task, "send_log_task", 4096, NULL, 1, NULL, 0);

    gc_initialize();
}