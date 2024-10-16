#include <string.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "include/logger.h"
#include "include/cmd.h"

#define BS_LOGGER_TAG "BS_LOGGER"

#define LOG_QUEUE_LENGTH        10

static void (* log_sender)(uint8_t*, uint32_t);


typedef struct {
    uint8_t*    str;
    uint32_t str_len;
} log_t;

static QueueHandle_t log_queue;


void bs_logger_register_sender(void (* sender)(uint8_t*, uint32_t)) {
    log_sender = sender;
}


void bs_logger_push_log(char *str) {
    uint32_t str_len = strlen(str);
    log_t log;
    log.str = (uint8_t*)malloc(str_len + 1 + 1); // contain null and cmd
    log.str[0] = BS_CMD_RESULT_LOG;
    strcpy((char*)(log.str+1), str);
    log.str_len = str_len + 1;
    xQueueSend(log_queue, &log, portMAX_DELAY);
}

void bs_logger_push_error(char *str) {
    uint32_t str_len = strlen(str);
    log_t log;
    log.str = (uint8_t*)malloc(str_len + 1 + 1); // contain null and cmd
    log.str[0] = BS_CMD_RESULT_ERROR;
    strcpy((char*)(log.str+1), str);
    log.str_len = str_len + 1;
    xQueueSend(log_queue, &log, portMAX_DELAY);
}

void bs_logger_push_profile(uint8_t *profile_buffer, int32_t len) {
    log_t log;
    log.str = (uint8_t*)malloc(len + 1); // contain cmd
    log.str[0] = BS_CMD_RESULT_PROFILE;
    memcpy(log.str+1, profile_buffer, len);
    log.str_len = len + 1;
    xQueueSend(log_queue, &log, portMAX_DELAY);
}

void bs_logger_reset() {
    xQueueReset(log_queue);
}


void bs_logger_task(void *arg) {
    log_t log;
    log_queue = xQueueCreate(LOG_QUEUE_LENGTH, sizeof(log_t));

    while (true) {
       xQueueReceive(log_queue, &log, portMAX_DELAY);
       log_sender((uint8_t *)log.str, log.str_len);
       free(log.str);
    }
}

