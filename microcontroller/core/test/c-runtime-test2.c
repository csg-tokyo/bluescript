// Test code for c-runtime.c
// To compile,
// cc -DTEST64 c-runtime-test2.c -lm

#include <stdio.h>
#include "../src/c-runtime.c"

static int nerrors = 0;

#define Assert_true(v)     assert_true(v, __LINE__)

static void assert_true(bool value, int line) {
    if (!value) {
        printf("*** ERROR line %d\n", line);
        nerrors++;
    }
}

#define Assert_equals(a, b)     assert_equals(a, b, __LINE__)

static void assert_equals(int a, int b, int line) {
    if (a != b) {
        printf("*** ERROR line %d: %d, %d\n", line, a, b);
        nerrors++;
    }
}

#define Assert_fequals(a, b)     assert_fequals(a, b, __LINE__)

static void assert_fequals(float a, float b, int line) {
    if (a != b) {
        printf("*** ERROR line %d: %f (%x), %f (%x)\n",
               line, a, *(uint32_t*)&a, b, *(uint32_t*)&b);
        nerrors++;
    }
}

void test_any_add() {
    value_t i = int_to_value(1);
    value_t j = int_to_value(-13);
    value_t f = float_to_value(0.5);
    value_t g = float_to_value(-9.5);

    Assert_equals(any_add(i, j), int_to_value(-12));
    Assert_fequals(any_add(i, f), float_to_value(1.5));
    Assert_fequals(any_add(f, j), float_to_value(-12.5));
    Assert_fequals(any_add(f, g), float_to_value(-9));

    Assert_equals(any_subtract(i, j), int_to_value(14));
    Assert_fequals(any_subtract(i, f), float_to_value(0.5));
    Assert_fequals(any_subtract(f, j), float_to_value(13.5));
    Assert_fequals(any_subtract(f, g), float_to_value(10.0));

    Assert_equals(any_multiply(i, j), int_to_value(-13));
    Assert_fequals(any_multiply(i, f), float_to_value(0.5));
    Assert_fequals(any_multiply(f, j), float_to_value(-6.5));
    Assert_fequals(any_multiply(f, g), float_to_value(-9.5 * 0.5));

    Assert_equals(any_divide(j, i), int_to_value(-13));
    Assert_fequals(any_divide(i, f), float_to_value(2.0));
    Assert_fequals(any_divide(f, j), float_to_value(0.5 / -13.0));
    Assert_fequals(any_divide(f, g), float_to_value(0.5 / -9.5));
}

void test_any_less() {
    value_t i = int_to_value(1);
    value_t j = int_to_value(-13);
    value_t h = float_to_value(-13.0);
    value_t f = float_to_value(0.5);
    value_t g = float_to_value(-9.5);

    Assert_true(!any_less(i, j));
    Assert_true(!any_less(i, f));
    Assert_true(!any_less(f, j));
    Assert_true(!any_less(f, g));

    Assert_true(!any_less_eq(i, j));
    Assert_true(!any_less_eq(i, f));
    Assert_true(!any_less_eq(f, j));
    Assert_true(!any_less_eq(f, g));
    Assert_true(any_less_eq(i, i));
    Assert_true(any_less_eq(f, f));
    Assert_true(any_less_eq(j, h));

    Assert_true(any_greater(i, j));
    Assert_true(any_greater(i, f));
    Assert_true(any_greater(f, j));
    Assert_true(any_greater(f, g));

    Assert_true(any_greater_eq(i, j));
    Assert_true(any_greater_eq(i, f));
    Assert_true(any_greater_eq(f, j));
    Assert_true(any_greater_eq(f, g));
    Assert_true(any_greater_eq(i, i));
    Assert_true(any_greater_eq(j, h));
}

void test_any_add_assign() {
    value_t i = int_to_value(1);
    value_t j = int_to_value(-13);
    value_t f = float_to_value(0.5);
    value_t g = float_to_value(-9.5);

    Assert_equals(any_add_assign(&i, j), int_to_value(-12));
    Assert_fequals(any_add_assign(&i, f), float_to_value(12.5));
    Assert_fequals(any_add_assign(&f, j), float_to_value(-12.5));
    Assert_fequals(any_add_assign(&f, g), float_to_value(-22));

    Assert_equals(any_subtract_assign(&i, j), int_to_value(14));
    Assert_fequals(any_subtract_assign(&i, f), float_to_value(13.5));
    Assert_fequals(any_subtract_assign(&f, j), float_to_value(13.5));
    Assert_fequals(any_subtract_assign(&f, g), float_to_value(4.0));

    Assert_equals(any_multiply_assign(&i, j), int_to_value(-13));
    Assert_fequals(any_multiply_assign(&i, f), float_to_value(-13 * 0.5));
    Assert_fequals(any_multiply_assign(&f, j), float_to_value(-6.5));
    Assert_fequals(any_multiply_assign(&f, g), float_to_value(-6.5 * -9.5));

    Assert_equals(any_divide_assign(&j, i), int_to_value(-13));
    Assert_fequals(any_divide_assign(&i, f), float_to_value(-26.0));
    Assert_fequals(any_divide_assign(&f, j), float_to_value(0.5 / -13.0));
    Assert_fequals(any_divide_assign(&f, g), float_to_value(0.5 / -13.0 / -9.5));
}

void test_minus_any_value() {
    value_t i = int_to_value(-13);
    value_t f = float_to_value(-9.5);
    Assert_equals(minus_any_value(i), int_to_value(13));
    Assert_fequals(minus_any_value(f), float_to_value(9.5));
}

void test_safe_to_int() {
    value_t v = float_to_value(3.0);
    int32_t i = safe_value_to_int(v);
}

void test_safe_to_float() {
    value_t v = int_to_value(3);
    int32_t i = safe_value_to_float(v);
}

void test_safe_to_bool() {
    value_t v = float_to_value(0.0);
    int32_t i = safe_value_to_bool(v);
}

void test_safe_value_to() {
    Assert_true(try_and_catch(test_safe_to_int));
    Assert_true(!try_and_catch(test_safe_to_float));
    Assert_true(!try_and_catch(test_safe_to_bool));

    Assert_true(value_to_truefalse(int_to_value(1)));

    Assert_true(!value_to_truefalse(int_to_value(0)));
    Assert_true(!value_to_truefalse(float_to_value(0.0)));
    Assert_true(!value_to_truefalse(VALUE_FALSE));
    Assert_true(!value_to_truefalse(VALUE_NULL));
    Assert_true(!value_to_truefalse(VALUE_UNDEF));
    Assert_true(!value_to_truefalse(VALUE_ZERO));
    Assert_true(!value_to_truefalse(VALUE_FZERO));
}

static value_t test_array_var;

void test_array2() {
    gc_array_get(test_array_var, -1);
}

void test_array() {
    value_t arr = gc_make_array(NULL, 3, int_to_value(1), int_to_value(2), int_to_value(3));
    Assert_equals(gc_array_length(arr), 3);
    *gc_array_get(arr, 2) = int_to_value(4);
    Assert_equals(*gc_array_get(arr, 2), int_to_value(4));
    test_array_var = arr;
    Assert_true(try_and_catch(test_array2));
}

void test_string_literal() {
    ROOT_SET(root_set, 2)
    value_t str = gc_new_string("foo");
    root_set.values[0] = str;
    value_t i = int_to_value(3);
    value_t a = gc_make_array(NULL, 2, VALUE_FALSE, VALUE_NULL);
    root_set.values[1] = a;
    Assert_true(gc_is_string_literal(str));
    Assert_true(!gc_is_string_literal(i));
    Assert_true(!gc_is_string_literal(a));
    DELETE_ROOT_SET(root_set)
}

static int32_t test_function_object00(int32_t v) {
    return v + 1;
}

void test_function_object() {
    value_t func = gc_new_function(test_function_object00, "(i)i", int_to_value(3));
    Assert_true(gc_is_function_object(func, "(i)i"));
    Assert_true(!gc_is_function_object(func, "(i)b"));
    Assert_true(!gc_is_function_object(int_to_value(3), "(i)b"));
    Assert_equals(((int32_t (*)(int32_t))gc_function_object_ptr(func, 0))(7), 8);
}

void test_is_subtype_of() {
    class_object clazz = { .name = "bar", .array_type_name = NULL };
    value_t obj = ptr_to_value(gc_allocate_object(&clazz));
    const char* sig = "'bar'";
    sig += 1;
    Assert_true(is_subclass_of(obj, &sig));

    const char* sig2 = "'baz'";
    sig = sig2 + 1;
    Assert_true(!is_subclass_of(obj, &sig));
    Assert_true(sig == sig2 + 5);

    class_object clazz2 = { .name = "integer[]", .array_type_name = "[i" };
    value_t obj2 = ptr_to_value(gc_allocate_object(&clazz2));
    sig = "[i";
    Assert_true(is_array_type(obj2, &sig));
    const char* sig3 = "['foo'";
    sig = sig3;
    Assert_true(!is_array_type(obj2, &sig));
    Assert_true(sig == sig3);

    value_t func = gc_new_function(NULL, "(is)a", 0);
    const char* sig4 = "(is)a";
    sig = sig4;
    Assert_true(is_function_type(func, &sig));
    Assert_true(sig == sig4 + 5);

    const char* sig5 = "()i";
    sig = sig5;
    Assert_true(!is_function_type(func, &sig));
    Assert_true(sig == sig5);

    const char* sig55 = "'bar'";
    sig = sig55;
    Assert_true(is_subtype_of(obj, &sig));
    Assert_true(sig == sig55 + 5);
    const char* sig56 = "[i";
    sig = sig56;
    Assert_true(is_subtype_of(obj2, &sig));
    Assert_true(sig == sig56 + 2);

    const char* sig6 = "['bar'";
    sig = sig6;
    Assert_true(!is_subtype_of(obj, &sig));
    Assert_true(sig == sig6 + 6);

    const char* sig7 = "[s";
    sig = sig7;
    Assert_true(!is_subtype_of(obj2, &sig));
    Assert_true(sig == sig7 + 2);

    sig = sig4;
    Assert_true(is_subtype_of(func, &sig));
    Assert_true(sig == sig4 + 5);

    const char* sig8 = "(i)'bar'";
    sig = sig8;
    Assert_true(!is_subtype_of(func, &sig));
    Assert_true(sig == sig8 + 8);

    const char* sig9 = "|n'bar'";
    sig = sig9;
    Assert_true(is_subtype_of(obj, &sig));
    Assert_true(sig == sig9 + 7);

    sig = sig9;
    Assert_true(!is_subtype_of(obj2, &sig));
    Assert_true(sig == sig9 + 7);

    const char* sig10 = "|'bar'n";
    sig = sig10;
    Assert_true(is_subtype_of(obj, &sig));
    Assert_true(sig == sig10 + 7);

    const char* sig11 = "|'bar'[i";
    sig = sig11;
    Assert_true(is_subtype_of(obj, &sig));
    Assert_true(sig == sig11 + 8);

    sig = sig11;
    Assert_true(is_subtype_of(obj2, &sig));
    Assert_true(sig == sig11 + 8);
}

void test_runtime_error2() {
    runtime_error("test_runtime_error2() thorws an error");
}

void test_runtime_error() {
    Assert_true(try_and_catch(test_runtime_error2));
}

int main() {
#ifdef TEST64
    initialize_pointer_table();
#endif
    gc_initialize();
    test_any_add();
    test_any_less();
    test_minus_any_value();
    test_safe_value_to();
    test_array();
    test_string_literal();
    test_function_object();
    test_is_subtype_of();
    test_runtime_error();
    if (nerrors > 0) {
        printf("Test failed %d\n", nerrors);
        return 1;
    }
    else {
        puts("Test succeeded");
        return 0;
    }
}
