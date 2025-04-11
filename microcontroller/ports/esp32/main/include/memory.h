#ifndef __BS_MEMORY__
#define __BS_MEMORY__

#include <stdint.h>

typedef struct {
    void*    iram_address;
    uint32_t iram_size;
    void*    dram_address;
    uint32_t dram_size;
    void*    iflash_address;
    uint32_t iflash_size;
    void*    dflash_address;
    uint32_t dflash_size;
} bs_memory_layout_t;

void bs_memory_init();

void bs_memory_reset();

void bs_memory_get_layout(bs_memory_layout_t* layout);

void bs_memory_memcpy(void* dest, void *src, uint32_t len);

#endif /* __BS_MEMORY__ */