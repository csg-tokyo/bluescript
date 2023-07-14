import time
import sys

if __name__ == "__main__":
    if sys.argv[1] == "0":
        from sieve import benchmark_main, TAG, WARMUP, CYCLE
        b_main = benchmark_main
        warmup = WARMUP
        cycle = CYCLE
    elif sys.argv[1] == "1":
        from nbody import benchmark_main, TAG, WARMUP, CYCLE
        b_main = benchmark_main
        warmup = WARMUP
        cycle = CYCLE
    elif sys.argv[1] == "2":
        from permute import benchmark_main, TAG, WARMUP, CYCLE
        b_main = benchmark_main
        warmup = WARMUP
        cycle = CYCLE      
    elif sys.argv[1] == "3":
        from storage import benchmark_main, TAG, WARMUP, CYCLE
        b_main = benchmark_main
        warmup = WARMUP
        cycle = CYCLE
    elif sys.argv[1] == "4":
        from queens import benchmark_main, TAG, WARMUP, CYCLE
        b_main = benchmark_main
        warmup = WARMUP
        cycle = CYCLE   
    elif sys.argv[1] == "5":
        from towers import benchmark_main, TAG, WARMUP, CYCLE
        b_main = benchmark_main
        warmup = WARMUP
        cycle = CYCLE  
    elif sys.argv[1] == "6":
        from list_ import benchmark_main, TAG, WARMUP, CYCLE
        b_main = benchmark_main
        warmup = WARMUP
        cycle = CYCLE            
    elif sys.argv[1] == "7":
        from bounce import benchmark_main, TAG, WARMUP, CYCLE
        b_main = benchmark_main
        warmup = WARMUP
        cycle = CYCLE    
    elif sys.argv[1] == "8":
        from mandelbrot import benchmark_main, TAG, WARMUP, CYCLE
        b_main = benchmark_main
        warmup = WARMUP
        cycle = CYCLE       
    elif sys.argv[1] == "9":
        from biquad import benchmark_main, TAG, WARMUP, CYCLE
        b_main = benchmark_main
        warmup = WARMUP
        cycle = CYCLE        
    elif sys.argv[1] == "10":
        from fir import benchmark_main, TAG, WARMUP, CYCLE
        b_main = benchmark_main
        warmup = WARMUP
        cycle = CYCLE                
         
            
    else:
        b_main = lambda: print("No benchmark")
        TAG = "no benchmark"
        warmup = 0
        cycle = 1

    warmup = int(sys.argv[2]) if len(sys.argv) >= 3 else warmup
    cycle = int(sys.argv[3]) if len(sys.argv) >= 4 else cycle   


    for _ in range(warmup):
        b_main()

    start = time.perf_counter()

    for _ in range(cycle):
        b_main()

    end = time.perf_counter()
    print(TAG)
    print(f"warm up: {warmup} cycle")
    print(f"{cycle} cycle average: {(end - start) * 1000 / cycle} ms")    
    