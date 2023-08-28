#include <stdint.h>
#include <stdlib.h>
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>

#define WARMUP 0
#define CYCLE 3
#define TAG "bounce"


#define RESULT 1331
#define BALL_COUNT 100


// random
int random_seed = 74755;

int random_next() {
    random_seed = ((random_seed * 1309) + 13849) & 65535;
    return random_seed;
}

// finish random

typedef struct ball {
    int x;
    int y;
    int x_vel;
    int y_vel;
} ball_t;

bool ball_bounce(ball_t *ball) {
    int x_limit = 500;
    int y_limit = 500;
    bool bounced = false;

    ball->x += ball->x_vel;
    ball->y += ball->y_vel;

    if (ball->x > x_limit) {
        ball->x = x_limit;
        ball->x_vel = -abs(ball->x_vel);
        bounced = true;
    }
    if (ball->x < 0) {
        ball->x = 0;
        ball->x_vel = abs(ball->x_vel);
        bounced = true;
    }
    if (ball->y > y_limit) {
        ball->y = y_limit;
        ball->y_vel = -abs(ball->y_vel);
        bounced = true;
    }
    if (ball->y < 0) {
        ball->y = 0;
        ball->y_vel = abs(ball->y_vel);
        bounced = true;
    }
    return bounced;
}

int bounce() {
    random_seed = 74755;
    int ball_count = BALL_COUNT;
    int bounces = 0;
    // ball_t balls[ball_count];
    ball_t *balls = malloc(sizeof(ball_t) * ball_count);
    for (int i = 0; i < ball_count; i++) {
        ball_t ball = {
            random_next() % 500,
            random_next() % 500,
            (random_next() % 300) - 150,
            (random_next() % 300) - 150
        };
        balls[i] = ball;
    }
    for (int i = 0; i < 50; i++) {
        for (int b = 0; b < ball_count; b++) {
            if (ball_bounce(&balls[b])) {
                bounces += 1;
            }
        }
    }
    free(balls);
    return bounces;
}

bool verify_result(int result) {
    return result == RESULT;
}

void benchmark_main() {
    int result = bounce();
    assert(verify_result(result));
}
