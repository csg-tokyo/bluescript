// Test code for value_to_float and float_to_value functions in c-runtime.c
// To compile,
// cc -DTEST64 float-test.c

#include <stdio.h>
#include <assert.h>
#include <math.h>
#include "../components/c-runtime/c-runtime.c"

int test_count = 0;

void test(float f) {
    test_count++;
    printf("\ntest #%d\n", test_count);
    value_t v = float_to_value(f);
    assert((v & 3u) == 1u);
    float g = value_to_float(v);
    printf("%g (0x%08x)  -->  0x%08x  -->  %g (0x%08x)\n", f, *(uint32_t*)&f, v, g, *(uint32_t*)&g);
    assert(fabsf(f - g) < 9.314e-10 || !isnan(f) && isinf(g) || isnan(f) && isnan(g));
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
    { uint32_t f = 0x307FFFFFu; test(*(float*)&f); }
    { uint32_t f = 0xB07FFFFFu; test(*(float*)&f); }

    printf("\n\nthe minimum subnormal number of value_t\n");
    { uint32_t f = 0x25000000u; test(*(float*)&f); }
    { uint32_t f = 0xA5000000u; test(*(float*)&f); }

    printf("\n\nthe maximum number which is zero in value_t\n");
    { uint32_t f = 0x24FFFFFFu; test(*(float*)&f); }
    { uint32_t f = 0xA4FFFFFFu; test(*(float*)&f); }

    return 0;
}
