#include "../../m5stack_bluetooth/main/c-runtime.h"
#include "../../m5stack_bluetooth/main/utils.h"
int32_t _main(int32_t _n);
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 0)

int32_t _main(int32_t _n) {
  ROOT_SET(func_rootset, 0)
  {
    { int32_t ret_value_ = (_n + 2); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 0)
  ROOT_SET(func_rootset, 0)
  DELETE_ROOT_SET(func_rootset)
}
