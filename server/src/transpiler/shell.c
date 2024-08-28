#include <stdio.h>
#include <dlfcn.h>
#include "../../../microcontroller/core/include/c-runtime.h"

// Read-Evaluate-Print-Loop

static int load_and_run(char* filename, char* funcname) {
    void* handle = dlopen(filename, RTLD_NOW);
    void (*fptr)() = dlsym(handle, funcname);
    if (fptr == NULL) {
        fprintf(stderr, "Error: %s() is not found\n", funcname);
        return 1;
    }
    else {
        int r2 = try_and_catch(fptr);
        return r2;
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

void do_logging(char* msg) {
    FILE* fptr = fopen("log.txt", "a");
    fputs(msg, fptr);
    fputs("\n", fptr);
    fclose(fptr);
}

char prompt[] = "\x1b[1;94m> \x1b[0m";

int main() {
    char libname[64];
    char funcname[64];
    gc_initialize();
    while (getoneline(libname, sizeof(libname) / sizeof(libname[0])) != NULL) {
        if (getoneline(funcname, sizeof(funcname) / sizeof(funcname[0])) == NULL) {
            fprintf(stderr, "Error: no main function in %s is specified\n", libname);
            fflush(stderr);
            return 1;
        }

        load_and_run(libname, funcname);
        fputs(prompt, stdout);
        fflush(stdout);
        fflush(stderr);
    }

    return 0;
}
