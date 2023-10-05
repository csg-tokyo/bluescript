#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "bluescript-init.h"
#include "hardwarelib.h"
#include "user-program.c"

void user_task() {
    bluescript_main2();
    ((void (*)())_setup.fptr)();
    while (true) {
        ((void (*)())_loop.fptr)();
    }
}


void app_main(void)
{
    bluescript_init();
    init_hardwarelib();

    xTaskCreate(user_task, "user_task", 1024 * 2, NULL, 0, NULL);

    while (true){
        vTaskDelay(1000/portTICK_PERIOD_MS);
    }
}
