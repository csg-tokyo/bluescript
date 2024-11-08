#include <string.h>
#include <stdio.h>

#include "../include/profiler.h"
#include "../include/c-runtime.h"


#define BS_PROFILER_TAG        "BS_PROFILER"

#define TYPECOUNT_THRESHOLD      8
#define TYPECOUNTER_LENGTH       32


#define TYPE_INT         0
#define TYPE_FLOAT       1
#define TYPE_INT_ARRAY   2
#define TYPE_FLOAT_ARRAY 3
#define TYPE_BYTE_ARRAY  4
#define TYPE_OTHERS      5


static uint16_t typecounter[TYPECOUNT_THRESHOLD * TYPECOUNTER_LENGTH] = {0};

static uint8_t type2int(value_t v) {
    int32_t last2bit = v & 3;
    if (last2bit == 0) 
        return TYPE_INT;
    if (last2bit == 1) 
        return TYPE_FLOAT;
    if (gc_is_intarray(v))
        return TYPE_INT_ARRAY;
    if (gc_is_floatarray(v))
        return TYPE_FLOAT_ARRAY;
    if (gc_is_bytearray(v))
        return TYPE_BYTE_ARRAY;
    return TYPE_OTHERS;
}

bool CR_SECTION bs_profiler_typecount(uint8_t id, uint8_t count, value_t p1, value_t p2, value_t p3, value_t p4) {
    if (count > TYPECOUNT_THRESHOLD) {
        return true;
    } else if (count == TYPECOUNT_THRESHOLD) {
        int32_t len = TYPECOUNT_THRESHOLD*sizeof(uint16_t);
        bs_logger_push_profile(id, (uint8_t*)(typecounter+(id*TYPECOUNT_THRESHOLD)), len);
        memset(typecounter+(id*TYPECOUNT_THRESHOLD), 0, len);
        return true;
    } else {
        uint16_t types = type2int(p1);
        types |= (type2int(p2) << 4);
        types |= (type2int(p3) << 8);
        types |= (type2int(p4) << 12);
        typecounter[id * TYPECOUNT_THRESHOLD + count] = types;
        return false;
    }
}
