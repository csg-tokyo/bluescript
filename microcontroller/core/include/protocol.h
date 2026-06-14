#ifndef __BS_PROTOCOL__
#define __BS_PROTOCOL__


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


#ifndef LINUX64

#include <stdint.h>
#include "memory.h"
#define CORE_TEXT_SECTION __attribute__((section(".core_text")))
#define BS_PROTOCL_USE_BLUETOOTH

void CORE_TEXT_SECTION bs_protocol_init(void);

void CORE_TEXT_SECTION bs_protocol_write_log(char* message);

void CORE_TEXT_SECTION bs_protocol_write_error(char* message);

void CORE_TEXT_SECTION bs_protocol_write_profile(uint8_t fid, char* profile);

void CORE_TEXT_SECTION bs_protocol_write_execution_time(int32_t id, float time);

void CORE_TEXT_SECTION bs_protocol_write_memory_layout(bs_memory_layout_t* layout);

void CORE_TEXT_SECTION bs_protocol_read(uint8_t* buffer, uint32_t len);

#endif

#endif /* __BS_PROTOCOL__ */