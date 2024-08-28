#include <stdbool.h>
#include "driver/gpio.h"
#include "include/button.h"
#include "event.h"


#define ESP_INTR_FLAG_DEFAULT 0


static bool is_isr_installed = false;

void fbody_buttonOnPressed(value_t self, int32_t _buttonPin, value_t _callback) {
    ROOT_SET(func_rootset, 1)
    func_rootset.values[0] = _callback;
    gpio_set_direction(_buttonPin, GPIO_MODE_INPUT);
    gpio_set_intr_type(_buttonPin, GPIO_INTR_POSEDGE);
    if (!is_isr_installed) {
        gpio_install_isr_service(ESP_INTR_FLAG_DEFAULT);
        is_isr_installed = true;
    }
    gpio_isr_handler_add(_buttonPin, bs_event_push_from_isr, (void*)func_rootset.values[0]);
    DELETE_ROOT_SET(func_rootset)
}
struct func_body _buttonOnPressed = { fbody_buttonOnPressed, "(i()v)v" };
