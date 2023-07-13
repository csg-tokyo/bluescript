from sieve import benchmark_main
import utime

WARMUP = 1
TIMES = 3


def run():
    for _ in range(WARMUP):
        benchmark_main()

    start = utime.ticks_us()

    for _ in range(TIMES):
        benchmark_main()

    end = utime.ticks_us()
    print(f"warm up: {WARMUP} cycle")
    print(f"{TIMES} average: {(utime.ticks_diff(end, start)) / 1000 / TIMES} ms")    
    