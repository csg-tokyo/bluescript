#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"

#include "include/event.h"
#include "c-runtime.h"


#define BS_LOGGER_TAG        "BS_EVENT"
#define EVENT_QUEUE_LENGTH   10


typedef struct {
    value_t fn;
} event_t;

static QueueHandle_t event_queue;


void bs_event_push(void* event_fn) {
    event_t event = {(value_t)event_fn};
    xQueueSend(event_queue, &event, portMAX_DELAY);
// }


void bs_event_push_from_isr(void* event_fn) {
    portBASE_TYPE yield = pdFALSE;
    event_t event = {(value_t)event_fn};
    xQueueSendFromISR(event_queue, &event, &yield);
}


void bs_event_handler_task(void *arg) {
    event_t event;
    event_queue = xQueueCreate(EVENT_QUEUE_LENGTH, sizeof(event_t));

    while (true) {
       xQueueReceive(event_queue, &event, portMAX_DELAY);
       ((void (*)(value_t))gc_function_object_ptr(event.fn, 0))(get_obj_property(event.fn, 2));
    }
}
