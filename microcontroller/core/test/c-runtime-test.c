// Test code
// To cmpile,
// cc -DTEST64 c-runtime-test.c -lm

#include <string.h>
#include <math.h>
#include "../src/c-runtime.c"

#define Assert_true(v)     assert_true(v, __LINE__)

static void assert_true(bool value, int line) {
    if (!value)
        printf("*** ERROR line %d\n", line);
}

#define Assert_equals(a, b)     assert_equals(a, b, __LINE__)

static void assert_equals(int a, int b, int line) {
    if (a != b)
        printf("*** ERROR line %d: %d, %d\n", line, a, b);
}

#define Assert_fequals(a, b)     assert_fequals(a, b, __LINE__)

static void assert_fequals(float a, float b, int line) {
    if (a != b) {
        printf("*** ERROR line %d: %f (%x), %f (%x)\n",
        line, a, *(uint32_t*)&a, b, *(uint32_t*)&b);
    }
}

#define Assert_fequals2(a, b)     assert_fequals2(a, b, __LINE__)

static void assert_fequals2(float a, float b, int line) {
    if (a < b) {
        float f = b;
        b = a;
        a = f;
    }

    if (a - b > (a > 0 ? a : -a) / 10000.0) {
        printf("*** ERROR line %d: %f (%x), %f (%x)\n",
        line, a, *(uint32_t*)&a, b, *(uint32_t*)&b);
    }
}

#define Assert_pequals(a, b)     assert_pequals(a, b, __LINE__)

static void assert_pequals(const void* a, const void* b, int line) {
    if (a != b)
        printf("*** ERROR line %d: %p, %p\n", line, a, b);
}

#define Assert_str_equals(a, b)     assert_str_equals(a, b, __LINE__)

static void assert_str_equals(const char* a, const char* b, int line) {
    if (strcmp(a, b) != 0)
        printf("*** ERROR line %d: %p, %p\n", line, a, b);
}

#ifdef TEST64

void test_pointer_table() {
    initialize_pointer_table();

    struct { void* ptr; uint32_t ptr32; } table[PTR_TABLE_SIZE];

    for (int i = 0; i < PTR_TABLE_SIZE; i++) {
        void* ptr = malloc(1001);
        uint32_t ptr32 = (uint64_t)record_64bit_pointer(ptr);
        table[i].ptr = ptr;
        table[i].ptr32 = ptr32;
    }

    for (int i = 0; i < PTR_TABLE_SIZE; i++) {
        Assert_pequals(raw_value_to_ptr((value_t)(uint64_t)table[i].ptr32), table[i].ptr);
        free(table[i].ptr);
    }
}

#endif /* TEST64 */

bool is_live_object(value_t obj) {
    value_t address = (value_t)((value_t*)value_to_ptr(obj) - heap_memory);
    value_t current = heap_memory[0];
    while (current < HEAP_SIZE) {
        value_t next = heap_memory[current];
        value_t sz = heap_memory[current + 1];
        if (current <= address && address < current + sz)
            return false;

        current = next;
    }

    return true;
}

static value_t gc_new_array2(int32_t n) {
    return gc_new_array(NULL, n, VALUE_UNDEF);
}

static value_t gc_new_vector2(int32_t n) {
    return gc_new_vector(n, VALUE_UNDEF);
}

// Test functions

void test_converters() {
    value_t v = int_to_value(8);
    Assert_equals(v, 32);
    Assert_equals(value_to_int(v), 8);
    Assert_true(is_int_value(v));
    Assert_true(!is_float_value(v));
    Assert_true(!is_ptr_value(v));

    v = int_to_value(-9);
    Assert_equals(v & 3, 0);
    Assert_equals(value_to_int(v), -9);
    Assert_true(is_int_value(v));
    Assert_true(!is_float_value(v));
    Assert_true(!is_ptr_value(v));

    v = float_to_value(0.1);
    Assert_equals(v & 3, 1);
    // Assert_fequals(value_to_float(v), 0.1);
    Assert_fequals2(value_to_float(v), 0.1);
    Assert_true(!is_int_value(v));
    Assert_true(is_float_value(v));
    Assert_true(!is_ptr_value(v));

    v = float_to_value(-0.2);
    Assert_equals(v & 3, 1);
    // Assert_fequals(value_to_float(v), -0.2);
    Assert_fequals2(value_to_float(v), -0.2);
    Assert_true(!is_int_value(v));
    Assert_true(is_float_value(v));
    Assert_true(!is_ptr_value(v));

    Assert_equals(bool_to_value(true), VALUE_TRUE);
    Assert_equals(bool_to_value(false), VALUE_FALSE);
    Assert_true(value_to_bool(VALUE_TRUE));
    Assert_true(!value_to_bool(VALUE_FALSE));
}

void test_string() {
    char cstr[] = "test";
    value_t v = gc_new_string(cstr);
    Assert_equals(v & 3, 3);
    Assert_pequals(gc_get_class_of(v), &string_literal);
    Assert_equals((uintptr_t)value_to_ptr(v) & 3, 0);
    Assert_true(ptr_to_value(value_to_ptr(v)) == v);
    Assert_str_equals(gc_string_literal_cstr(v), cstr);

    Assert_true(!is_int_value(v));
    Assert_true(!is_float_value(v));
    Assert_true(is_ptr_value(v));
}

static void check_string_length(value_t obj) {
    char buf[128];
    gc_any_to_cstring(buf, obj);
    Assert_equals(gc_string_length(obj), strlen(buf));
}

void test_String() {
    char buf[128];
    value_t s1 = gc_new_string("hello");
    value_t s2 = gc_new_string("world");
    value_t s = gc_new_String(s1, s2);
    Assert_pequals(gc_get_class_of(s1), &string_literal);
    Assert_pequals(gc_get_class_of(s), &class_String);
    Assert_true(gc_is_string_object(s));
    Assert_true(gc_is_string_instance(s));
    Assert_true(!gc_is_string_literal(s));
    Assert_true(!is_int_value(s));
    Assert_true(!is_float_value(s));
    Assert_true(is_ptr_value(s));
    Assert_str_equals(gc_string_instance_cstr(s), "helloworld");

    check_string_length(float_to_value(1.000000));
    check_string_length(float_to_value(1.000002));
    check_string_length(float_to_value(1.0000009));

    check_string_length(int_to_value(123));
    check_string_length(int_to_value(-123));
    check_string_length(int_to_value(0));

    check_string_length(float_to_value(0.0));
    check_string_length(float_to_value(-0.0));
    check_string_length(float_to_value((float)NAN));
    check_string_length(float_to_value(-0.1));
    check_string_length(float_to_value(0.123));
    check_string_length(float_to_value(-0.123));
    check_string_length(float_to_value(456.123));
    check_string_length(float_to_value(-456.123));
    check_string_length(float_to_value(0.123));
    check_string_length(float_to_value(1.2 - 1));

    check_string_length(VALUE_TRUE);
    check_string_length(VALUE_FALSE);
    check_string_length(VALUE_UNDEF);
    check_string_length(VALUE_NULL);

    check_string_length(s1);
    check_string_length(s);

    check_string_length(gc_new_vector(3, VALUE_NULL));
}

static value_t gc_bytearray_set(value_t obj, value_t index, value_t new_value) {
    *gc_bytearray_get(obj, value_to_int(index)) = value_to_int(new_value);
    return new_value;
}

void test_bytearray() {
    value_t arr = gc_new_bytearray(true, 3, 0);
    value_t arr2 = gc_new_bytearray(true, 7, 0);
    for (int i = 0; i < 7; i++) {
        value_t v = int_to_value(257 - i);
        Assert_equals(gc_bytearray_set(arr2, int_to_value(i), v), v);
    }
    for (int i = 0; i < 3; i++)
        gc_bytearray_set(arr, i, int_to_value(i));
    for (int i = 0; i < 7; i++) {
        int32_t e = *gc_bytearray_get(arr2, i);
        Assert_equals(e, 257 - i > 255 ? 1 - i : 257 - i);
    }
    Assert_equals(gc_bytearray_length(arr), 3);
    Assert_equals(gc_bytearray_length(arr2), 7);
}

static value_t gc_vector_setter(value_t obj, value_t index, value_t new_value) {
    return gc_vector_set(obj, value_to_int(index), new_value);
}

void test_vector() {
    value_t arr = gc_new_vector2(4);
    value_t arr2 = gc_new_vector2(4);
    for (int i = 0; i < 4; i++)
        Assert_equals(gc_vector_setter(arr2, int_to_value(i), int_to_value(i)), int_to_value(i));
    for (int i = 0; i < 4; i++)
        gc_vector_setter(arr, i, int_to_value(i));
    for (int i = 0; i < 4; i++) {
        value_t e = gc_vector_get(arr2, int_to_value(i));
        Assert_equals(value_to_int(e), i);
    }
    Assert_equals(value_to_int(gc_array_length(arr)), 4);
    Assert_equals(value_to_int(gc_array_length(arr2)), 4);
}

void test_array() {
    value_t arr = gc_new_array2(4);
    value_t arr2 = gc_new_array2(4);
    for (int i = 0; i < 4; i++)
        Assert_equals(gc_array_set(arr2, i, int_to_value(i)), int_to_value(i));
    for (int i = 0; i < 4; i++)
        gc_array_set(arr, i, int_to_value(i));
    for (int i = 0; i < 4; i++) {
        value_t e = *gc_array_get(arr2, i);
        Assert_equals(value_to_int(e), i);
    }
    Assert_equals(gc_array_length(arr), 4);
    Assert_equals(gc_array_length(arr2), 4);
}

void test_allocate_heap() {
    gc_initialize();
    value_t heap_size = heap_memory[3];
    value_t index = 2;
    value_t vec_size = heap_size / 1024;
    for (int i = 0; i < 1024; i++) {
        value_t arr = gc_new_vector2(vec_size - 2);
        Assert_pequals(value_to_ptr(arr), &heap_memory[index]);
        index += vec_size;
    }
    Assert_equals(heap_memory[0], heap_size + 2);
    gc_run();
    Assert_equals(heap_memory[0], 2);
    Assert_equals(heap_memory[2], heap_size + 2);
    Assert_equals(heap_memory[3], heap_size);
}

void test_root_set() {
    gc_initialize();
    value_t heap_size = heap_memory[2];

    ROOT_SET(root_set, 3);
    root_set.values[0] = gc_new_string("hello");
    value_t obj;
    for (int i = 0; i < 3; i++)
        obj = gc_new_vector2(4);

    gc_run();
    Assert_equals(heap_memory[0], 4);
    Assert_equals(heap_memory[4], heap_size);
    Assert_equals(heap_memory[5], heap_size - 4);
    Assert_true(is_live_object(root_set.values[0]));
    Assert_true(!is_live_object(obj));

    DELETE_ROOT_SET(root_set);
}

void test_root_set2() {
    gc_initialize();
    value_t heap_size = heap_memory[2];

    ROOT_SET(root_set, 3);
    root_set.values[0] = gc_new_string("hello");
    root_set.values[1] = gc_new_string("hello2");
    for (int i = 0; i < 3; i++)
        gc_new_vector2(3);

    root_set.values[0] = VALUE_NULL;
    gc_run();
    Assert_equals(heap_memory[0], 2);
    Assert_equals(heap_memory[2], 6);
    Assert_equals(heap_memory[3], 2);
    Assert_equals(heap_memory[6], heap_size);
    Assert_equals(heap_memory[7], heap_size - 6);

    DELETE_ROOT_SET(root_set);
}

void test_nested_root_set2() {
    ROOT_SET(root_set, 3);
    root_set.values[0] = gc_new_vector2(1);
    DELETE_ROOT_SET(root_set);
}

void test_nested_root_set3() {
    ROOT_SET(root_set, 3);
    root_set.values[0] = gc_new_vector2(1);
    gc_run();
    DELETE_ROOT_SET(root_set);
}

void test_nested_root_set() {
    gc_initialize();
    value_t heap_size = heap_memory[2];

    ROOT_SET(root_set, 3);
    root_set.values[0] = gc_new_string("hello");
    root_set.values[1] = gc_new_string("hello2");
    for (int i = 0; i < 3; i++)
        gc_new_vector2(3);

    test_nested_root_set2();
    root_set.values[0] = VALUE_NULL;
    test_nested_root_set3();

    Assert_equals(heap_memory[0], 2);
    Assert_equals(heap_memory[2], 6);
    Assert_equals(heap_memory[3], 2);
    Assert_equals(heap_memory[6], 32);
    Assert_equals(heap_memory[7], 22);
    Assert_pequals(get_objects_class((pointer_t)&heap_memory[28]), &class_Vector);
    Assert_equals(heap_memory[32], heap_size);
    Assert_equals(heap_memory[33], heap_size - 32);

    gc_run();
    Assert_equals(heap_memory[0], 2);
    Assert_equals(heap_memory[2], 6);
    Assert_equals(heap_memory[3], 2);
    Assert_equals(heap_memory[6], heap_size);
    Assert_equals(heap_memory[7], heap_size - 6);

    DELETE_ROOT_SET(root_set);
}

void test_gc_long_chain() {
    gc_initialize();
    value_t heap_size = heap_memory[2];
    ROOT_SET(root_set, 3);
    value_t obj = gc_new_array2(2);
    root_set.values[0] = obj;
    for (int i = 0; i < STACK_SIZE * 3; ++i) {
        value_t obj2 = gc_new_array2(2);
        root_set.values[1] = obj2;
        value_t obj3 = gc_new_array2(1);
        root_set.values[2] = obj3;
        gc_array_set(obj2, 1, obj);
        gc_array_set(obj2, 0, obj3);
        obj = obj2;
        root_set.values[0] = obj;
        root_set.values[1] = VALUE_NULL;
        root_set.values[2] = VALUE_NULL;
    }
    root_set.values[0] = obj;
    gc_run();

    int n = 0;
    while (obj != VALUE_UNDEF) {
        value_t obj2 = *gc_array_get(obj, 1);
        Assert_true(is_live_object(obj2));
        obj = *gc_array_get(obj, 1);
        Assert_true(is_live_object(obj));
        n++;
    }
    Assert_equals(n, STACK_SIZE * 3 + 1);
    DELETE_ROOT_SET(root_set);
}

void test_gc_liveness() {
    gc_initialize();
    value_t heap_size = heap_memory[2];
    ROOT_SET(root_set, 3);

    value_t obj, obj2, obj3;
    root_set.values[0] = obj = gc_new_array2(4);
    gc_new_array2(1);
    gc_array_set(obj, 0, obj2 = gc_new_bytearray(true, 8, 0));
    gc_bytearray_set(obj2, int_to_value(0), obj);
    gc_new_array2(1);
    gc_new_array2(1);
    gc_array_set(obj, 1, obj3 = gc_new_array2(2));
    gc_array_set(obj3, 0, obj);
    root_set.values[1] = gc_new_string("test");

    gc_run();
    Assert_true(is_live_object(obj));
    Assert_true(is_live_object(obj2));
    Assert_true(is_live_object(obj3));
    Assert_true(is_live_object(root_set.values[1]));
    DELETE_ROOT_SET(root_set);
}

// Stores a given raw unsigned 32bit value into an array.
// Note that index is a raw 32bit integer value and it specifies the position
// by assuming that each array element is 32bit long.
// This function returns a pointer to the array element where the value is stored.
static void gc_bytearray_set_raw_word(value_t obj, int32_t index, uint32_t new_value) {
    pointer_t objp = value_to_ptr(obj);
    objp->body[index + 1] = new_value;
}

void test_gc_liveness2() {
    gc_initialize();
    value_t heap_size = heap_memory[2];
    ROOT_SET(root_set, 3);

    value_t obj, obj2, obj3, obj4;
    root_set.values[0] = obj = gc_new_vector2(4);
    obj4 = gc_new_vector2(1);
    gc_vector_setter(obj, int_to_value(0), obj2 = gc_new_bytearray(true, 8, 0));
    gc_bytearray_set_raw_word(obj2, 0, obj4);
    gc_new_vector2(1);
    gc_new_vector2(1);
    gc_vector_setter(obj, int_to_value(1), obj3 = gc_new_vector2(2));
    gc_vector_setter(obj3, int_to_value(0), obj);
    root_set.values[1] = gc_new_string("test");

    gc_run();
    Assert_true(is_live_object(obj));
    Assert_true(is_live_object(obj2));
    Assert_true(is_live_object(obj3));
    Assert_true(!is_live_object(obj4));
    Assert_true(is_live_object(root_set.values[1]));
    DELETE_ROOT_SET(root_set);
}

void test_gc_sweep() {
    gc_initialize();
    value_t heap_size = heap_memory[2];

    ROOT_SET(root_set, 5);

    value_t obj, obj2;
    gc_new_string("test");
    gc_new_string("test1");
    root_set.values[0] = gc_new_string("test2");
    root_set.values[1] = gc_new_string("test3");
    root_set.values[2] = gc_new_string("test4");
    gc_new_string("test5");
    gc_new_vector2(2);
    gc_new_vector2(3);
    root_set.values[3] = obj = gc_new_vector2(4);
    obj2 = gc_new_vector2(3);
    gc_vector_setter(obj, 0, obj2);

    gc_run();

    Assert_true(is_live_object(root_set.values[0]));
    root_set.values[0] = VALUE_NULL;
    Assert_true(is_live_object(root_set.values[2]));
    root_set.values[2] = VALUE_NULL;

    gc_run();

    Assert_true(is_live_object(root_set.values[1]));
    root_set.values[1] = VALUE_NULL;
    root_set.values[3] = VALUE_NULL;

    gc_run();

    Assert_equals(heap_memory[2], heap_size);
    Assert_equals(heap_memory[0], 2);

    DELETE_ROOT_SET(root_set);

    gc_run();
}

extern uint32_t gc_test_run();

static void write_mark_bit(value_t obj, uint32_t mark) {
    pointer_t ptr = value_to_ptr(obj);
    if (mark)
        ptr->header |= 1;
    else
        ptr->header &= ~1;
}

void test_gc_write_barrier() {
    gc_initialize();
    ROOT_SET(root_set, 5);
    value_t obj, obj1, obj2;

    obj = gc_new_string("test");
    obj1 = gc_new_string("int");

    uint32_t mark = gc_test_run();
    interrupt_handler_start();

    write_mark_bit(obj, mark);
    write_mark_bit(obj1, !mark);
    gc_write_barrier(value_to_ptr(obj), obj1);

    interrupt_handler_end();

    gc_new_string("test1");
    root_set.values[0] = gc_new_string("test2");
    root_set.values[1] = gc_new_string("test3");
    root_set.values[2] = gc_new_string("test4");
    gc_new_string("test5");
    gc_new_vector2(2);
    gc_new_vector2(3);
    root_set.values[3] = obj = gc_new_vector2(4);
    obj2 = gc_new_vector2(3);
    gc_vector_setter(obj, 0, obj2);

    gc_run();
    Assert_true(is_live_object(obj1));
    Assert_true(is_live_object(obj2));

    gc_run();
    Assert_true(!is_live_object(obj1));

    DELETE_ROOT_SET(root_set);
}

void test_main() {
    test_converters();
    test_string();
    test_String();
    test_bytearray();
    test_array();
    test_allocate_heap();
    test_root_set();
    test_root_set2();
    test_nested_root_set();
    test_gc_long_chain();
    test_gc_liveness();
    test_gc_liveness2();
    test_gc_sweep();
    test_gc_write_barrier();
    puts("done");
}

int main() {
#ifdef TEST64
    test_pointer_table();
#endif
  gc_initialize();
  return try_and_catch(test_main);
}
