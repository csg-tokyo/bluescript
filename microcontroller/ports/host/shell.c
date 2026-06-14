// Copyright (C) 2024- Shigeru Chiba.  All rights reserved.

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <dlfcn.h>
#include "../../core/include/c-runtime.h"
#include "../../core/include/protocol.h"
#include "./std-module.c"


#define PAYLOAD_SIZE 64
#define PROTO_SIZE   3
#define LINE_SIZE    PAYLOAD_SIZE + PROTO_SIZE

typedef struct {
    protocol_t protocol;
    char payload[PAYLOAD_SIZE];
} line_t;

void* file_handle;
static char prompt[] = "\x1b[1;94m> \x1b[0m";

static int ends_with(char* filename, char c) {
    int len = strlen(filename);
    if (len == 0)
        return 0;
    else
        return filename[len - 1] == c;
}

static void load(char* filename) {
    file_handle = dlopen(filename, RTLD_NOW);
}

static int jump(char* funcname) {
    if (file_handle == NULL) {
        fprintf(stderr, "Error: module is not loaded\n");
        return 1;
    }
    void (*fptr)() = dlsym(file_handle, funcname);
    if (fptr == NULL) {
        fprintf(stderr, "Error: %s() is not found\n", funcname);
        return 1;
    }
    else {
        int r2 = try_and_catch(fptr);
        if (ends_with(funcname, '_'))   // when this is not an imported module
            fputs(prompt, stdout);
        return r2;
    }
}

static char* get_line(line_t* line) {
    char* res;
    char buffer[LINE_SIZE];
    char protocol_char[2];
    if ((res = fgets(buffer, LINE_SIZE, stdin)) == NULL) {
        buffer[0] = '\0';
        return NULL;
    }
    else {
        fprintf(stdout, "buffer: %s\n", buffer);
        protocol_char[0] = buffer[0];
        protocol_char[1] = buffer[1];
        line->protocol = atoi(protocol_char);
        // buffer[2] is whitespace.
        for (int i = PROTO_SIZE; i < LINE_SIZE; i++) {
            if (buffer[i] == 0x0a || buffer[i] == 0x0d)
                line->payload[i - PROTO_SIZE] = '\0';
            else
                line->payload[i - PROTO_SIZE] = buffer[i];
        }
        return res;
    }
}

static void read_protocol(line_t* line) {
    switch (line->protocol)
    {
    case PROTOCOL_LOAD:
        load(line->payload);
        break;
    case PROTOCOL_JUMP:
        jump(line->payload);
        break;
    default:
        break;
    }
}

int main() {
    line_t line[64];
    gc_initialize();
    bluescript_main0_();

    while (get_line(line) != NULL) {
        read_protocol(line);

        fflush(stdout);
        fflush(stderr);
    }

    return 0;
}
