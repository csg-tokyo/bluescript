#include "../../microcontroller/core/include/c-runtime.h"
extern struct func_body _103112105111gpioOn;
extern CLASS_OBJECT(object_class, 1);
void bluescript_main0_103112105111();
ROOT_SET_DECL(global_rootset0_103112105111, 0)

static void fbody_103112105111gpioOn(value_t self, int32_t _pin) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _103112105111gpioOn = { fbody_103112105111gpioOn, "(i)v" };

void bluescript_main0_103112105111() {
  ROOT_SET_INIT(global_rootset0_103112105111, 0)
  
  
}
