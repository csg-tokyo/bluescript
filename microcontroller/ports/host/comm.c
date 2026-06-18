#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <dlfcn.h>
#include "./comm.h"


static void comm_send(host_protocol_t protocol, char* payload) {
    char line[MAX_LINE_SIZE];
    snprintf(line, PROTO_SIZE, "%02d", protocol);
    line[PROTO_SIZE - 1] = ' ';
    snprintf((char*)(line + PROTO_SIZE), PAYLOAD_LEN_SIZE, "%04d", (int)strlen(payload));
    line[HEADER_SIZE - 1] = ' ';
    strcpy((char*)(line + HEADER_SIZE), payload);
    fprintf(stdout, line);
    fflush(stdout);
}

void bs_comm_send_log(char* message) {
    comm_send(H_PROTOCOL_LOG, message);
}

void bs_comm_send_error(char* message) {
    comm_send(H_PROTOCOL_ERROR, message);
}

void bs_comm_send_exectime(float time) {
    char* timestr[16];
    snprintf(timestr, sizeof(timestr), "%.4f", time);
    comm_send(H_PROTOCOL_EXECTIME, timestr);
}

void bs_comm_send_loadtime(float time) {
    char* timestr[16];
    snprintf(timestr, sizeof(timestr), "%.2f", time);
    comm_send(H_PROTOCOL_LOADTIME, timestr);
}

static void parse_line(char* line, host_protocol_t* protocol, char* payload) {
    char protocol_char[PROTO_SIZE];
    protocol_char[0] = line[0];
    protocol_char[1] = line[1];
    protocol_char[2] = NULL;
    char payload_len_char[PAYLOAD_LEN_SIZE];
    payload_len_char[0] = line[PROTO_SIZE + 0];
    payload_len_char[1] = line[PROTO_SIZE + 1];
    payload_len_char[2] = line[PROTO_SIZE + 2];
    payload_len_char[3] = line[PROTO_SIZE + 3];
    payload_len_char[4] = NULL;
    *protocol = atoi(protocol_char);
    int payload_len = atoi(payload_len_char);
    for (int i = 0; i < payload_len; i++) {
        if (line[HEADER_SIZE + i] == 0x0a || line[HEADER_SIZE + i] == 0x0d)
            payload[i] = '\0';
        else
            payload[i] = line[HEADER_SIZE + i];
    }
}

static char* getoneline(char* buffer, int size) {
    char* res;
    if ((res = fgets(buffer, size, stdin)) == NULL) {
        buffer[0] = '\0';
        return NULL;
    }
    else {
        for (int i = 0; i < size; i++)
            if (buffer[i] == 0x0a || buffer[i] == 0x0d)
                buffer[i] = '\0';
        return res;
    }
}

char* bs_comm_wait_receive(void (*on_load)(char* filename), void (*on_call)(char* funcname)) {
    char line[MAX_LINE_SIZE] = {0};
    char* res = getoneline(line, MAX_LINE_SIZE);
    if (res == NULL)
        return NULL;

    int protocol;
    char payload[MAX_PAYLOAD_SIZE] = {0};
    parse_line(line, &protocol, payload);

    switch (protocol) {
        case H_PROTOCOL_LOAD:
            on_load(payload);
            break;
        case H_PROTOCOL_CALL:
            on_call(payload);
            break;
        default:
            fprintf(stderr, "Error: unknown protocol\n");
            break;
    }
    return res;
}



