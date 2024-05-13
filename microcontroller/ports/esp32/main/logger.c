#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "include/logger.h"

#define BS_LOGGER_TAG "BS_LOGGER"

#define LOG_QUEUE_LENGTH        10

static void (* log_sender)(uint8_t*, uint32_t);


typedef struct {
    char*    str;
    uint32_t str_len;
} log_t;

static QueueHandle_t log_queue;


void bs_logger_register_sender(void (* sender)(uint8_t*, uint32_t)) {
    log_sender = sender;
}


void bs_logger_push_log(char *str, uint32_t str_len) {
    log_t log;
    log.str = str;
    log.str_len = str_len;
    xQueueSend(log_queue, &log, portMAX_DELAY);
}


void bs_logger_task(void *arg) {
    log_t log;
    log_queue = xQueueCreate(LOG_QUEUE_LENGTH, sizeof(log_t));

    while (true) {
       xQueueReceive(log_queue, &log, portMAX_DELAY);
       log_sender((uint8_t *)log.str, log.str_len);
    }
}

