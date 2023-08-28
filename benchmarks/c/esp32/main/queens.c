#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>
#include <string.h>

#define WARMUP 0
#define CYCLE 3
#define TAG "queens"

bool free_rows[8] = {true};
bool free_maxs[16] = {true};
bool free_mins[16] = {true};
int queen_rows[8] = {-1};

void set_row_column(int r, int c, bool v) {
    free_rows[r] = v;
    free_maxs[c + r] = v;
    free_mins[c - r + 7] = v;
}

bool get_row_column(int r, int c) {
    return (free_rows[r] && free_maxs[c + r] && free_mins[c - r + 7]);
}

bool place_queen(int c) {
    for (int r = 0; r < 8; r++) {
        if (get_row_column(r, c)) {
            queen_rows[r] = c;
            set_row_column(r, c, false);
            if (c == 7) {
                return true;
            }
            if (place_queen(c + 1)) {
                return true;
            }

            set_row_column(r, c, true);
        }
    }
    return false;
}

bool queens() {
    memset(free_rows, true, sizeof free_rows);
    memset(free_maxs, true, sizeof free_maxs);
    memset(free_mins, true, sizeof free_mins);
    memset(queen_rows, -1, sizeof queen_rows);

    return place_queen(0);
}



bool verify_result(bool result) {
    return result;
}

void benchmark_main() {
    bool result = true;
    for (int i = 0; i < 10; i++) {
        result = result && queens();
    }
    assert(verify_result(result));
}
