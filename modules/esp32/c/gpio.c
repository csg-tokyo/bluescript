#include <stdint.h>
#include "driver/gpio.h"
#include "include/gpio.h"

void mth_0_GPIO(value_t self, int32_t _level);
extern CLASS_OBJECT(object_class, 1);
static const uint16_t plist_GPIO[] = { 1 };
class_GPIO_t class_GPIO ={
        .body = { .s = 1, .i = 1, .cn = "GPIO", .sc = &object_class.clazz , .pt = { .size = 1, .offset = 0,
        .unboxed = 1, .prop_names = plist_GPIO, .unboxed_types = "i" }, .vtbl = { mth_0_GPIO,  }}};

static void cons_GPIO(value_t self, int32_t _pinNum) {
    *get_obj_int_property(self, 0) = _pinNum;
    gpio_set_direction(_pinNum, GPIO_MODE_OUTPUT);
}

value_t new_GPIO(value_t self, int32_t p0) { cons_GPIO(self, p0); return self; }


void mth_0_GPIO(value_t self, int32_t _level) {
    gpio_set_level(*get_obj_int_property(self, 0), _level);
}