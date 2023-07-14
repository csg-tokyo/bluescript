#include <stdint.h>
#include <stdbool.h>
#include <assert.h>
#include <stdio.h>

#define WARMUP 10
#define CYCLE 10
#define TAG "towers"

#define RESULT 8191

typedef struct tower_disk {
    int size;
    struct tower_disk* next;
} tower_disk_t;

tower_disk_t* new_tower_disk(int size) {
    tower_disk_t* this = malloc(sizeof(tower_disk_t));
    this->size = size;
    this->next = NULL;
    return this;
}

void delete_disk(tower_disk_t* this) {
    if (this == NULL)
        return;
    delete_disk(this->next);
    free(this);
}

tower_disk_t* piles[3] = {NULL};
int moves_done = 0;

void push_disk(tower_disk_t *disk, int pile) {
    tower_disk_t* top = piles[pile];
    if (top != NULL && disk->size >= top->size) 
        assert(false);
    
    disk->next = top;
    piles[pile] = disk;
}

tower_disk_t* pop_disk_from(int pile) {
    tower_disk_t* top = piles[pile];
    if (top == NULL) 
        assert(false);
    piles[pile] = top->next;
    top->next = NULL;
    return top;
}

void move_top_disk(int from_pile, int to_pile) {
    push_disk(pop_disk_from(from_pile), to_pile);
    moves_done += 1;
}

void build_tower_at(int pile, int disks) {
    for (int i = disks; i > -1; i--) {
        push_disk(new_tower_disk(i), pile);
    }
}

void move_disks(int disks, int from_pile, int to_pile) {
    if (disks == 1)
        move_top_disk(from_pile, to_pile);
    else {
        int other_pile = (3 - from_pile) - to_pile;
        move_disks(disks - 1, from_pile, other_pile);
        move_top_disk(from_pile, to_pile);
        move_disks(disks - 1, other_pile, to_pile);
    }    
}

int towers() {
    build_tower_at(0, 13);
    move_disks(13, 0, 1);
    return moves_done;
}

bool verify_result(int result) {
    return result == RESULT;
}

void benchmark_main() {
    int result = towers();
    assert(verify_result(result));
    // init global variables.
    for (int i = 0; i < 2; i++) {
        delete_disk(piles[i]);
        piles[i] = NULL;
    }
    moves_done = 0;
}
