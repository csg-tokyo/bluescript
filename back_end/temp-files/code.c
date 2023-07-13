#include "../../m5stack_bluetooth/main/c-runtime.h"
#include "../../m5stack_bluetooth/main/utils.h"
extern struct _func1 {
  int32_t (*fptr)(int32_t);
  const char* sig; } _func1;
void bluescript_main4();
ROOT_SET_DECL(global_rootset4, 0)

static int32_t fbody_func1(int32_t _n) {
  ROOT_SET(func_rootset, 0)
  {
    { int32_t ret_value_ = (_n + 4); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

void bluescript_main4() {
  ROOT_SET_INIT(global_rootset4, 0)
  ROOT_SET(func_rootset, 0)
  _func1.fptr = fbody_func1;
  
  DELETE_ROOT_SET(func_rootset)
}
