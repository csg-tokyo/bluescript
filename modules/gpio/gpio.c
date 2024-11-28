
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"
#include "../../microcontroller/core/include/profiler.h"
extern struct func_body _gpioOn;
extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_();
ROOT_SET_DECL(global_rootset0, 0);

static void fbody_gpioOn(value_t self, int32_t _pin) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _gpioOn = { fbody_gpioOn, "(i)v" };

void bluescript_main0_() {
  ROOT_SET_INIT(global_rootset0, 0)
  
  
}
