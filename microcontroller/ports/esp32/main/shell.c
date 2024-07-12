#include <stdio.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "esp_timer.h"

#include "include/shell.h"
#include "include/logger.h"
#include "c-runtime.h"

#define BS_SHELL_TAG "BS_SHELL"

# define TASK_QUEUE_LENGTH   3

typedef enum {
    TASK_CMD_NONE  = 0x00,
    TASK_CMD_LOAD  = 0x01,
    TASK_CMD_JUMP  = 0x02,
    TASK_CMD_RESET = 0x03,
    TASK_CMD_END   = 0x04,
} task_cmd_t;

typedef union {
    task_cmd_t cmd;

    struct task_jump {
        task_cmd_t cmd;
        uint32_t to;
    } jump;
} task_item_u;

static QueueHandle_t task_queue;


static uint32_t __attribute__((section(".iram0.data"))) virtual_text[4000];
static uint8_t virtual_data[30000];


void bs_shell_set_tasks(uint8_t *task_data, int data_len) {
    int idx = 0;
    while (idx < data_len) {
        switch (task_data[idx]) {
        case TASK_CMD_LOAD:
        // | cmd(1byte) | address(4byte) | size(4byte) | data(size) |
        {
            uint32_t address = *(uint32_t*)(task_data + (idx+1));
            uint32_t size = *(uint32_t*)(task_data + (idx+5));
            memcpy(address, task_data + (idx+9), size);
            idx += (9 + size);
            break;
        }
        case TASK_CMD_JUMP:
        // | cmd(1byte) | address(4byte) |
        {
            task_item_u task;
            task.jump.cmd = TASK_CMD_JUMP;
            task.jump.to = *(uint32_t*)(task_data + (idx+1));
            xQueueSend(task_queue, &task, portMAX_DELAY);
            idx += 5;
            break;
        }
        case TASK_CMD_RESET:
        // | cmd (1byte) | 
        {
            task_item_u task;
            task.cmd = TASK_CMD_RESET;
            xQueueSend(task_queue, &task, portMAX_DELAY);
            idx += 1;
            break;
        }
        case TASK_CMD_END:
        // | cmd(1byte) |
            return;
        default:
            return;
        }
    }
}


static void reset() {
    // Reset memory.
    memset(virtual_text, 0, sizeof(virtual_text));
    memset(virtual_data, 0, sizeof(virtual_data));
    // Reset entry-point queue.
    xQueueReset(task_queue);

    gc_initialize();
}

void bs_shell_task(void *arg) {
    task_item_u task_item;
    task_queue = xQueueCreate(TASK_QUEUE_LENGTH, sizeof(task_item_u));
    reset();
    
    while (true) {
        xQueueReceive(task_queue, &task_item, portMAX_DELAY);

        switch (task_item.cmd) {
            case TASK_CMD_JUMP:
                ESP_LOGI(BS_SHELL_TAG, "Jump to %x", (int)task_item.jump.to);
                uint32_t start_us = esp_timer_get_time();
                try_and_catch((void *)task_item.jump.to);
                uint32_t end_us = esp_timer_get_time();
                printf("execution time: %f ms\n", (float)(end_us - start_us) / 1000.0);
                break;
            case TASK_CMD_RESET:
                ESP_LOGI(BS_SHELL_TAG, "Soft reset");
                reset();
                bs_logger_reset();
                break;
            default:
                ESP_LOGE(BS_SHELL_TAG, "Unknown task command.");
                break;
            }
    }
}
