#include "handle_log.h"

log_space_type log_space = {
    .start = 0,
    .end = 0,
    .size = LOG_SIZE,
    .space = {0}
};

int get_used_memory_size(int start, int end);
int get_num_length(int n);

int get_new_log(uint8_t *str) {
    int start = log_space.start;
    int end = log_space.end;
    int new_log_size;
    if (end == start) {
        new_log_size = 0;
    } else if (end > start) {
        memcpy(str, log_space.space + start, end - start);
        memset(log_space.space + start, 0, end - start);
        new_log_size = end - start;
        start = end;
    } else {
        memcpy(str, log_space.space + start, log_space.size - start);
        memset(log_space.space + start, 0, log_space.size - start);
        memcpy(str + (log_space.size - start), log_space.space, end);
        memset(log_space.space, 0, end);
        new_log_size = log_space.size + end - start;
        start = end;
    }
    log_space.start = start;
    return new_log_size;
}

void write_number_log(int n) {
    int num_length = get_num_length(n);
    char str[num_length];
    snprintf(str, num_length, "%d", n);
    write_string_log(str);
}


void write_string_log(char *str) {
    int str_length = strlen(str);
    int start = log_space.start;
    int end = log_space.end;
    int lined_str_len = str_length + 1;
    char lined_str[lined_str_len];
    memcpy(lined_str, str, str_length);
    lined_str[str_length] = '\n';
    if (lined_str_len > log_space.size - get_used_memory_size(start, end)){
        ESP_LOGE(LOG_TAG, "Log string length should be less than LOG_SIZE.");
        return;
    }
    if (end >= start && (log_space.size - end < lined_str_len)){
        memcpy(log_space.space + end, lined_str, log_space.size - end);
        memcpy(log_space.space, lined_str + (log_space.size - end), lined_str_len - (log_space.size - end));
        end = end + lined_str_len - log_space.size;
    } else {
        memcpy(log_space.space + end, lined_str, lined_str_len);
        end = log_space.end + lined_str_len;
    }
    log_space.end = end;
    return;
}


int get_used_memory_size(int start, int end) {
    if (end >= start)
    {
        return end - start;
    } else
    {
        return end + log_space.size - start;
    }
}

int get_num_length(int n) {
    if (n == 0) {
        return 2;
    }
    int current_num = n;
    int digit = 0;
    while(current_num != 0){
        current_num = current_num / 10;
        ++digit;
    }
    if (n >= 0) {
        return digit + 1;
    } else {
        return digit + 2;
    }
}
