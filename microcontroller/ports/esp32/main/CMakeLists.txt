idf_component_register(SRCS "std-module.c" "main.c" "ble.c" "memory.c" "utils.c"
                    INCLUDE_DIRS "include"
                    REQUIRES core driver esp_partition bt nvs_flash
                    LDFRAGMENTS linker.lf
                    WHOLE_ARCHIVE)

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)
