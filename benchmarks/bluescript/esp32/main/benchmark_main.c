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

#define BENCHMARK 1

#if BENCHMARK == 0
#include "sieve.c"
#elif BENCHMARK == 1
#include "nbody.c"

#elif BENCHMARK == 2
#include "permute.c"

#elif BENCHMARK == 3
#include "storage.c"

#elif BENCHMARK == 4
#include "queens.c"

#elif BENCHMARK == 5
#include "towers.c"

#elif BENCHMARK == 6
#include "list.c"

#elif BENCHMARK == 7
#include "bounce.c"

#elif BENCHMARK == 9
#include "biquad.c"

#elif BENCHMARK == 10
#include "fir.c"



#else
#define WARMUP 0
#define CYCLE 1
#define TAG "no benchmark"
void bluescript_main2(void)
{
    printf("No benchimark.\n");
}
#endif

void app_main(void)
{
    printf("Hello world!\n");

    gc_initialize();

    for (int i = 0; i < WARMUP; i++) {
        bluescript_main2();
    }

    struct timeval start;
    gettimeofday(&start, NULL);

    for (int i = 0; i < CYCLE; i++) {
        bluescript_main2();
    }

    struct timeval end;
    gettimeofday(&end, NULL);

    int64_t time_diff = (int64_t)end.tv_sec * 1000000L + (int64_t)end.tv_usec - ((int64_t)start.tv_sec * 1000000L + (int64_t)start.tv_usec);
    puts(TAG);
    printf("warmup: %d cycle\n", WARMUP);
    printf("%d cycle average: %f ms\n", CYCLE, (double)time_diff / 1000 / CYCLE);

    while (true) {
        vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
}
