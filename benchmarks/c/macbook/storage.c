#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>
#include <string.h>

#define WARMUP 1
#define CYCLE 4
#define TAG "storage"


#define RESULT 5461

// random
int random_seed = 74755;

int random_next() {
    random_seed = ((random_seed * 1309) + 13849) & 65535;
    return random_seed;
}

// finish random

typedef struct tree {
    int num_children;
    struct tree** children;
} tree_t;

void init_tree(tree_t* this, int num_children) {
    assert(this != NULL);
    assert(num_children >= 1);
    this->num_children = num_children;
    this->children = calloc(num_children, sizeof(tree_t*));
}

tree_t* new_tree(int num_children) {
    tree_t* this = malloc(sizeof(tree_t));
    init_tree(this, num_children);
    return this;
}

void delete_tree(tree_t* this) {
    if (this == NULL) { return; }
    for (int i = 0; i < this->num_children; i++) {
        delete_tree(this->children[i]);
    }
    free(this->children);
    free(this);
}

int count = 0;

struct tree* build_tree_depth(int depth) {
    count += 1;
    if (depth == 1) {
        return new_tree(random_next() % 10 + 1);
    }
    tree_t* result = new_tree(4);
    for (int i = 0; i < 4; i++) {
        result->children[i] = build_tree_depth(depth - 1);
    }
    return result;
}

int storage() {
    random_seed = 74755;
    count = 0;
    tree_t* tree = build_tree_depth(7);
    /* tree を１回くらい使って欲しい */
    delete_tree(tree);
    return count;
}

bool verify_result(int result) {
    return result == RESULT;
}

void benchmark_main() {
    int result = storage();
    assert(verify_result(result));
}
