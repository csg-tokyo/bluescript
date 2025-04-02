#ifndef __BS_MEMORY__
#define __BS_MEMORY__

#include <stdint.h>

void bs_memory_init();

void bs_memory_reset();

void* bs_memory_iram_address();
void* bs_memory_dram_address();
void* bs_memory_iflash_address();
void* bs_memory_dflash_address();

uint32_t bs_memory_iram_size();
uint32_t bs_memory_dram_size();
uint32_t bs_memory_iflash_size();
uint32_t bs_memory_dflash_size();

void bs_memory_iram_memcpy(void* dest, void *src, uint32_t len);
void bs_memory_dram_memcpy(void* dest, void *src, uint32_t len);
void bs_memory_iflash_memcpy(void* dest, void *src, uint32_t len);
void bs_memory_dflash_memcpy(void* dest, void *src, uint32_t len);

#endif /* __BS_MEMORY__ */