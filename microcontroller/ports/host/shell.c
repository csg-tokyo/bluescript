// Copyright (C) 2024- Shigeru Chiba.  All rights reserved.

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <dlfcn.h>
#include <time.h>
#include "../../core/include/c-runtime.h"
#include "../../core/include/protocol.h"
#include "./std-module.c"
#include "./comm.h"


void* file_handle;

static float get_time_ms() {
    static struct timespec ts0 = { 0, -1 };
    struct timespec ts;
    if (ts0.tv_nsec < 0)
        clock_gettime(CLOCK_REALTIME, &ts0);

    clock_gettime(CLOCK_REALTIME, &ts);
    return (float)(ts.tv_sec - ts0.tv_sec) * 1000.0 + (float)(ts.tv_nsec - ts0.tv_nsec) / 1000000.0;
}

static void load(char* filename) {
    float start_time = get_time_ms();
    file_handle = dlopen(filename, RTLD_NOW);
    bs_comm_send_loadtime(get_time_ms() - start_time);
}

static int call(char* funcname) {
    if (file_handle == NULL) {
        fprintf(stderr, "Error: module is not loaded\n");
        return 1;
    }
    void (*fptr)() = dlsym(file_handle, funcname);
    if (fptr == NULL) {
        fprintf(stderr, "Error: %s() is not found\n", funcname);
        return 1;
    } else {
        float start_time = get_time_ms();
        int r2 = try_and_catch(fptr);
        bs_comm_send_exectime(get_time_ms() - start_time);
        return r2;
    }
}

int main() {
    gc_initialize();
    bluescript_main0_();

    while (bs_comm_wait_receive(load, call) != NULL) {
        fflush(stdout);
        fflush(stderr);
    }

    return 0;
}
