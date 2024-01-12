#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include <sys/time.h>

#include "sdkconfig.h"
#include "executor.h"
#include "c-runtime.h"

#define TAG "EXECUTOR"

SemaphoreHandle_t executor_semphr;


uint32_t __attribute__((section(".iram0.data"))) virtual_text[5000];
uint32_t __attribute__((section(".iram0.data"))) virtual_literal[1500];
uint8_t DRAM_ATTR virtual_data[30000];


uint32_t entry_point;

int text_used_memory = 0;
int literal_used_memory = 0;
int data_used_memory = 0;


void init(void) {
    gc_initialize();
    memset(virtual_text, 0, sizeof(virtual_text));
    memset(virtual_literal, 0, sizeof(virtual_literal));
    memset(virtual_data, 0, sizeof(virtual_data));
    text_used_memory = 0;
    literal_used_memory = 0;
    data_used_memory = 0;
}


void set_memories(uint8_t *exe) {
    uint32_t* exe32 = (uint32_t*) exe;
    uint32_t new_text_size = exe32[0]; // byte
    uint32_t new_literal_size = exe32[1]; // byte
    uint32_t new_data_size = exe32[2]; // byte

    entry_point = exe32[3];
    uint32_t* body_start = exe32 + 4;
    memcpy(virtual_text + text_used_memory/4, body_start, new_text_size); // text
    memcpy(virtual_literal + literal_used_memory/4, body_start + new_text_size / 4, new_literal_size); // literal
    memcpy(virtual_data + data_used_memory, body_start + (new_text_size + new_literal_size)/4, new_data_size); // data

    text_used_memory += new_text_size;
    literal_used_memory += new_literal_size;
    data_used_memory += new_data_size;
}


void executor_set_repl(uint8_t *value, int value_len) {
    ESP_LOGI(TAG, "REPL");
    esp_log_buffer_hex(TAG, value, value_len);
    set_memories(value);
    xSemaphoreGive(executor_semphr);
}


void executor_set_onetime(uint8_t *value, int value_len) {
    ESP_LOGI(TAG, "ONETIME");
    esp_log_buffer_hex(TAG, value, value_len);
    init();
    set_memories(value);
    xSemaphoreGive(executor_semphr);
}


void executor_clear(uint8_t *value, int value_len) {
    ESP_LOGI(TAG, "CLEAR");
    init();
}


void exec_code_task(void *arg) {
    init();
    executor_semphr = xSemaphoreCreateBinary();

    while (true) {
        xSemaphoreTake(executor_semphr, portMAX_DELAY);
        try_and_catch((void *)entry_point);
    }
}