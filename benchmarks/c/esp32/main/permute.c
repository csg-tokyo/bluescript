#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>

#define WARMUP 1
#define CYCLE 5
#define TAG "permute"

#define RESULT 8660

int count;
int v[6];


void swap(int v[6], int i, int j) {
    int tmp = v[i];
    v[i] = v[j];
    v[j] = tmp;
}


void permute(int n) {
    count += 1;
    if (n != 0) {
        int n1 = n - 1;
        permute(n1);
        for (int i = n1; i > -1; i--)
        {
            swap(v, n1, i);
            permute(n1);
            swap(v, n1, i);
        }
    }
}

bool verify_result(int result) {
    return result == RESULT;
}

void benchmark_main() {
    count = 0;
    for (int i = 0; i < 6; i++) {
        v[i] = 0;
    }

    permute(6);
    assert(verify_result(count));
}



