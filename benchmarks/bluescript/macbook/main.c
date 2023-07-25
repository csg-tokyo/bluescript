#include <stdio.h>
#include <time.h>
#include <stdlib.h>


#define WARMUP 1
#define CYCLE 3

#if (defined(BENCHMARK) && (BENCHMARK == -1)) 
#include "playground.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 0)) 
#include "sieve.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 1))
#include "nbody.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 2))
#include "permute.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 3))
#include "storage.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 4))
#include "queens.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 5))
#include "towers.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 6))
#include "list.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 7))
#include "bounce.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 9))
#include "biquad.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 10))
#include "fir.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 12))
#include "fft.c"

#else

#include "c-runtime.h"
#include "utils.c"
void bluescript_main2(void)
{
    printf("No benchimark.\n");
}
#endif

int main(int argc, char const *argv[])
{
    int warmup = WARMUP;
    int cycle = CYCLE;
    if (argc == 3) {
        warmup = atoi(argv[1]);
        cycle = atoi(argv[2]);
    }

    gc_initialize();
    
    for (int i = 0; i < warmup; i++) {
        int r = try_and_catch(bluescript_main2);
        if (r > 0) {
            assert(false);
        }
    }

    struct timespec start;
    clock_gettime(CLOCK_REALTIME, &start);

    for (int i = 0; i < cycle; i++) {
        int r = try_and_catch(bluescript_main2);
        if (r > 0) {
            assert(false);
        }
    }

    struct timespec end;
    clock_gettime(CLOCK_REALTIME, &end);

    double diff = difftime(end.tv_sec, start.tv_sec) * 1000 + (double)(end.tv_nsec - start.tv_nsec) / (1000000); // millisecond
    printf("warmup: %d cycle\n", warmup);
    printf("%d cycle average: %f ms\n", cycle, diff / cycle);
}
