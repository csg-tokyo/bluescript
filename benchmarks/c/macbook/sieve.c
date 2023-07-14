#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>

#define WARMUP 100
#define CYCLE 100
#define TAG "sieve"


#define SIZE 5000
#define RESULT 669

int seive(bool flags[SIZE], int size) {
    int prime_count = 0;
    
    for (int i = 2; i < size + 1; i++) {
        if (flags[i - 1]) {
            prime_count += 1;
            int k = i * 2;
            while (k <= size) {
                flags[k - 1] = false;
                k += i;
            }
        }
    }
    
    return prime_count;
}

bool verify_result(int result) {
    return result == RESULT;
}

void benchmark_main() {
    bool flags[SIZE];
    for (int i = 0; i < SIZE; i++) {
        flags[i] = true;
    }

    int result = seive(flags, SIZE);
    assert(verify_result(result));
}
