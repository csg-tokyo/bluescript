#include "../../m5stack_bluetooth/main/c-runtime.h"
#include "../../m5stack_bluetooth/main/utils.h"
int32_t _i;
void bluescript_main3();
ROOT_SET_DECL(global_rootset3, 0)

void bluescript_main3() {
  ROOT_SET_INIT(global_rootset3, 0)
  ROOT_SET(func_rootset, 0)
  _i = 4;
  DELETE_ROOT_SET(func_rootset)
}


int32_t func1(int32_t x) {
    return x + 1;
}