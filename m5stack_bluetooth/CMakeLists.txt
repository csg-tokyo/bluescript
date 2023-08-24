# The following lines of boilerplate have to be in your project's CMakeLists
# in this exact order for cmake to work correctly
cmake_minimum_required(VERSION 3.5)

# set(EXTRA_COMPONENT_DIRS $ENV{IDF_PATH}/examples/common_components/led_strip)

include($ENV{IDF_PATH}/tools/cmake/project.cmake)
# include($ENV{IDF_PATH}/tools/cmake/build.cmake)

# idf_build_set_property(C_COMPILE_OPTIONS "-Wl,--gc-keep-exported" APPEND)

project(blue_script)
