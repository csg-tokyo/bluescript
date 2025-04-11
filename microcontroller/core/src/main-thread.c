#include <stdio.h>

#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "memory.h"
#include "utils.h"

#include "../include/main-thread.h"
#include "../include/protocol.h"

# define TASK_ITEM_QUEUE_LENGTH   5

typedef enum {
    TASK_RESET,
    TASK_CALL_MAIN,
    TASK_CALL_EVENT
} task_t;

typedef union {
    task_t task;

    struct task_call_main {
        task_t task;
        int32_t id;
        void* address;
    } call_main;

    struct task_event_call {
        task_t task;
        value_t fn;
    } call_event;
} task_item_u;

static QueueHandle_t task_item_queue;

static void main_thread_init() {
    BS_LOG_INFO("Initialize main thread")
    bs_memory_init();
    gc_initialize();
    task_item_queue = xQueueCreate(TASK_ITEM_QUEUE_LENGTH, sizeof(task_item_u));
}

static void main_thread_reset() {
    BS_LOG_INFO("Reset main thread")
    bs_memory_reset();
    gc_initialize();
    xQueueReset(task_item_queue);
}

static float task_call_main(int32_t id, void* address) {
    BS_LOG_INFO("Call main, address: %p, id: %d", (int)address, (int)id)
    uint64_t start_us = bs_timer_get_time_us();
    try_and_catch(address);
    uint64_t end_us = bs_timer_get_time_us();
    return (float)(end_us - start_us) / 1000.0;
}

static void task_call_event(value_t fn) {
    BS_LOG_INFO("Call event")
    ((void (*)(value_t))gc_function_object_ptr(fn, 0))(get_obj_property(fn, 2));
}

void main_thread(void *arg) {
    main_thread_init();

    while (true) {
        task_item_u task_item;
        xQueueReceive(task_item_queue, &task_item, portMAX_DELAY);

        switch (task_item.task) {
            case TASK_CALL_MAIN:
                float execution_time = task_call_main(task_item.call_main.id, task_item.call_main.address);
                bs_protocol_write_execution_time(task_item.call_main.id, execution_time);
                break;
            case TASK_CALL_EVENT:
                task_call_event(task_item.call_event.fn);
                break;
            case TASK_RESET:
                main_thread_reset();
                bs_memory_layout_t memory_layout;
                bs_memory_get_layout(&memory_layout);
                bs_protocol_write_memory_layout(&memory_layout);
                break;
            default:
                BS_LOG_INFO("Unknown task command.")
                break;
            }
    }
}

void bs_main_thread_init() {
    xTaskCreatePinnedToCore(main_thread, "bs_main_thread", 4096 * 16, NULL, 5, NULL, 0);
}

void bs_main_thread_reset() {
    task_item_u task_item;
    task_item.task = TASK_RESET;
    xQueueSend(task_item_queue, &task_item, portMAX_DELAY);
}

void bs_main_thread_set_main(int32_t id, void* address) {
    task_item_u task_item;
    task_item.call_main.task = TASK_CALL_MAIN;
    task_item.call_main.id = id;
    task_item.call_main.address = address;
    xQueueSend(task_item_queue, &task_item, portMAX_DELAY);
}

void bs_main_thread_set_event(value_t fn) {
    task_item_u task_item;
    task_item.call_event.task = TASK_CALL_EVENT;
    task_item.call_event.fn = fn;
    xQueueSend(task_item_queue, &task_item, portMAX_DELAY);
}