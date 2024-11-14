// Test code
// To cmpile,
// cc -DTEST64 profiler-test.c -lm

#include <string.h>
#include "../src/c-runtime.c"
#include "../src/profiler.c"

#define Assert_true(v)     assert_true(v, __LINE__)

static void assert_true(bool value, int line) {
    if (!value)
        printf("*** ERROR line %d\n", line);
}

#define Assert_str_equals(a, b)     assert_str_equals(a, b, __LINE__)

static void assert_str_equals(const char* a, const char* b, int line) {
    if (strcmp(a, b) != 0)
        printf("*** ERROR line %d: %s, %s\n", line, a, b);
}

static int32_t test_function_object00(int32_t v) {
    return v + 1;
}

static void test_converter() {
    value_t any_i = int_to_value(42);
    typeint_t typeint_i = value_to_typeint(any_i);
    const char* result_str_i = typeint_to_str(typeint_i);
    Assert_str_equals(result_str_i, "integer");
    
    value_t any_f = float_to_value(13.5);
    typeint_t typeint_f = value_to_typeint(any_f);
    const char* result_str_f = typeint_to_str(typeint_f);
    Assert_str_equals(result_str_f, "float");

    value_t any_b = VALUE_FALSE;
    typeint_t typeint_b = value_to_typeint(any_b);
    const char* result_str_b = typeint_to_str(typeint_b);
    Assert_str_equals(result_str_b, "boolean");

    value_t any_u = VALUE_UNDEF;
    typeint_t typeint_u = value_to_typeint(any_u);
    const char* result_str_u = typeint_to_str(typeint_u);
    Assert_str_equals(result_str_u, "undefined");

    value_t any_n = VALUE_NULL;
    typeint_t typeint_n = value_to_typeint(any_n);
    const char* result_str_n = typeint_to_str(typeint_n);
    Assert_str_equals(result_str_n, "undefined");

    value_t s = gc_new_string("test");
    typeint_t typeint_s = value_to_typeint(s);
    const char* result_str_s = typeint_to_str(typeint_s);
    Assert_str_equals(result_str_s, "string");

    value_t arr = gc_new_array(true, 2, int_to_value(4));
    typeint_t typeint_arr = value_to_typeint(arr);
    const char* result_str_arr = typeint_to_str(typeint_arr);
    Assert_str_equals(result_str_arr, "Array<any>");

    value_t iarr = gc_new_intarray(3, 0);
    typeint_t typeint_iarr = value_to_typeint(iarr);
    const char* result_str_iarr = typeint_to_str(typeint_iarr);
    Assert_str_equals(result_str_iarr, "Array<integer>");

    value_t farr = gc_new_floatarray(4, 1.2);
    typeint_t typeint_farr = value_to_typeint(farr);
    const char* result_str_farr = typeint_to_str(typeint_farr);
    Assert_str_equals(result_str_farr, "Array<float>");

    value_t barr = gc_new_bytearray(true, 5, 0);
    typeint_t typeint_barr = value_to_typeint(barr);
    const char* result_str_barr = typeint_to_str(typeint_barr);
    Assert_str_equals(result_str_barr, "Array<boolean>");

    value_t func = gc_new_function(test_function_object00, "(i)i", int_to_value(3));
    typeint_t typeint_func = value_to_typeint(func);
    const char* result_str_func = typeint_to_str(typeint_func);
    Assert_str_equals(result_str_func, "Function");
}

void test_type_counter() {
    value_t p1_1 = int_to_value(3);
    value_t p2_1 = gc_new_string("test");
    value_t p1_2 = float_to_value(1.2);
    value_t p2_2 = float_to_value(3.4);
    typeint_t* type_profile = malloc(TYPE_PROFILE_SIZE);
    for (int i = 0; i < TYPE_COUNT_THRESHOLD - 2; i++) {
        get_row_on_threshold(0, type_profile, p1_1, p2_1, VALUE_UNDEF, VALUE_UNDEF);
    }
    typeint_t* r1 = get_row_on_threshold(0, type_profile, p1_1, p2_1, VALUE_UNDEF, VALUE_UNDEF);
    Assert_true(r1 == NULL);
    typeint_t* r2 = get_row_on_threshold(0, type_profile, p1_2, p2_2, VALUE_UNDEF, VALUE_UNDEF);
    Assert_true(r1 == NULL);
    typeint_t* r3 = get_row_on_threshold(0, type_profile, p1_1, p2_1, VALUE_UNDEF, VALUE_UNDEF);
    Assert_true(r3 != NULL);
    Assert_str_equals(row_to_str(r3), "integer, string, undefined, undefined");
}

int main() {
    gc_initialize();
    test_converter();
    test_type_counter();
    puts("done");
}