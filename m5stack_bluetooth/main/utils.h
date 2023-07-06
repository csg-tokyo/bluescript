#ifndef __UTILS__
#define __UTILS__
#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include "c-runtime.h"


// void fbody_console_log_number(int32_t n);

struct my_rel_table_entry {
    void* address;
};
extern struct my_rel_table_entry my_rel_table[100];


#endif /* __UTILS__ */