#ifndef __HANDLE_LOG__
#define __HANDLE_LOG__
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "sdkconfig.h"
#include "esp_log.h"


// It need to be less than MTU size.
#define LOG_SIZE 500 
#define LOG_TAG "Log Tag"

typedef struct{
    int start;
    int end;
    int size;
    uint8_t space[LOG_SIZE];
} log_space_type;


int get_new_log(uint8_t* str);
void write_string_log(char *str);
void write_number_log(int n);

#endif /* __HANDLE_LOG__ */