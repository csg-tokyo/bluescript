#include <stdint.h>
#include "c-runtime.h"
#include "hardwarelib.h"

int32_t _target;
extern struct func_body _timerCb;
extern struct func_body _setup;
extern struct func_body _loop;
extern struct func_body _createOneShotTimer;
extern struct func_body _startOneShotTimer;
extern struct func_body _console_log_integer;
extern struct func_body _waitMs;
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 0)

static void fbody_timerCb(value_t self) {
  
  {
    _target = 3;
  }
  
}
struct func_body _timerCb = { fbody_timerCb, "()v" };

static void fbody_setup(value_t self) {
  
  {
    ((void (*)(value_t, value_t))_createOneShotTimer.fptr)(0, gc_new_function(_timerCb.fptr, _timerCb.signature, VALUE_UNDEF));
    ((void (*)(value_t, int32_t))_startOneShotTimer.fptr)(0, 3000000);
  }
  
}
struct func_body _setup = { fbody_setup, "()v" };

static void fbody_loop(value_t self) {
  
  {
    ((void (*)(value_t, int32_t))_console_log_integer.fptr)(0, _target);
    ((void (*)(value_t, int32_t))_waitMs.fptr)(0, 500);
  }
  
}
struct func_body _loop = { fbody_loop, "()v" };

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 0)
  
  _target = 0;
  
}
