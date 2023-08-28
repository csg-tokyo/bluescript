TAG = "storage"
WARMUP = 1
CYCLE = 4

RESULT = 5461


# random
class Random:
    def __init__(self):
        self._seed = 74755

    def next(self):
        self._seed = ((self._seed * 1309) + 13849) & 65535

        return self._seed


count = 0

def build_tree_depth(depth, random):
    global count
    count += 1
    if depth == 1:
        return [None] * (random.next() % 10 + 1)

    arr = [None] * 4
    for i in range(4):
        arr[i] = build_tree_depth(depth - 1, random)
    return arr


def storage():
    global count
    random = Random()
    count = 0
    build_tree_depth(7, random)
    return count


def verify_result(result):
    return result == RESULT


def benchmark_main():
    result = storage()
    assert verify_result(result)



