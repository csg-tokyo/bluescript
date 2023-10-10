
#include <stdint.h>
#include "c-runtime.h"
#include "hardwarelib.h"

int32_t _ledPinId;
int32_t _numLED;
int32_t _ledChannel;
extern struct func_body _setup;
extern struct func_body _loop;
extern struct func_body _configLED;
extern struct func_body _clearLED;
extern struct func_body _waitMs;
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 0)


static void fbody_setup(value_t self) {
  
  {
    ((void (*)(value_t, int32_t, int32_t, int32_t))_configLED.fptr)(0, _ledChannel, _ledPinId, _numLED);
    ((void (*)(value_t))_clearLED.fptr)(0);
  }
  
}
struct func_body _setup = { fbody_setup, "()v" };

static void fbody_loop(value_t self) {
  
  {
    ((void (*)(value_t, int32_t))_waitMs.fptr)(0, 1000);
  }
  
}
struct func_body _loop = { fbody_loop, "()v" };

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 0)
  
  _ledPinId = 15;
  _numLED = 10;
  _ledChannel = 0;
  
}
