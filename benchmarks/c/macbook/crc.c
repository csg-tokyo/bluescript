#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>
#include "sample_data.c"

#define WARMUP 1
#define CYCLE 3
#define TAG "crc"

#define DATA_LEN 1024
#define ANSWER  1837082096

void make_table(unsigned long int poly, unsigned long int table[256]) {
    for (int i = 0; i < 256; i++) {
        unsigned long int byte = i;
        unsigned long int crc = 0;
        for (int bit = 0; bit < 8; bit++) {
            if ((byte ^ crc) & 1)
                crc = (crc >> 1) ^ poly;
            else
                crc >>= 1;
            byte >>= 1;
        }
        table[i] = crc;
    }
} 


unsigned long int calc(int bytes[DATA_LEN], unsigned long int table[256]) {
    unsigned long int value = 0xffffffff;
    for (int i = 0; i < DATA_LEN; i++) {
        value = table[(bytes[i] ^ value) & 0xff] ^ (value >> 8);
    }
    return (-1 - value) & 0xffffffff;
}



void benchmark_main() {
    unsigned long int table[256];
    make_table(0xedb88320, table);
    unsigned long int result = calc(DATA, table);
    assert(result == ANSWER);  
}
