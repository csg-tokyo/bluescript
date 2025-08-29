#include <string.h>
#include <stdio.h>

#include "utils.h"
#include "memory.h"

#include "../include/protocol.h"
#include "../include/main-thread.h"

#define PROTOCOL_LEN 1

typedef enum {
    PROTOCOL_NONE = 0x00,
    PROTOCOL_LOAD,
    PROTOCOL_JUMP,
    PROTOCOL_RESET,

    PROTOCOL_LOG,
    PROTOCOL_ERROR,
    PROTOCOL_MEMINFO,
    PROTOCOL_EXECTIME,
    PROTOCOL_PROFILE,

    PROTOCOL_END
} protocol_t;

static void send_buffer(uint8_t* buffer, uint32_t len) {
    bs_ble_send_buffer(buffer, len);
}

void bs_protocol_write_log(char* message) {
    uint32_t len = strlen(message);
    uint32_t buffer_len = PROTOCOL_LEN + len + sizeof(uint8_t); // size of null
    uint8_t* buffer = (uint8_t*)malloc(buffer_len);
    if (buffer != NULL) {
        buffer[0] = PROTOCOL_LOG;
        strcpy((char*)(buffer + PROTOCOL_LEN), message);
        send_buffer(buffer, buffer_len);
        free(buffer);
    } else {
        BS_LOG_ERROR("Could not get buffer.")
    }
}

void bs_protocol_write_error(char* message) {
    uint32_t len = strlen(message);
    uint32_t buffer_len = PROTOCOL_LEN + len + sizeof(uint8_t); // size of null
    uint8_t* buffer = (uint8_t*)malloc(buffer_len);
    if (buffer != NULL) {
        buffer[0] = PROTOCOL_ERROR;
        strcpy((char*)(buffer + PROTOCOL_LEN), message);
        send_buffer(buffer, buffer_len);
        free(buffer);
    } else {
        BS_LOG_ERROR("Could not get buffer.");
    }
}

void bs_protocol_write_profile(uint8_t fid, char* profile) {
    uint32_t len = strlen(profile);
    uint32_t buffer_len = PROTOCOL_LEN + sizeof(uint8_t) + len + sizeof(uint8_t); // size of fid + len + size of null
    uint8_t* buffer = (uint8_t*)malloc(buffer_len);
    if (buffer != NULL) {
        buffer[0] = PROTOCOL_PROFILE;
        buffer[1] = fid;
        strcpy((char*)(buffer + PROTOCOL_LEN + sizeof(uint8_t)), profile);
        send_buffer(buffer, buffer_len);
        free(buffer);
    } else {
        BS_LOG_ERROR("Could not get buffer.");
    }   
}

void bs_protocol_write_execution_time(int32_t id, float time) {
    uint32_t buffer_len = PROTOCOL_LEN + sizeof(int32_t*) + sizeof(float);
    uint8_t* buffer = (uint8_t*)malloc(buffer_len);
    if (buffer != NULL) {
        buffer[0] = PROTOCOL_EXECTIME;
        *(int32_t*)(buffer+1) = id;
        *(float*)(buffer+5) = time;
        send_buffer(buffer, buffer_len);
        free(buffer);
    } else {
        BS_LOG_ERROR("Could not get buffer.");
    }
}

void bs_protocol_write_memory_layout(bs_memory_layout_t* layout) {
    uint32_t buffer_len = PROTOCOL_LEN + sizeof(bs_memory_layout_t);
    uint8_t* buffer = (uint8_t*)malloc(buffer_len);
    if (buffer != NULL) {
        buffer[0] = PROTOCOL_MEMINFO;
        *(uint32_t*)(buffer+ 1) = (uint32_t)layout->iram_address;
        *(uint32_t*)(buffer+ 5) = layout->iram_size;
        *(uint32_t*)(buffer+ 9) = (uint32_t)layout->dram_address;
        *(uint32_t*)(buffer+13) = layout->dram_size;
        *(uint32_t*)(buffer+17) = (uint32_t)layout->iflash_address;
        *(uint32_t*)(buffer+21) = layout->iflash_size;
        *(uint32_t*)(buffer+25) = (uint32_t)layout->dflash_address;
        *(uint32_t*)(buffer+29) = layout->dflash_size;
        send_buffer(buffer, buffer_len);
        free(buffer);
    } else {
        BS_LOG_ERROR("Could not get buffer.");
    }
}

void bs_protocol_read(uint8_t* buffer, uint32_t len) {
    int idx = 0;
    while (idx < len) {
        switch (buffer[idx]) {
        case PROTOCOL_LOAD:
        // | cmd(1byte) | address(4byte) | size(4byte) | data(size) |
        {
            // uint32_t address = *(uint32_t*)(buffer + (idx+1));
            void* address = *(void**)(buffer + (idx+1)); 
            uint32_t size = *(uint32_t*)(buffer + (idx+5));
            BS_LOG_INFO("Load %d bytes to %p", (int)size, address);
            bs_memory_memcpy(address, buffer + (idx+9), size);
            idx += (9 + size);
            break;
        }
        case PROTOCOL_JUMP:
        // | cmd(1byte) | id(4byte) | address(4byte) |
        {
            int32_t id = *(int32_t*)(buffer + (idx+1));
            void* address = *(void**)(buffer + (idx+5));
            bs_main_thread_set_main(id, address);
            idx += 9;
            break;
        }
        case PROTOCOL_RESET:
        // | cmd (1byte) | 
        {
            bs_main_thread_reset();
            idx += 1;
            break;
        }
        case PROTOCOL_END:
        // | cmd(1byte) |
            return;
        default:
            return;
        }
    }
}