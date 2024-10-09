#include "../../microcontroller/core/include/c-runtime.h"
extern struct func_body _0func2;
extern CLASS_OBJECT(object_class, 1);
void bluescript_main2_0();
ROOT_SET_DECL(global_rootset2_0, 0)

static int32_t fbody_0func2(value_t self) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { int32_t ret_value_ = (2); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _0func2 = { fbody_0func2, "()i" };

void bluescript_main2_0() {
  ROOT_SET_INIT(global_rootset2_0, 0)
  
  
}
