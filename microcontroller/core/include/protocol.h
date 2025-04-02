#ifndef __BS_PROTOCOL__
#define __BS_PROTOCOL__

#include <stdint.h>
#include "c-runtime.h"

typedef struct {
    void*    iram_address;
    uint32_t iram_size;
    void*    dram_address;
    uint32_t dram_size;
    void*    iflash_address;
    uint32_t iflash_size;
    void*    dflash_address;
    uint32_t dflash_size;
} bs_protocol_memory_info_t;


void bs_protocol_write_log(char* str, uint32_t len);

void bs_protocol_write_error(char* str, uint32_t len);

void bs_protocol_write_profile(uint8_t fid, char* str, uint32_t len);

void bs_protocol_write_execution_time(int32_t id, float time);

void bs_protocol_write_memory_info(bs_protocol_memory_info_t info);

void bs_protocol_read(uint8_t* data, uint32_t len);

#endif /* __BS_PROTOCOL__ */