
#include <stdint.h>
#include "driver/gpio.h"
#include "gpio.h"

value_t new_103112105111GPIO(value_t self, int32_t p0);
void mth_0_103112105111GPIO(value_t self);
void mth_1_103112105111GPIO(value_t self);
extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_103112105111();
ROOT_SET_DECL(global_rootset0_103112105111, 0);
static const uint16_t plist_103112105111GPIO[] = { 1 };
class_103112105111GPIO_t class_103112105111GPIO = {
    .body = { .s = 1, .i = 1, .cn = "103112105111GPIO", .sc = &object_class.clazz , .f = 0, .pt = { .size = 1, .offset = 0,
    .unboxed = 1, .prop_names = plist_103112105111GPIO, .unboxed_types = "i" }, .vtbl = { mth_0_103112105111GPIO, mth_1_103112105111GPIO,  }}};

static void cons_103112105111GPIO(value_t self, int32_t _pin) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    *get_obj_int_property(self, 0) = _pin;
    gpio_set_direction(_pin, GPIO_MODE_OUTPUT);
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_103112105111GPIO(value_t self, int32_t p0) { cons_103112105111GPIO(self, p0); return self; }

// on
void mth_0_103112105111GPIO(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    gpio_set_level(*get_obj_int_property(self, 0), 1);
  }
  DELETE_ROOT_SET(func_rootset)
}

// off
void mth_1_103112105111GPIO(value_t self) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    gpio_set_level(*get_obj_int_property(self, 0), 0);
  }
  DELETE_ROOT_SET(func_rootset)
}

void bluescript_main0_103112105111() {
  ROOT_SET_INIT(global_rootset0_103112105111, 0)
  
  
}
