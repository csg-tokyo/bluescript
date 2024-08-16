idf_component_register(
    SRCS "button.c" "timer.c" "display.c" "utils.c" "gpio.c" 
    INCLUDE_DIRS "include" 
    REQUIRES core driver main
    LDFRAGMENTS linker.lf
    WHOLE_ARCHIVE)

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)
