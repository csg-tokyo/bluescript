#include "driver/gpio.h"
#include "c-runtime.h"
#include "main-thread.h"
#include "button.h"


extern struct func_body _000001buttonOnPressed;
extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_000001();
ROOT_SET_DECL(global_rootset0_000001, 0);

#define ESP_INTR_FLAG_DEFAULT 0

static bool is_isr_installed = false;

void fbody_000001buttonOnPressed(value_t self, int32_t _buttonPin, value_t _callback) {
  ROOT_SET_N(func_rootset,2,VALUE_UNDEF_2)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _callback;
  {
    if (_buttonPin >= GPIO_NUM_MAX) {
      runtime_error("** button module error: buttonPin value exceeds maximum value."); 
    }
    gpio_set_direction(_buttonPin, GPIO_MODE_INPUT);
    gpio_set_intr_type(_buttonPin, GPIO_INTR_POSEDGE);
    if (!is_isr_installed) {
        gpio_install_isr_service(ESP_INTR_FLAG_DEFAULT);
        is_isr_installed = true;
    }
    set_global_variable(&global_rootset0_000001.values[_buttonPin], _callback);
    gpio_isr_handler_add(_buttonPin, bs_main_thread_set_event_from_isr, (void*)func_rootset.values[0]);
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _000001buttonOnPressed = { fbody_000001buttonOnPressed, "(i()v)v" };

void bluescript_main0_000001() {
  ROOT_SET_INIT(global_rootset0_000001, GPIO_NUM_MAX)
  
  
}
