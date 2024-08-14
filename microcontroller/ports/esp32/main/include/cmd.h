
#ifndef __BS_CMD__
#define __BS_CMD__


typedef enum {
    BS_CMD_NONE  = 0x00,
    BS_CMD_LOAD,
    BS_CMD_FLOAD, 
    BS_CMD_JUMP,
    BS_CMD_RESET,

    // For sending notification
    BS_CMD_RESULT_LOG,
    BS_CMD_RESULT_MEMINFO,
    BS_CMD_RESULT_EXECTIME,

    // Sentinel
    BS_CMD_END
} bs_cmd_t;


#endif /* __BS_CMD__ */
