int32_t _leftForwardPin;
int32_t _leftBackPin;
int32_t _rightForwardPin;
int32_t _rightBackPin;
int32_t _leftForwardChannel;
int32_t _leftBackChannel;
int32_t _rightForwardChannel;
int32_t _rightBackChannel;
int32_t _leftTimerId;
int32_t _rightTimerId;
extern struct func_body _goForward;
extern struct func_body _setup;
extern struct func_body _loop;
extern struct func_body _stopPWM;
extern struct func_body _setPWMDuty;
extern struct func_body _initPWM;
extern struct func_body _waitMs;
extern struct func_body _console_log_integer;
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 0)

#include <stdint.h>
#include "c-runtime.h"
#include "hardwarelib.h"

static void fbody_goForward(value_t self) {
  
  {
    ((void (*)(value_t, int32_t))_stopPWM.fptr)(0, _leftForwardChannel);
    ((void (*)(value_t, int32_t))_stopPWM.fptr)(0, _leftForwardChannel);
    ((void (*)(value_t, int32_t))_stopPWM.fptr)(0, _rightForwardChannel);
    ((void (*)(value_t, int32_t))_stopPWM.fptr)(0, _rightBackChannel);
    ((void (*)(value_t, int32_t, float))_setPWMDuty.fptr)(0, _leftForwardChannel, 0.5);
    ((void (*)(value_t, int32_t, float))_setPWMDuty.fptr)(0, _rightForwardChannel, 0.5);
  }
  
}
struct func_body _goForward = { fbody_goForward, "()v" };

static void fbody_setup(value_t self) {
  
  {
    ((void (*)(value_t, int32_t, int32_t, int32_t))_initPWM.fptr)(0, _leftForwardChannel, _leftTimerId, _leftForwardPin);
    ((void (*)(value_t, int32_t, int32_t, int32_t))_initPWM.fptr)(0, _leftBackChannel, _leftTimerId, _leftBackPin);
    ((void (*)(value_t, int32_t, int32_t, int32_t))_initPWM.fptr)(0, _rightForwardChannel, _rightTimerId, _rightForwardPin);
    ((void (*)(value_t, int32_t, int32_t, int32_t))_initPWM.fptr)(0, _rightBackChannel, _rightTimerId, _rightBackPin);
    ((void (*)(value_t))_goForward.fptr)(0);
  }
  
}
struct func_body _setup = { fbody_setup, "()v" };

static void fbody_loop(value_t self) {
  
  {
    ((void (*)(value_t, int32_t))_waitMs.fptr)(0, 10000);
    ((void (*)(value_t, int32_t))_console_log_integer.fptr)(0, 3);
  }
  
}
struct func_body _loop = { fbody_loop, "()v" };

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 0)
  
  _leftForwardPin = 13;
  _leftBackPin = 14;
  _rightForwardPin = 15;
  _rightBackPin = 12;
  _leftForwardChannel = 0;
  _leftBackChannel = 1;
  _rightForwardChannel = 2;
  _rightBackChannel = 3;
  _leftTimerId = 0;
  _rightTimerId = 1;
  
}
