TAG = "towers"
WARMUP = 10
CYCLE = 10

RESULT = 8191


class TowersDisk:
    def __init__(self, size) -> None:
        self.size = size
        self.next = None


piles = None
moves_done = 0


def push_disk(disk, pile):
    top = piles[pile]

    if top is not None and disk.size >= top.size:
        raise Exception("Cannot push a big disk size on a smaller one")
    
    disk.next = top
    piles[pile] = disk


def pop_disk_from(pile):
    top = piles[pile]
    if top is None:
        raise Exception("Attempting to remove a disk from an empty pile")

    piles[pile] = top.next
    top.next = None
    return top

def move_top_disk(from_pile, to_pile):
    global moves_done
    push_disk(pop_disk_from(from_pile), to_pile)
    moves_done += 1

def build_tower_at(pile, disks):
    for i in range(disks, -1, -1):
        push_disk(TowersDisk(i), pile)

def move_disks(disks, from_pile, to_pile):
    if disks == 1:
        move_top_disk(from_pile, to_pile)
    else:
        other_pile = (3 - from_pile) - to_pile
        move_disks(disks - 1, from_pile, other_pile)
        move_top_disk(from_pile, to_pile)
        move_disks(disks - 1, other_pile, to_pile)

def towers():
    global piles
    global moves_done
    piles = [None, None, None]
    build_tower_at(0, 13)
    moves_done = 0
    move_disks(13, 0, 1)
    return moves_done


def verify_result(result):
    return result == RESULT


def benchmark_main():
    result = towers()
    assert verify_result(result)