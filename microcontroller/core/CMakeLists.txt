idf_component_register(SRCS "src/c-runtime.c" "src/profiler.c" "src/main-thread.c" "src/protocol.c"
                    INCLUDE_DIRS "include"
                    REQUIRES main
                    LDFRAGMENTS linker.lf
                    WHOLE_ARCHIVE)

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)