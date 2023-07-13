import time
from sieve import benchmark_main

WARMUP = 100
TIMES = 100


if __name__ == "__main__":
    for _ in range(WARMUP):
        benchmark_main()

    start = time.perf_counter()

    for _ in range(TIMES):
        benchmark_main()

    end = time.perf_counter()
    print(f"warm up: {WARMUP} cycle")
    print(f"{TIMES} average: {(end - start) * 1000 / TIMES} ms")    
    