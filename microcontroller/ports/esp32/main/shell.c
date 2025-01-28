#include <stdio.h>
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "esp_timer.h"
#include "esp_partition.h"
#include "esp_heap_caps.h"
#include "esp_memory_utils.h"

#include "include/shell.h"
#include "include/logger.h"
#include "include/cmd.h"
#include "c-runtime.h"

#define BS_SHELL_TAG "BS_SHELL"

# define TASK_QUEUE_LENGTH   3

typedef union {
    bs_cmd_t cmd;

    struct task_jump {
        bs_cmd_t cmd;
        int32_t id;
        uint32_t to;
    } jump;
} task_item_u;

static QueueHandle_t task_queue;

static void (* result_sender)(uint8_t*, uint32_t);


// variables for ram
uint32_t *iram;
size_t    iram_size;
uint32_t *dram;
size_t    dram_size;

// variables for flash partition
#define TEXT_PARTITION_LABEL "text"
static esp_partition_t *text_partition = NULL;
static uint8_t *virtual_flash_ptr = NULL;
static esp_partition_mmap_handle_t virtual_flash_hdlr;


// RAM

static void ram_init() {
    iram_size = heap_caps_get_largest_free_block(MALLOC_CAP_EXEC | MALLOC_CAP_32BIT) - 4;
    iram = heap_caps_malloc(iram_size, MALLOC_CAP_EXEC | MALLOC_CAP_32BIT);
    dram_size = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT) / 2;
    dram = heap_caps_malloc(dram_size, MALLOC_CAP_8BIT);
    ESP_LOGI(BS_SHELL_TAG, "IRAM Size: %d\n", iram_size);
    ESP_LOGI(BS_SHELL_TAG, "DRAM Size: %d\n", dram_size);
}

static void ram_reset() {
    memset(iram, 0, iram_size);
    memset(dram, 0, dram_size);
}

static void ram_memcpy(uint8_t* ram_dest, uint8_t *src, size_t len) {
    memcpy(ram_dest, src, len);
}


// Flash

static void flash_init() {
    text_partition = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, TEXT_PARTITION_LABEL);
    ESP_ERROR_CHECK(esp_partition_erase_range(text_partition, 0, text_partition->size));
    esp_partition_mmap(text_partition, 0, text_partition->size, ESP_PARTITION_MMAP_INST, &virtual_flash_ptr, &virtual_flash_hdlr);
}

static void flash_reset() {
    ESP_ERROR_CHECK(esp_partition_erase_range(text_partition, 0, text_partition->size));
}

static uint32_t flash_read_address() {
    return (uint32_t)virtual_flash_ptr;
}

static uint32_t flash_read_size() {
    return (uint32_t)text_partition->size;
}

static void flash_memcpy(uint8_t* flash_dest, uint8_t *src, size_t len) {
    uint8_t* offset = flash_dest - virtual_flash_ptr;
    ESP_ERROR_CHECK(esp_partition_write(text_partition, offset, src, len));
}

static void bs_memcpy(uint8_t* dest, uint8_t *src, size_t len) {
    if (virtual_flash_ptr <= dest && dest <= virtual_flash_ptr + flash_read_size()) {
        flash_memcpy(dest, src, len);
    } else {
        ram_memcpy(dest, src, len);
    }
}

void bs_shell_register_sender(void (* sender)(uint8_t*, uint32_t)) {
    result_sender = sender;
}


void bs_shell_receptionist(uint8_t *task_data, int data_len) {
    int idx = 0;
    while (idx < data_len) {
        switch (task_data[idx]) {
        case BS_CMD_LOAD:
        // | cmd(1byte) | address(4byte) | size(4byte) | data(size) |
        {
            uint32_t address = *(uint32_t*)(task_data + (idx+1));
            uint32_t size = *(uint32_t*)(task_data + (idx+5));
            ESP_LOGI(BS_SHELL_TAG, "Load %d bytes to %x", (int)size, (int)address);
            bs_memcpy(address, task_data + (idx+9), size);
            idx += (9 + size);
            break;
        }
        case BS_CMD_JUMP:
        // | cmd(1byte) | id(4byte) | address(4byte) |
        {
            task_item_u task;
            task.jump.cmd = BS_CMD_JUMP;
            task.jump.id = *(uint32_t*)(task_data + (idx+1));
            task.jump.to = *(uint32_t*)(task_data + (idx+5));
            xQueueSend(task_queue, &task, portMAX_DELAY);
            idx += 9;
            break;
        }
        case BS_CMD_RESET:
        // | cmd (1byte) | 
        {
            task_item_u task;
            task.cmd = BS_CMD_RESET;
            xQueueSend(task_queue, &task, portMAX_DELAY);
            idx += 1;
            break;
        }
        case BS_CMD_END:
        // | cmd(1byte) |
            return;
        default:
            return;
        }
    }
}

static void shell_init() {
    ram_init();
    flash_init();
    gc_initialize();
}

static void shell_reset() {
    xQueueReset(task_queue);
    gc_initialize();
    bs_logger_reset();
}

static void send_result_meminfo() {
    uint8_t result[25];
    result[0] = BS_CMD_RESULT_MEMINFO;
    *(uint32_t*)(result+ 1) = iram;
    *(uint32_t*)(result+ 5) = iram_size;
    *(uint32_t*)(result+ 9) = dram;
    *(uint32_t*)(result+13) = dram_size;
    *(uint32_t*)(result+17) = flash_read_address();
    *(uint32_t*)(result+21) = flash_read_size();
    result_sender(result, 25);
}

static void send_result_exectime(int32_t id, float exectime) {
    uint8_t result[9];
    result[0] = BS_CMD_RESULT_EXECTIME;
    *(int32_t*)(result+1) = id;
    *(float*)(result+5) = exectime;
    result_sender(result, 9);
}


void bs_shell_task(void *arg) {
    task_item_u task_item;
    task_queue = xQueueCreate(TASK_QUEUE_LENGTH, sizeof(task_item_u));
    shell_init();
    shell_reset();
    
    while (true) {
        xQueueReceive(task_queue, &task_item, portMAX_DELAY);

        switch (task_item.cmd) {
            case BS_CMD_JUMP:
                ESP_LOGI(BS_SHELL_TAG, "Jump to %x, id: %d", (int)task_item.jump.to, (int)task_item.jump.id);
                uint32_t start_us = esp_timer_get_time();
                try_and_catch((void *)task_item.jump.to);
                uint32_t end_us = esp_timer_get_time();
                float exectime = (float)(end_us - start_us) / 1000.0;
                send_result_exectime(task_item.jump.id, exectime);
                break;
            case BS_CMD_RESET:
                ESP_LOGI(BS_SHELL_TAG, "Soft reset");
                shell_reset();
                send_result_meminfo();
                break;
            default:
                ESP_LOGE(BS_SHELL_TAG, "Unknown task command.");
                break;
            }
    }
}
