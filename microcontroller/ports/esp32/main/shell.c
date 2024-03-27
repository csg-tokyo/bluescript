#include <stdio.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "shell.h"
#include "c-runtime.h"

#define BS_SHELL_TAG "BS_SHELL"

# define TASK_QUEUE_LENGTH   3

typedef enum {
    TASK_CMD_EXECUTE_CODE,
    TASK_CMD_SOFT_RESET,
} task_cmd_t;

typedef union {
    task_cmd_t cmd;

    struct task_execute_code {
        task_cmd_t cmd;
        uint32_t   entry_point;
    } execute_code;

} task_item_u;

static QueueHandle_t task_queue;


uint32_t __attribute__((section(".iram0.data"))) virtual_text[3000];
uint32_t __attribute__((section(".iram0.data"))) virtual_literal[1500];
uint8_t DRAM_ATTR virtual_data[30000];

typedef struct {
    uint32_t text;
    uint32_t literal;
    uint32_t data;
} used_virtual_memory_t;

static used_virtual_memory_t used_virtual_memory;


static void soft_reset() {
    // Reset memory.
    memset(virtual_text, 0, sizeof(virtual_text));
    memset(virtual_literal, 0, sizeof(virtual_literal));
    memset(virtual_data, 0, sizeof(virtual_data));

    used_virtual_memory.text = 0;
    used_virtual_memory.literal = 0;
    used_virtual_memory.data = 0;

    // Reset entry-point queue.
    xQueueReset(task_queue);

    // Reset BlueScript heap.
    gc_initialize();
}


void bs_shell_execute_code(uint8_t *code, int code_len) {
    ESP_LOGI(BS_SHELL_TAG, "Push exec command into queue.");
    esp_log_buffer_hex(BS_SHELL_TAG, code, code_len);

    // Set virtual memory.
    uint32_t* code32 = (uint32_t*) code;
    uint32_t new_text_size = code32[0];
    uint32_t new_literal_size = code32[1];
    uint32_t new_data_size = code32[2];

    uint32_t entry_point = code32[3];
    uint32_t* body_start = code32 + 4;

    memcpy(virtual_text + used_virtual_memory.text/4, body_start, new_text_size); // text
    memcpy(virtual_literal + used_virtual_memory.literal/4, body_start + new_text_size / 4, new_literal_size); // literal
    memcpy(virtual_data + used_virtual_memory.data, body_start + (new_text_size + new_literal_size)/4, new_data_size); // data

    used_virtual_memory.text += new_text_size;
    used_virtual_memory.literal += new_literal_size;
    used_virtual_memory.data += new_data_size;

    // Push execute code task into queue.
    task_item_u task;
    task.execute_code.cmd = TASK_CMD_EXECUTE_CODE;
    task.execute_code.entry_point = entry_point;
    xQueueSend(task_queue, &task, portMAX_DELAY);
}


void bs_shell_soft_reset() {
    ESP_LOGI(BS_SHELL_TAG, "Push soft reset command into queue.");
    task_item_u task;
    task.cmd = TASK_CMD_SOFT_RESET;
    xQueueSend(task_queue, &task, portMAX_DELAY);
}


void bs_shell_task(void *arg) {
    task_item_u task_item;
    task_queue = xQueueCreate(TASK_QUEUE_LENGTH, sizeof(task_item_u));
    soft_reset();
    
    while (true) {
        xQueueReceive(task_queue, &task_item, portMAX_DELAY);

        switch (task_item.cmd) {
            case TASK_CMD_EXECUTE_CODE:
                ESP_LOGI(BS_SHELL_TAG, "Start execute code.");
                try_and_catch((void *)task_item.execute_code.entry_point);
                break;
            case TASK_CMD_SOFT_RESET:
                ESP_LOGI(BS_SHELL_TAG, "Soft reset.");
                soft_reset();
                break;
            default:
                ESP_LOGE(BS_SHELL_TAG, "Unknown write handler.");
                break;
            }
    }
}
