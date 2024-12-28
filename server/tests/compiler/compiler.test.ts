import {FILE_PATH} from "../../src/constants";
import {InteractiveCompiler, ModuleCompiler} from "../../src/compiler/compiler";
import {ShadowMemory} from "../../src/compiler/shadow-memory";

const COMPILER_PATH = '~/.espressif/tools/xtensa-esp32-elf/esp-2022r1-11.2.0/xtensa-esp32-elf/bin/'

const cProlog = `
#include <stdint.h>
#include "../${FILE_PATH.C_RUNTIME_H}"
#include "../${FILE_PATH.PROFILER_H}"
`


test('Interactive Compile', () => {
  const src1 = `\
extern struct func_body _add;
extern CLASS_OBJECT(object_class, 1);
void bluescript_main2_();
ROOT_SET_DECL(global_rootset2, 0);

static int32_t fbody_add(value_t self, int32_t _a, int32_t _b) {
  ROOT_SET_N(func_rootset,1,VALUE_UNDEF)
  func_rootset.values[0] = self;
  {
    { int32_t ret_value_ = (_a + _b); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _add = { fbody_add, "(ii)i" };

void bluescript_main1_() {
  ROOT_SET_INIT(global_rootset2, 0)
  
  ((int32_t (*)(value_t, int32_t, int32_t))_add.fptr)(0, 1, 2);
  
}
`

const src2 = `
extern CLASS_OBJECT(object_class, 1);
extern struct func_body _add;
void bluescript_main2_();
ROOT_SET_DECL(global_rootset2, 0);

void bluescript_main2_() {
  ROOT_SET_INIT(global_rootset2, 0)
  
  ((int32_t (*)(value_t, int32_t, int32_t))_add.fptr)(0, 1, 2) + ((int32_t (*)(value_t, int32_t, int32_t))_add.fptr)(0, 3, 4);
  
}
`


  const shadowMemory = new ShadowMemory(FILE_PATH.MCU_ELF, {
    iram: {address: 0x4000000, size: 30000},
    dram: {address: 0x3000614, size: 20000},
    iflash: {address: 0x5000000, size: 1000000},
    dflash: {address: 0x5000000, size: 1000000}
  });
  const compiler = new InteractiveCompiler(COMPILER_PATH);
  compiler.compile(shadowMemory, cProlog + src1, 'bluescript_main1_');
  compiler.compile(shadowMemory, cProlog + src2, 'bluescript_main2_');
});


test('Compile Module', () => {


  const src2 = `
extern CLASS_OBJECT(object_class, 1);
extern struct func_body _103112105111gpioOn;
void bluescript_main2_();
ROOT_SET_DECL(global_rootset2, 0);

void bluescript_main2_() {
  ROOT_SET_INIT(global_rootset2, 0)
  
  
}

`

  const shadowMemory = new ShadowMemory(FILE_PATH.MCU_ELF, {
    iram: {address: 0x4000000, size: 30000},
    dram: {address: 0x3000000, size: 20000},
    iflash: {address: 0x5000000, size: 1000000},
    dflash: {address: 0x5000000, size: 1000000}
  });
  const moduleCompiler = new ModuleCompiler(COMPILER_PATH);
  moduleCompiler.compile(shadowMemory, 'gpio', 'bluescript_main0_103112105111')
  const compiler = new InteractiveCompiler(COMPILER_PATH);
  compiler.compile(shadowMemory, cProlog + src2, 'bluescript_main2_');
})