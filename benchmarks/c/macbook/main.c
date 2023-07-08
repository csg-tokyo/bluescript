#include <stdio.h>
#include <time.h>
#include <stdlib.h>

#define WARMUP 100
#define TIMES 100

#if (defined(BENCHMARK) && (BENCHMARK == 0)) 
#include "sieve.c"

#else
void benchmark_main(void)
{
    printf("No benchimark.\n");
}
#endif

int main(int argc, char const *argv[])
{
    int warmup = WARMUP;
    int times = TIMES;
    if (argc == 3) {
        warmup = atoi(argv[1]);
        times = atoi(argv[2]);
    }
    
    for (int i = 0; i < warmup; i++) {
        benchmark_main();
    }

    struct timespec start;
    clock_gettime(CLOCK_REALTIME, &start);

    for (int i = 0; i < times; i++) {
        benchmark_main();
    }

    struct timespec end;
    clock_gettime(CLOCK_REALTIME, &end);

    double diff = difftime(end.tv_sec, start.tv_sec) * 1000 + (double)(end.tv_nsec - start.tv_nsec) / (1000000); // millisecond
    printf("warmup: %d cycle\n", warmup);
    printf("%d times average: %f ms\n", times, diff / times);
}
