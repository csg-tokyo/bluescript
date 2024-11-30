idf_component_register(SRCS "gpio.c"
                    INCLUDE_DIRS "include"
                    REQUIRES core driver
                    # WHOLE_ARCHIVE
                    )

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)