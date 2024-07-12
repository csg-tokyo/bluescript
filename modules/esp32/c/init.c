#include <stdio.h>
#include "c-runtime.h"
#include "./include/init.h"
#include "./include/button.h"
#include "./include/display.h"
#include "./include/timer.h"
#include "./include/utils.h"
#include "./include/gpio.h"

void MD_SECTION bs_modules_init() {
    printf("button: %p\n", &_buttonOnPressed);
    printf("new Display: %p\n", new_Display);
    printf("class Display: %p\n", &class_Display);
    printf("setInterval: %p\n", &_setInterval);
    printf("setTimeout: %p\n", &_setTimeout);
    printf("clearInterval: %p\n", &_clearInterval);
    printf("clearTimeout: %p\n", &_clearInterval);
    printf("getTimeUs: %p\n", &_getTimeUs);
    printf("print: %p\n", &_print);
    printf("randInt: %p\n", &_randInt);
    printf("new GPIO: %p\n", &new_GPIO);
    printf("class GPIO: %p\n", &class_GPIO);
}
