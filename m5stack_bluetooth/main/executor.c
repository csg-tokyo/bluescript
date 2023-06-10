#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "sdkconfig.h"
#include "executor.h"
#include "c-runtime.h"

#define TAG "EXECUTOR"

SemaphoreHandle_t executor_semphr;


uint8_t __attribute__((section(".iram0.data"))) virtual_text[1000] = {0x36, 0x41, 0x00, 0x0c, 0x22, 0x1d, 0xf0, 0x00};
uint8_t __attribute__((section(".iram0.data"))) virtual_literal[500];
uint8_t virtual_data[1000];
uint8_t virtual_rodata[1000];
uint8_t virtual_bss[200];


uint32_t entry_point;

int text_used_memory = 0;
int literal_used_memory = 0;
int data_used_memory = 0;
int rodata_used_memory = 0;
int bss_used_memory = 0;


void init(void) {
    gc_initialize();
    memset(virtual_text, 0, sizeof(virtual_text));
    memset(virtual_literal, 0, sizeof(virtual_literal));
    memset(virtual_data, 0, sizeof(virtual_data));
    memset(virtual_rodata, 0, sizeof(virtual_rodata));
    memset(virtual_bss, 0, sizeof(virtual_bss));
    text_used_memory = 0;
    literal_used_memory = 0;
    data_used_memory = 0;
    rodata_used_memory = 0;
    bss_used_memory = 0;
}


void set_memories(uint8_t *exe) {
    uint8_t new_text_size = exe[0];
    uint8_t new_literal_size = exe[1];
    uint8_t new_data_size = exe[2];
    uint8_t new_rodata_size = exe[3];
    printf("text: %d", new_text_size);
    // uint8_t bss_size = value[4]; // Discard bss section size, because bss always same value.
    entry_point = ((uint32_t)exe[5] << 24) | ((uint32_t)exe[6] << 16) | ((uint32_t) exe[7] << 8) | ((uint32_t) exe[8]);
    printf("entry point %x\n", entry_point);
    printf("text address: %p\n", virtual_text);
    int next_index = 9;
    memcpy(virtual_text + text_used_memory, exe + next_index, new_text_size); // text
    memcpy(virtual_literal + literal_used_memory, exe + next_index + new_text_size, new_literal_size); // literal
    memcpy(virtual_data + data_used_memory, exe + next_index + new_text_size + new_literal_size, new_data_size); // data
    memcpy(virtual_rodata + rodata_used_memory, exe + next_index + new_text_size + new_literal_size + new_data_size, new_rodata_size); // rodata

    text_used_memory += new_text_size;
    literal_used_memory += new_literal_size;
    data_used_memory += new_data_size;
    rodata_used_memory += new_data_size;
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


// Clear
void executor_crear(uint8_t *value, int value_len) {
    ESP_LOGI(TAG, "CLEAR");
    init();
}


void exec_code_task(void *arg) {
    executor_semphr = xSemaphoreCreateBinary();

    while (true) {
        xSemaphoreTake(executor_semphr, portMAX_DELAY);
        ((void(*)(void))(entry_point))();
    }
}