
#ifndef __BS_CMD__
#define __BS_CMD__


typedef enum {
    BS_CMD_NONE  = 0x00,
    BS_CMD_LOAD,
    BS_CMD_FLOAD, 
    BS_CMD_JUMP,
    BS_CMD_RESET,
    BS_CMD_READ_FADDRESS,     // read flash address

    // For sending notification
    BS_CMD_RESULT_LOG,
    BS_CMD_RESULT_FADDRESS,

    // Sentinel
    BS_CMD_END
} bs_cmd_t;


#endif /* __BS_CMD__ */
