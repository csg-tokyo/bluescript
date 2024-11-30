idf_component_register(
    SRCS "std.c" 
    INCLUDE_DIRS "." 
    REQUIRES core driver main
    LDFRAGMENTS linker.lf
    WHOLE_ARCHIVE)

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)