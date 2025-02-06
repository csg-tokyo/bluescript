idf_component_register(SRCS "timer.c"
                    INCLUDE_DIRS "."
                    REQUIRES core driver main
                    # WHOLE_ARCHIVE
                    )

target_compile_options(${COMPONENT_LIB} PRIVATE -mtext-section-literals)