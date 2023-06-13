#include "../../m5stack_bluetooth/main/c-runtime.h"
#include "../../m5stack_bluetooth/main/utils.h"
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 0)

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 0)
  ROOT_SET(func_rootset, 0)
  _console_log_number(3);
  DELETE_ROOT_SET(func_rootset)
}
