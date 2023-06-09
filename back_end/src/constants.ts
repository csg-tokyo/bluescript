const CONSTANTS = {
  CODE_FILES_DIR_PATH: "./temp-files/",
  C_FILE_NAME: "code.c",
  OBJ_FILE_NAME: "code.o",
  C_FILE_TEMPLATE_PATH: "./data/c-file-template.c",
  NATIVE_FUNCTION_SKELETONS_PATH: "./data/native-function-skeletons.ts",
  C_RUNTIME_SYMBOLS_PATH: "./data/c-runtime-symbols.json",
  DEV_DB_ONCE_PATH: "./data/db-dev/once/",
  DEV_DB_REPL_PATH: "./data/db-dev/repl/",
  SECTIONS_TABLE_NAME: "sections.db",
  SYMBOLS_TABLE_NAME: "symbols.db",
  DEVICE_ELF_PATH: "/Users/maejimafumika/Desktop/Lab/research/products/m5stack_bluetooth/build/blue_script.elf",
  SYMBOLS_INITIAL_DATA_JSON_PATH: "./data/symbols-initial-data.json",
  DD_TEXT_SECTION_NAME: "my_text",
  DD_DATA_SECTION_NAME: "my_data",
  DD_RODATA_SECTION_NAME: "my_rodata",
  DD_BSS_SECTION_NAME: "my_bss",
  DD_LITERAL_SECTION_SIZE: 100,
  VIRTUAL_SECTION_NAMES: [
    {realName: ".text", virtualName: "virtual_text"},
    {realName: ".literal", virtualName: "virtual_literal"},
    {realName: ".data", virtualName: "virtual_data"},
    {realName: ".rodata", virtualName: "virtual_rodata"},
    {realName: ".bss", virtualName: "virtual_bss"},
  ]
};

export default CONSTANTS;