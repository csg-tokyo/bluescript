#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "bluescript-init.h"
#include "hardwarelib.h"


void app_main(void)
{
    bluescript_init();
    init_hardwarelib();

    while (true){
        vTaskDelay(1000/portTICK_PERIOD_MS);
    }
}
