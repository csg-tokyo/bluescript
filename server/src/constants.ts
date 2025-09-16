import * as path from "path";

export const FILE_PATH = {
  C_RUNTIME_H: (runtimeDir: string) => path.join(runtimeDir, 'core/include/c-runtime.h'),
  PROFILER_H: (runtimeDir: string) => path.join(runtimeDir, 'core/include/profiler.h'),
  RUNTIME_ELF: (runtimeDir: string) => path.join(runtimeDir, 'ports/esp32/build/bluescript.elf'),
  DEPENDENCIES_FILE: (runtimeDir: string) => path.join(runtimeDir, 'ports/esp32/build/project_description.json'),
  C_FILE: (buildDir: string) => path.join(buildDir, 'code.c'),
  OBJ_FILE: (buildDir: string) => path.join(buildDir, 'code.o'),
  LINKER_SCRIPT: (buildDir: string) => path.join(buildDir, 'linkerscript.ld'),
  LINKED_ELF: (buildDir: string) => path.join(buildDir, 'code'),
  // MODULE_LINKER_SCRIPT: (buildDir: string) => path.join(buildDir, 'module-linkerscript.ld'),
  // MODULE_LINKED_ELF: (buildDir: string) => path.join(buildDir, 'module-code'),
  // STD_MODULE: (dir: string) => path.join(dir, 'index.bs'),
  // MODULE: (dir: string, name: string) => path.join(dir, name, `${name}.bs`),
  // MODULE_NAME_TO_ID: (modulesDir: string) => path.join(modulesDir, 'name_to_id.json'),
  GCC: (compilerDir: string) => path.join(compilerDir, 'xtensa-esp32-elf-gcc'),
  LD: (compilerDir: string) => path.join(compilerDir, 'xtensa-esp32-elf-ld'),
}

