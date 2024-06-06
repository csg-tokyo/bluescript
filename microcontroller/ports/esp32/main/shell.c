#include <stdio.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "include/shell.h"
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


// void bs_shell_execute_code(uint8_t *code, int code_len) {
//     ESP_LOGI(BS_SHELL_TAG, "Push exec command into queue.");
//     esp_log_buffer_hex(BS_SHELL_TAG, code, code_len);

//     // Set virtual memory.
//     uint32_t* code32 = (uint32_t*) code;
//     uint32_t new_text_size = code32[0];
//     uint32_t new_data_size = code32[1];
//     uint32_t entry_point = code32[2];

//     uint32_t* body_start = code32 + 3;
//     memcpy(virtual_text + used_virtual_memory.text/sizeof(uint32_t), body_start, new_text_size); // text
//     memcpy(virtual_data + used_virtual_memory.data, body_start + new_text_size/sizeof(uint32_t), new_data_size); // data

//     used_virtual_memory.text += new_text_size;
//     used_virtual_memory.data += new_data_size;

//     // Push execute code task into queue.
//     task_item_u task;
//     task.execute_code.cmd = TASK_CMD_EXECUTE_CODE;
//     task.execute_code.entry_point = entry_point;
//     xQueueSend(task_queue, &task, portMAX_DELAY);
// }


// void bs_shell_soft_reset() {
//     ESP_LOGI(BS_SHELL_TAG, "Push soft reset command into queue.");
//     task_item_u task;
//     task.cmd = TASK_CMD_SOFT_RESET;
//     xQueueSend(task_queue, &task, portMAX_DELAY);
// }


static void reset() {
    // Reset memory.
    memset(virtual_text, 0, sizeof(virtual_text));
    memset(virtual_data, 0, sizeof(virtual_data));

    // Reset entry-point queue.
    xQueueReset(task_queue);

    // Reset BlueScript heap.
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
                try_and_catch((void *)task_item.jump.to);
                break;
            case TASK_CMD_RESET:
                ESP_LOGI(BS_SHELL_TAG, "Soft reset");
                reset();
                break;
            default:
                ESP_LOGE(BS_SHELL_TAG, "Unknown task command.");
                break;
            }
    }
}
