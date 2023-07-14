#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>

#define WARMUP 0
#define CYCLE 1
#define TAG "mandelbrot"

#define ITERATIONS 330
#define RESULT 191

int mandelbrot(int size) {
    int _sum = 0;
    int byte_acc = 0;
    int bit_num = 0;

    int y = 0;
    int count = 0;

    while (y < size) {
        double ci = (2.0 * (double)y / (double)size) - 1.0;
        int x = 0;

        while (x < size) {
            double zrzr = 0.0;
            double zi = 0.0;
            double zizi = 0.0;
            double cr = (2.0 * (double)x / (double)size) - 1.5;

            int z = 0;
            bool not_done = true;
            int escape = 0;
            while (not_done && z < 50) {
                double zr = zrzr - zizi + cr;
                zi = 2.0 * zr * zi + ci;

                zrzr = zr * zr;
                zizi = zi * zi;

                if (zrzr + zizi > 4.0) {
                    not_done = false;
                    escape = 1;
                }
                z += 1;
            }
            byte_acc = (byte_acc << 1) + escape;
            bit_num = bit_num + 1;

            if (bit_num == 8) {
                _sum ^= byte_acc;
                byte_acc = 0;
                bit_num = 0;
            } else if (x == size - 1) {
                byte_acc <<= 8 - bit_num;
                _sum ^= byte_acc;
                byte_acc = 0;
                bit_num = 0;
            }
            x += 1;
        }
        printf("sum: %d\n", _sum);
        y += 1;
    }
    printf("count: %d\n", count);
    return _sum;
}

bool verify_result(int result) {
    return result == RESULT;
}

void benchmark_main() {
    int result = mandelbrot(ITERATIONS);
    printf("%d\n", result);
    assert(verify_result(result));
}
