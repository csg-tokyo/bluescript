// Test code for value_to_float and float_to_value functions in c-runtime.c
// To compile,
// cc -DTEST64 float-test.c -lm

#include <stdio.h>
#include <stdlib.h>
#include <assert.h>
#include <math.h>
#include "../src/c-runtime.c"

// VALUE_FLOAT__MAX_NORMAL_NUMBER = 1.111... x 2^(31)
value_t       VALUE_FLOAT__MAX_NORMAL_NUMBER__IN_VALUE =   0x7DFFFFFDu;
// 31 = 158 - 127 = 0x9E - 127 = (0x4F000000 >> 23) - 127
float_or_uint VALUE_FLOAT__MAX_NORMAL_NUMBER__IN_FLOAT = { 0x4F7FFFFFu };

// VALUE_FLOAT__MIN_NORMAL_NUMBER = 1.000... x 2^(-30)
value_t       VALUE_FLOAT__MIN_NORMAL_NUMBER__IN_VALUE =   0x02000001u;
// -30 = 97 - 127 = 0x61 - 127 = (0x30800000 >> 23) - 127
float_or_uint VALUE_FLOAT__MIN_NORMAL_NUMBER__IN_FLOAT = { 0x30800000u };

// VALUE_FLOAT__MAX_SUBNORMAL_NUMBER = 0.111... x 2^(-30) = 1.111...10 x 2^(-31)
value_t       VALUE_FLOAT__MAX_SUBNORMAL_NUMBER__IN_VALUE =   0x01FFFFFDu;
// -31 = 96 - 127 = 0x60 - 127 = (0x30000000 >> 23) - 127
float_or_uint VALUE_FLOAT__MAX_SUBNORMAL_NUMBER__IN_FLOAT = { 0x307FFFFEu };

// VALUE_FLOAT__MIN_SUBNORMAL_NUMBER = 0.000...01 x 2^(-30) = 1.000... x 2^(-53)
value_t       VALUE_FLOAT__MIN_SUBNORMAL_NUMBER__IN_VALUE =   0x00000005u;
// 1.0000... x 2^(-54) is rounded up to 1.000... x 2^(-53)
// -54 = 73 - 127 = 0x49 - 127 = (0x24800000 >> 23) - 127
float_or_uint VALUE_FLOAT__MIN_SUBNORMAL_NUMBER__IN_FLOAT = { 0x24800000u };


// VALUE_FLOAT__MAX_ENCODE_ERROR = 1.111... x 2^(-55)
// -55 = 72 - 127 = 0x48 - 127 = (0x24000000 >> 23) - 127
float_or_uint VALUE_FLOAT__MAX_ENCODE_ERROR = { 0x24800000u };


int silent = 0;
#define ASSERT(cond) do {         \
            if (!(cond)) {            \
                printf("assertion failed: `%s'\n", #cond); \
                printf("%s\n", msg1); \
                printf("%s\n", msg2); \
                exit(1);              \
            }                         \
        } while (0)

void test(float f) {
    float_or_uint g, h;
    char msg1[1024], msg2[1024];
    sprintf(msg2, "");
    g.f = f;
    value_t v = float_to_value(g.f);
    h.f = value_to_float(v);
    sprintf(msg2, "%g (0x%08x)  -->  0x%08x  -->  %g (0x%08x)", g.f, g.u, v, h.f, h.u);
    ASSERT((v & 3u) == 1u);
    float abs_f = fabs(f);
    if (isnan(f)) {
        // f was NaN
        sprintf(msg1, "NaN");
        ASSERT(isnan(h.f));
    } else if (abs_f > VALUE_FLOAT__MAX_NORMAL_NUMBER__IN_FLOAT.f) {
        // f was a large number which was not encodable to value_t
        sprintf(msg1, "infinity");
        ASSERT(isinf(h.f));
    } else if (VALUE_FLOAT__MIN_NORMAL_NUMBER__IN_FLOAT.f <= abs_f && abs_f <= VALUE_FLOAT__MAX_NORMAL_NUMBER__IN_FLOAT.f) {
        // f is encodable to value_t as a normal number
        sprintf(msg1, "normal number\n");
        ASSERT(h.u == g.u);
    } else if ((g.u & 0x7FFFFFFFu) == 0x307FFFFFu) {
        // exceptional case (between normal number and subnormal number)
        sprintf(msg1, "between normal and subnormal numbers");
        ASSERT(h.u == ((g.u & 0x80000000u) | 0x30800000u));
    } else if (VALUE_FLOAT__MIN_SUBNORMAL_NUMBER__IN_FLOAT.f <= abs_f && abs_f <= VALUE_FLOAT__MAX_SUBNORMAL_NUMBER__IN_FLOAT.f) {
        // subnormal numbers
        sprintf(msg1, "subnormal number");
        ASSERT(fabs(h.f - g.f) <= VALUE_FLOAT__MAX_ENCODE_ERROR.f);
    } else if (abs_f < VALUE_FLOAT__MIN_SUBNORMAL_NUMBER__IN_FLOAT.f) {
        sprintf(msg1, "zero\n");
        ASSERT(h.u == (g.u & 0x80000000u));
    } else {
        printf("panic: %e (0x%08x)\n", f, g.u);
    }
    if (!silent) {
        printf("%s\n%s\n", msg1, msg2);
    }
}


int main() {
    printf("normal numbers\n");
    test(1.0);
    test(10.0);
    test(100.0);
    test(-1.0);
    test(-10.0);
    test(-100.0);
    test(0.1);
    test(0.01);
    test(0.001);
    test(-0.1);
    test(-0.01);
    test(-0.001);

    printf("\n\nspecific numbers\n");
    test(0.0);
    test(-0.0);
    test(INFINITY);
    test(-INFINITY);
    test(NAN);

    printf("\n\nlarge numbers (encodable to normal numbers)\n");
    test(1e9);
    test(-1e9);

    printf("\n\nsmall numbers (encodable to normal numbers)\n");
    test(1e-9);
    test(-1e-9);

    printf("\n\nlarge numbers (letting exponential part to overflow)\n");
    test(1e20);
    test(-1e20);

    printf("\n\nsubnormal numbers\n");
    test(1e-40);
    test(-1e-40);

    printf("\n\nsmall numbers (letting exponential part to overflow)\n");
    test(1e-20);
    test(-1e-20);

    printf("\n\nsmall numbers (encodable to subnormal numbers)\n");
    test(1e-15);
    test(-1e-15);



    printf("\n\nthe maximum normal number of value_t\n");
    { uint32_t f = 0x4F7FFFFFu; test(*(float*)&f); }
    { uint32_t f = 0xCF7FFFFFu; test(*(float*)&f); }

    printf("\n\nthe minimum number which is inf in value_t\n");
    { uint32_t f = 0x4F800000u; test(*(float*)&f); }
    { uint32_t f = 0xCF800000u; test(*(float*)&f); }

    printf("\n\nthe minimum normal number of value_t\n");
    { uint32_t f = 0x30800000u; test(*(float*)&f); }
    { uint32_t f = 0xB0800000u; test(*(float*)&f); }

    printf("\n\nthe maximum subnormal number of value_t\n");
    { uint32_t f = 0x307FFFFEu; test(*(float*)&f); }
    { uint32_t f = 0x307FFFFFu; test(*(float*)&f); }
    { uint32_t f = 0xB07FFFFEu; test(*(float*)&f); }
    { uint32_t f = 0xB07FFFFFu; test(*(float*)&f); }

    printf("\n\nthe minimum subnormal number of value_t\n");
    { uint32_t f = 0x25000000u; test(*(float*)&f); }
    { uint32_t f = 0xA5000000u; test(*(float*)&f); }

    printf("\n\nthe maximum number which is zero in value_t\n");
    { uint32_t f = 0x24FFFFFFu; test(*(float*)&f); }
    { uint32_t f = 0xA4FFFFFFu; test(*(float*)&f); }



    silent = 1;

    printf("\n\nrandom test\n");
    const uint64_t P = 523717u;  // # of tests
    const uint64_t Q = 519u;     // 0 <= Q < floor(2^32 / P)
    for (uint64_t i = 0; i < P; i++) {
        float_or_uint f = { (i << 32) / P + Q };
        test(f.f);
    }
    printf("random test: pass\n");

    return 0;
}