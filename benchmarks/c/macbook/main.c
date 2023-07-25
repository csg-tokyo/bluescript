#include <stdio.h>
#include <time.h>
#include <stdlib.h>


#if (defined(BENCHMARK) && (BENCHMARK == 0)) 
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

#elif (defined(BENCHMARK) && (BENCHMARK == 8))
#include "mandelbrot.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 9))
#include "biquad.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 10))
#include "fir.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 11))
#include "crc.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 12))
#include "fft.c"

#elif (defined(BENCHMARK) && (BENCHMARK == 13))
#include "sha256.c"

#else
#define WARMUP 10
#define CYCLE 10
#define TAG "no benchmark"
void benchmark_main(void)
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
    
    for (int i = 0; i < warmup; i++) {
        benchmark_main();
    }

    struct timespec start;
    clock_gettime(CLOCK_REALTIME, &start);

    for (int i = 0; i < cycle; i++) {
        benchmark_main();
    }

    struct timespec end;
    clock_gettime(CLOCK_REALTIME, &end);

    double diff = difftime(end.tv_sec, start.tv_sec) * 1000 + (double)(end.tv_nsec - start.tv_nsec) / (1000000); // millisecond
    puts(TAG);
    printf("warmup: %d cycle\n", warmup);
    printf("%d cycle average: %f ms\n", cycle, diff / cycle);
}
