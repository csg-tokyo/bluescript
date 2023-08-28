#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>

#define WARMUP 1
#define CYCLE 3
#define TAG "list"

#define RESULT 10

typedef struct element {
    int val;
    struct element* next;
} element_t;

int list_length(element_t *e) {
    if (e->next == NULL) {
        return 1;
    }
    return 1 + list_length(e->next);
}

bool is_shorter_than(element_t* x, element_t* y) {
    element_t* x_tail = x;
    element_t* y_tail = y;

    while (y_tail != NULL) {
        if (x_tail == NULL) {
            return true;
        }
        x_tail = x_tail->next;
        y_tail = y_tail->next;
    }
    return false;
}

element_t* tail(element_t* x, element_t* y, element_t* z) {
    if (is_shorter_than(y, x)) {
        return tail(
            tail(x->next, y, z),
            tail(y->next, z, x),
            tail(z->next, x, y)
        );
    }
    return z;
}

element_t* make_list(int length) {
    if (length == 0) {
        return NULL;
    }
    element_t* e = malloc(sizeof(element_t));
    e->val = length;
    e->next = make_list(length - 1);
    return e;
}

void delete_list(element_t* this) {
    if (this == NULL)
        return;
    delete_list(this->next);
    free(this);
}

element_t* list() {
    element_t* l = tail(make_list(15), make_list(10), make_list(6));
    return l;
}

bool verify_result(int result) {
    return result == RESULT;
}

void benchmark_main() {
    element_t* l = list();
    int result = list_length(l);
    assert(verify_result(result));
    delete_list(l);
}
