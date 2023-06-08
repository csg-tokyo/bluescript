#include "../../m5stack_bluetooth/main/c-runtime.h" 
void _func1(int32_t _n);
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 0)

void _func1(int32_t _n) {
  ROOT_SET(func_rootset, 0)
  {
    _console_log_number(_n + 2);
  }
  DELETE_ROOT_SET(func_rootset)
}

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 0)
  ROOT_SET(func_rootset, 0)
  1 + 1;
  _func1(2);
  _console_log_number(6);
  DELETE_ROOT_SET(func_rootset)
}
