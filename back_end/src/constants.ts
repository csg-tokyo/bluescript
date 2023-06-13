const CONSTANTS = {
  CODE_FILES_DIR_PATH: "./temp-files/",
  C_FILE_NAME: "code.c",
  OBJ_FILE_NAME: "code.o",
  C_FILE_TEMPLATE_PATH: "./data/c-file-template.c",
  NATIVE_FUNCTION_SKELETONS_PATH: "./data/native-function-skeletons.ts",
  C_RUNTIME_SYMBOLS_PATH: "./data/c-runtime-symbols.json",
  DEVICE_ELF_PATH: "../m5stack_bluetooth/build/blue_script.elf",
  ENTRY_POINT_NAME: "bluescript_main",
  VIRTUAL_SECTION_NAMES: [
    {realName: ".text", virtualName: "virtual_text"},
    {realName: ".literal", virtualName: "virtual_literal"},
    {realName: ".data", virtualName: "virtual_data"},
    {realName: ".rodata", virtualName: "virtual_rodata"},
    {realName: ".bss", virtualName: "virtual_bss"},
  ]
};

export default CONSTANTS;