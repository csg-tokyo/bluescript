idf_component_register(SRCS "src/c-runtime.c" "src/profiler.c"
                    INCLUDE_DIRS "include"
                    LDFRAGMENTS linker.lf
                    WHOLE_ARCHIVE)

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)