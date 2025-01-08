idf_component_register(SRCS "main.c" "ble.c" "shell.c" "logger.c" "event.c" 
                    INCLUDE_DIRS "include"
                    LDFRAGMENTS linker.lf
                    WHOLE_ARCHIVE)

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)
