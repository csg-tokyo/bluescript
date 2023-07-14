TAG = "permute"
WARMUP = 100
CYCLE = 100

RESULT = 8660

count = 0
v = None


def swap(v, i, j):
    tmp = v[i]
    v[i] = v[j]
    v[j] = tmp    


def permute(n):
    global count
    count += 1
    if n != 0:
        n1 = n - 1
        permute(n1)
        for i in range(n1, -1, -1):
            swap(v, n1, i)
            permute(n1)
            swap(v, n1, i)


def verify_result(result):
    return result == RESULT


def benchmark_main():
    global count
    global v
    count = 0
    v = [0] * 6
    permute(6)
    assert verify_result(count)
