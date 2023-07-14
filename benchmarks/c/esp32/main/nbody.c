#include <math.h>
#include <float.h>
#include <sys/time.h>
#include <stdio.h>
#include <stdbool.h>
#include <assert.h>


#define WARMUP 0
#define CYCLE  2
#define TAG "nbody"

#define ITERATIONS 250000
#define RESULT -0.1690859889909308

#define PI 3.141592653589793
#define SOLAR_MASS (4.0 * PI * PI)
#define DAYS_PER_YER 365.24

#define NUM_OF_BODIES 5

typedef struct {
    float x;
    float y;
    float z;
    float vx;
    float vy;
    float vz;
    float mass;
} body;

body jupiter = {
    4.84143144246472090e00,
    -1.16032004402742839e00,
    -1.03622044471123109e-01,
    1.66007664274403694e-03 * DAYS_PER_YER,
    7.69901118419740425e-03 * DAYS_PER_YER,
    -6.90460016972063023e-05 * DAYS_PER_YER,
    9.54791938424326609e-04 * SOLAR_MASS
};

body saturn = {
    8.34336671824457987e00,
    4.12479856412430479e00,
    -4.03523417114321381e-01,
    -2.76742510726862411e-03 * DAYS_PER_YER,
    4.99852801234917238e-03 * DAYS_PER_YER,
    2.30417297573763929e-05 * DAYS_PER_YER,
    2.85885980666130812e-04 * SOLAR_MASS
};

body uranus = {
    1.28943695621391310e01,
    -1.51111514016986312e01,
    -2.23307578892655734e-01,
    2.96460137564761618e-03 * DAYS_PER_YER,
    2.37847173959480950e-03 * DAYS_PER_YER,
    -2.96589568540237556e-05 * DAYS_PER_YER,
    4.36624404335156298e-05 * SOLAR_MASS
};

body neptune = {
    1.53796971148509165e01,
    -2.59193146099879641e01,
    1.79258772950371181e-01,
    2.68067772490389322e-03 * DAYS_PER_YER,
    1.62824170038242295e-03 * DAYS_PER_YER,
    -9.51592254519715870e-05 * DAYS_PER_YER,
    5.15138902046611451e-05 * SOLAR_MASS,
};

body sun = {0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0 * SOLAR_MASS};

void advance(body bodies[NUM_OF_BODIES], float dt) {
    for (int i = 0; i < NUM_OF_BODIES; i++) {
        body *i_body = &bodies[i];

        for (int j = i + 1; j < NUM_OF_BODIES; j++) {
            body *j_body = &bodies[j];
            float dx = i_body->x - j_body->x;
            float dy = i_body->y - j_body->y;
            float dz = i_body->z - j_body->z;

            float d_squared = dx * dx + dy * dy + dz * dz;
            float distance = sqrt(d_squared);
            float mag = dt / (d_squared * distance);

            i_body->vx = i_body->vx - (dx * j_body->mass * mag);
            i_body->vy = i_body->vy - (dy * j_body->mass * mag);
            i_body->vz = i_body->vz - (dz * j_body->mass * mag);

            j_body->vx = j_body->vx + (dx * i_body->mass * mag);
            j_body->vy = j_body->vy + (dy * i_body->mass * mag);
            j_body->vz = j_body->vz + (dz * i_body->mass * mag);
        }
    }

    for (int i = 0; i < NUM_OF_BODIES; i++) {
        body *b = &bodies[i];
        b->x = b->x + dt * b->vx;
        b->y = b->y + dt * b->vy;
        b->z = b->z + dt * b->vz;
    }
}

float energy(body bodies[NUM_OF_BODIES]) {
    float e = 0.0;

    for (int i = 0; i < NUM_OF_BODIES; i++) {
        body *i_body = &bodies[i];
        e += (0.5 * i_body->mass * 
            (i_body->vx * i_body->vx 
            + i_body->vy * i_body->vy 
            + i_body->vz * i_body->vz));

        for (int j = i + 1; j < NUM_OF_BODIES; j++) {
            body *j_body = &bodies[j];
            float dx = i_body->x - j_body->x;
            float dy = i_body->y - j_body->y;
            float dz = i_body->z - j_body->z;

            float distance = sqrt(dx * dx + dy * dy + dz * dz);
            e -= (i_body->mass * j_body->mass) / distance;
        }
    }

    return e;
}


bool verify_result(float result) {
    return fabs(result - RESULT) < 1.0e-6;
}


void benchmark_main()
{
    // create bodies.
    body bodies[NUM_OF_BODIES] = {sun, jupiter, saturn, uranus, neptune};
    float px = 0.0;
    float py = 0.0;
    float pz = 0.0;
    for (int i = 0; i < NUM_OF_BODIES; i++) {
        px += bodies[i].vx * bodies[i].mass;
        py += bodies[i].vy * bodies[i].mass;
        pz += bodies[i].vz * bodies[i].mass;
    }
    bodies[0].vx = -(px / SOLAR_MASS);
    bodies[0].vy = -(py / SOLAR_MASS);
    bodies[0].vz = -(pz / SOLAR_MASS);


    for (int i = 0; i < ITERATIONS; i++) {
        advance(bodies, 0.01);
    }
    float e = energy(bodies);
    assert(verify_result(e));
}
