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

#define BENCHMARK 0

#if BENCHMARK == 0
#include "sieve.c"

#else
#define WARMUP 100
#define TIMES 100
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

    for (int i = 0; i < TIMES; i++) {
        benchmark_main();
    }

    struct timeval end;
    gettimeofday(&end, NULL);

    int64_t time_diff = (int64_t)end.tv_sec * 1000000L + (int64_t)end.tv_usec - ((int64_t)start.tv_sec * 1000000L + (int64_t)start.tv_usec);
    printf("warmup: %d cycle\n", WARMUP);
    printf("%d times average: %f ms\n", TIMES, (double)time_diff / 1000 / TIMES);

    while (true) {
        printf("Foo\n");
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
}
