TAG = "sieve"
WARMUP = 100
CYCLE = 100


SIZE = 5000
RESULT = 669


def sieve(flags, size):
    prime_count = 0

    for i in range(2, size + 1):
        if flags[i - 1]:
            prime_count += 1
            k = i * 2
            while k <= size:
                flags[k - 1] = False
                k += i

    return prime_count

def verify_result(result):
    return result == RESULT

def benchmark_main():
    flags = [True] * SIZE
    result = sieve(flags, SIZE)
    assert verify_result(result)
