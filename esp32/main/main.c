#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "bluescript-init.h"
#include "hardwarelib.h"
#include <math.h>
#include "user-program.c"

void user_task() {
    try_and_catch(_setup.fptr);
    while (true) {
        try_and_catch(_loop.fptr);
    }
}


void app_main(void)
{
    bluescript_init();
    init_hardwarelib();

    try_and_catch((void *)bluescript_main2);
    xTaskCreate(user_task, "user_task", 1024 * 8, NULL, 0, NULL);

    while (true){
        vTaskDelay(1000/portTICK_PERIOD_MS);
    }
}