TAG = "mandelbrot"
WARMUP = 0
CYCLE = 1


ITERATIONS = 751
RESULT = 50

def mandelbrot(size):
    _sum = 0
    byte_acc = 0
    bit_num = 0

    y = 0

    while y < size:
        ci = (2.0 * y / size) - 1.0
        x = 0

        while x < size:
            zrzr = 0.0
            zi = 0.0
            zizi = 0.0
            cr = (2.0 * x / size) - 1.5

            z = 0
            not_done = True
            escape = 0
            while not_done and z < 50:
                zr = zrzr - zizi + cr
                zi = 2.0 * zr * zi + ci

                zrzr = zr * zr
                zizi = zi * zi

                if zrzr + zizi > 4.0:
                    not_done = False
                    escape = 1
                z += 1

            byte_acc = (byte_acc << 1) + escape
            bit_num = bit_num + 1

            if bit_num == 8:
                _sum ^= byte_acc
                byte_acc = 0
                bit_num = 0
            elif x == size - 1:
                byte_acc <<= 8 - bit_num
                _sum ^= byte_acc
                byte_acc = 0
                bit_num = 0
            x += 1
        print(f"sum: {_sum}")    
        y += 1
    return _sum

def verify_result(result):
    return result == RESULT


def benchmark_main():
    result = mandelbrot(ITERATIONS)
    print(result)
    assert verify_result(result)