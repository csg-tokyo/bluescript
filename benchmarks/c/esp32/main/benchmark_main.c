/* Hello World Example

   This example code is in the Public Domain (or CC0 licensed, at your option.)

   Unless required by applicable law or agreed to in writing, this
   software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
   CONDITIONS OF ANY KIND, either express or implied.
*/
#include <stdio.h>
#include "sdkconfig.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include <sys/time.h>
#include <stdint.h>

#define BENCHMARK 7

#if BENCHMARK == 0
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

#else
#define WARMUP 100
#define CYCLE 100
#define TAG "no benchmark"
void benchmark_main(void)
{
    printf("No benchimark.\n");
}
#endif

void app_main(void)
{
    printf("Hello world!\n");

    for (int i = 0; i < WARMUP; i++) {
        benchmark_main();
    }

    struct timeval start;
    gettimeofday(&start, NULL);

    for (int i = 0; i < CYCLE; i++) {
        benchmark_main();
    }

    struct timeval end;
    gettimeofday(&end, NULL);

    int64_t time_diff = (int64_t)end.tv_sec * 1000000L + (int64_t)end.tv_usec - ((int64_t)start.tv_sec * 1000000L + (int64_t)start.tv_usec);
    puts(TAG);
    printf("warmup: %d cycle\n", WARMUP);
    printf("%d cycle average: %f ms\n", CYCLE, (double)time_diff / 1000 / CYCLE);

    while (true) {
        printf("Foo\n");
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
}
