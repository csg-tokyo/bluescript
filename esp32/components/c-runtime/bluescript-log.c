#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "bluetooth.h"

#define TAG "BLUETOOTH_LOG"

#define LOG_QUEUE_LENGTH 20
#define LOG_QUEUE_ITEM_LENGTH 20


QueueHandle_t log_queue;

typedef struct {
    int size;
    char str[LOG_QUEUE_ITEM_LENGTH];
} log_fragment;


void bluescript_log_push(char *log) {
    int length = strlen(log);
    char log_with_nl[length + 1];
    sprintf(log_with_nl, "%s\n", log);
    div_t d = div(length + 1, LOG_QUEUE_ITEM_LENGTH);

    for (int i = 0; i < d.quot + 1; i++) {
        int fragment_size = (i == d.quot) ? d.rem : LOG_QUEUE_ITEM_LENGTH;

        log_fragment f;
        f.size = fragment_size;
        memcpy(f.str, log_with_nl + i * LOG_QUEUE_ITEM_LENGTH, fragment_size);
        xQueueSend(log_queue, &f, portMAX_DELAY);
    }
}


void bluescript_log_task(void *arg) {
    log_fragment buff;
    log_queue = xQueueCreate(LOG_QUEUE_LENGTH, sizeof(log_fragment));
    
    while (true) {
        xQueueReceive(log_queue, &buff, portMAX_DELAY);
        send_notification((uint8_t *)buff.str, buff.size);
    }
}
