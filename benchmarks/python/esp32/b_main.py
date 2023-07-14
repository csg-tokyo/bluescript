# from sieve import benchmark_main, WARMUP, CYCLE, TAG
# from nbody import benchmark_main, WARMUP, CYCLE, TAG
#from permute import benchmark_main, WARMUP, CYCLE, TAG
# from storage import benchmark_main, WARMUP, CYCLE, TAG
# from queens import benchmark_main, WARMUP, CYCLE, TAG
# from towers import benchmark_main, WARMUP, CYCLE, TAG
# from list_ import benchmark_main, WARMUP, CYCLE, TAG
from bounce import benchmark_main, WARMUP, CYCLE, TAG

import utime


def run():
    for _ in range(WARMUP):
        benchmark_main()

    start = utime.ticks_us()

    for _ in range(CYCLE):
        benchmark_main()

    end = utime.ticks_us()
    print(TAG)
    print(f"warm up: {WARMUP} cycle")
    print(f"{CYCLE} cycle average: {(utime.ticks_diff(end, start)) / 1000 / CYCLE} ms")    
    

if __name__ == "__main__":
    run()