#ifndef __BS_HOST_COMM__
#define __BS_HOST_COMM__

#include <stdint.h>

#define MAX_PAYLOAD_SIZE 128
#define PROTO_SIZE       3
#define PAYLOAD_LEN_SIZE 5
#define HEADER_SIZE      PROTO_SIZE + PAYLOAD_LEN_SIZE
#define MAX_LINE_SIZE    HEADER_SIZE + MAX_PAYLOAD_SIZE

typedef enum {
    H_PROTOCOL_NONE = 0,
    H_PROTOCOL_LOAD = 1,
    H_PROTOCOL_CALL = 2,

    H_PROTOCOL_LOG = 3,
    H_PROTOCOL_ERROR = 4,
    H_PROTOCOL_EXECTIME = 5,
    H_PROTOCOL_LOADTIME = 6,

    H_PROTOCOL_MAX
} host_protocol_t;

void bs_comm_send_log(char* message);
void bs_comm_send_error(char* message);
void bs_comm_send_exectime(float time);
void bs_comm_send_loadtime(float time);
char* bs_comm_wait_receive(void (*on_load)(char* filename), void (*on_call)(char* funcname));


#endif /* __BS_HOST_COMM__ */