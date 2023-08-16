#include "../../m5stack_bluetooth/main/c-runtime.h"
#include "../../m5stack_bluetooth/main/utils.h"
int32_t _x;
extern struct _console_log_number {
  void (*fptr)(int32_t);
  const char* sig; } _console_log_number;
void bluescript_main1();
ROOT_SET_DECL(global_rootset1, 0)

void bluescript_main1() {
  ROOT_SET_INIT(global_rootset1, 0)
  ROOT_SET(func_rootset, 0)
  _x = 0;
  _x+=1;
  _x-=1;
  _x+=1;
  _x-=1;
  _console_log_number.fptr(_x);
  DELETE_ROOT_SET(func_rootset)
}
