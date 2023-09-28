#include "hardwarelib.h"

char* HL_ATTR dummy_str = "";

void init_hardwarelib() {
    printf("%p\n", &dummy_str);
    return;
}

static int get_num_length(int n) {
    if (n == 0) { return 1; }
    int current_num = n;
    int digit = 0;
    while(current_num != 0){
        current_num = current_num / 10;
        digit += 1;
    }
    return n;
}

void fbody_console_log_integer(value_t self, int32_t _n) {
    printf("%d\n", _n);
    int num_length = get_num_length(_n);
    char str[num_length + 1];
    snprintf(str, num_length, "%d", _n);
    bluescript_log_push(str);
}
struct func_body HL_ATTR _console_log_integer = { fbody_console_log_integer, "(i)v" };
