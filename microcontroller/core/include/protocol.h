#ifndef __BS_PROTOCOL__
#define __BS_PROTOCOL__

#include <stdint.h>
#include "memory.h"
#include "ble.h"


void bs_protocol_write_log(char* message);

void bs_protocol_write_error(char* message);

void bs_protocol_write_profile(uint8_t fid, char* profile);

void bs_protocol_write_execution_time(int32_t id, float time);

void bs_protocol_write_memory_layout(bs_memory_layout_t* layout);

void bs_protocol_read(uint8_t* buffer, uint32_t len);

#endif /* __BS_PROTOCOL__ */