#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "esp_log.h"
#include "esp_partition.h"
#include "esp_heap_caps.h"
#include "esp_memory_utils.h"

#include "include/memory.h"
#include "include/utils.h"

#define BS_MEMORY_TAG  "BS_MEMORY"

// RAM
void*    iram_address;
uint32_t iram_size;
void*    dram_address;
uint32_t dram_size;

// FLASH
#define IFLASH_PARTITION_LABEL "iflash"
#define DFLASH_PARTITION_LABEL "dflash"
static const esp_partition_t* iflash_partition = NULL;
static const esp_partition_t* dflash_partition = NULL;
static const void* mapped_iflash_address = NULL;
static const void* mapped_dflash_address = NULL;
static esp_partition_mmap_handle_t mapped_iflash_hdlr;
static esp_partition_mmap_handle_t mapped_dflash_hdlr;

static void iram_init() {
    iram_size = heap_caps_get_largest_free_block(MALLOC_CAP_EXEC | MALLOC_CAP_32BIT) - 4;
    iram_address = heap_caps_malloc(iram_size, MALLOC_CAP_EXEC | MALLOC_CAP_32BIT);
    BS_LOG_INFO("IRAM Address: %p Size: %d\n", iram_address, (int)iram_size)
}

static void dram_init() {
    dram_size = heap_caps_get_largest_free_block(MALLOC_CAP_8BIT) / 2;
    dram_address = heap_caps_malloc(dram_size, MALLOC_CAP_8BIT);
    BS_LOG_INFO("DRAM Address: %p Size: %d\n", dram_address, (int)dram_size)
}

static void iflash_init() {
    iflash_partition = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, IFLASH_PARTITION_LABEL);
    esp_partition_mmap(iflash_partition, 0, iflash_partition->size, ESP_PARTITION_MMAP_INST, &mapped_iflash_address, &mapped_iflash_hdlr);
    BS_LOG_INFO("IFlash Address: 0x%x Mapped Address: %p Size: %d\n", (int)iflash_partition->address, mapped_iflash_address, (int)iflash_partition->size)
}

static void dflash_init() {
    dflash_partition = esp_partition_find_first(ESP_PARTITION_TYPE_DATA, ESP_PARTITION_SUBTYPE_ANY, DFLASH_PARTITION_LABEL);
    esp_partition_mmap(dflash_partition, 0, dflash_partition->size, ESP_PARTITION_MMAP_DATA, &mapped_dflash_address, &mapped_dflash_hdlr);
    BS_LOG_INFO("DFlash Address: 0x%x VAddress: %p Size: %d\n", (int)dflash_partition->address, mapped_dflash_address, (int)dflash_partition->size)
}

static void iram_reset() {
    memset(iram_address, 0, iram_size);
}

static void dram_reset() {
    memset(dram_address, 0, dram_size);
}

static void iflash_reset() {
    esp_partition_erase_range(iflash_partition, 0, iflash_partition->size);
}

static void dflash_reset() {
    esp_partition_erase_range(dflash_partition, 0, dflash_partition->size);
}

void bs_memory_init() {
    iram_init();
    dram_init();
    iflash_init();
    dflash_init();
}


void bs_memory_reset() {
    iram_reset();
    dram_reset();
    // iflash_reset();
    // dflash_reset();
}


void bs_memory_get_layout(bs_memory_layout_t* layout) {
    layout->iram_address = iram_address;
    layout->iram_size = iram_size;
    layout->dram_address = dram_address;
    layout->dram_size = dram_size;
    layout->iflash_address = mapped_iflash_address;
    layout->iflash_size = iflash_partition->size;
    layout->dflash_address = mapped_dflash_address;
    layout->dflash_size = dflash_partition->size;
}


void ram_memcpy(void* dest, void *src, uint32_t len) {
    memcpy(dest, src, len);
}

void iflash_memcpy(void* dest, void *src, uint32_t len) {
    int offset = (uint8_t*)dest - (uint8_t*)mapped_iflash_address;
    esp_partition_write(iflash_partition, offset, src, len);
}

void dflash_memcpy(void* dest, void *src, uint32_t len) {
    int offset = (uint8_t*)dest - (uint8_t*)mapped_dflash_address;
    esp_partition_write(dflash_partition, offset, src, len);
}

void bs_memory_memcpy(void* dest, void *src, uint32_t len) {
    if ((uint8_t*)mapped_iflash_address <= (uint8_t*)dest && (uint8_t*)dest < (uint8_t*)mapped_iflash_address + iflash_partition->size) {
        iflash_memcpy(dest, src, len);
    } else if ((uint8_t*)mapped_dflash_address <= (uint8_t*)dest && (uint8_t*)dest < (uint8_t*)mapped_dflash_address + dflash_partition->size) {
        dflash_memcpy(dest, src, len);
    } else if ((uint8_t*)iram_address <= (uint8_t*)dest && (uint8_t*)dest < (uint8_t*)iram_address + iram_size) {
        ram_memcpy(dest, src, len);
    } else if ((uint8_t*)dram_address <= (uint8_t*)dest && (uint8_t*)dest < (uint8_t*)dram_address + dram_size) {
        ram_memcpy(dest, src, len);
    } else {
        BS_LOG_ERROR("The destination address is out of range.")
    }
}
