// Copyright (C) 2024- Shigeru Chiba.  All rights reserved.

#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include "../../core/include/c-runtime.h"
#include "./comm.h"

#ifndef _WIN32
#include <dlfcn.h>
#include <time.h>
#else
#include <windows.h>
#endif


extern void bluescript_main0_();

void* file_handle;

static float get_time_ms() {
#ifndef _WIN32
    static struct timespec ts0 = { 0, -1 };
    struct timespec ts;
    if (ts0.tv_nsec < 0)
        clock_gettime(CLOCK_REALTIME, &ts0);

    clock_gettime(CLOCK_REALTIME, &ts);
    return (float)(ts.tv_sec - ts0.tv_sec) * 1000.0 + (float)(ts.tv_nsec - ts0.tv_nsec) / 1000000.0;
#else
    static LARGE_INTEGER freq = { 0 };
    static LARGE_INTEGER start = { 0 };
    LARGE_INTEGER now;
    if (freq.QuadPart == 0) {
        QueryPerformanceFrequency(&freq);
        QueryPerformanceCounter(&start);
    }
    QueryPerformanceCounter(&now);
    return (float)(now.QuadPart - start.QuadPart) * 1000.0f / (float)freq.QuadPart;
#endif
}

static void load(char* filename) {
    float start_time = get_time_ms();
#ifndef _WIN32
    if (file_handle != NULL) {
        dlclose(file_handle);
    }
    file_handle = dlopen(filename, RTLD_NOW | RTLD_GLOBAL);
#else
    if (file_handle != NULL) {
        FreeLibrary((HMODULE)file_handle);
    }
    file_handle = (void*)LoadLibraryA(filename);
    if (file_handle == NULL) {
        fprintf(stderr, "Error: failed to load %s (error %lu)\n", filename, GetLastError());
    }
#endif
    bs_comm_send_loadtime(get_time_ms() - start_time);
}

static void call(char* funcname) {
    if (file_handle == NULL) {
        fprintf(stderr, "Error: module is not loaded\n");
        //return 1;
    }
#ifndef _WIN32
    void (*fptr)(void) = (void (*)(void))dlsym(file_handle, funcname);
#else
    void (*fptr)(void) = (void (*)(void))GetProcAddress((HMODULE)file_handle, funcname);
#endif
    if (fptr == NULL) {
        fprintf(stderr, "Error: %s() is not found\n", funcname);
        //return 1;
    } else {
        float start_time = get_time_ms();
        int r2 = try_and_catch(fptr);
        bs_comm_send_exectime(get_time_ms() - start_time);
        //return r2;
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
