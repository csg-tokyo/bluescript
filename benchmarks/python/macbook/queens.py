TAG = "queens"
WARMUP = 1
CYCLE = 3


free_maxs = None
free_rows = None
free_mins = None
queen_rows = None


def set_row_column(r, c, v):
    free_rows[r] = v
    free_maxs[c + r] = v
    free_mins[c - r + 7] = v


def get_row_column(r, c):
    return (
            free_rows[r] and free_maxs[c + r] and free_mins[c - r + 7]
        )

def place_queen(c):
    for r in range(8):
        if get_row_column(r, c):
            queen_rows[r] = c
            set_row_column(r, c, False)

            if c == 7:
                return True
            if place_queen(c + 1):
                return True

            set_row_column(r, c, True)
    return False
 
def queens():
    global free_rows
    global free_maxs
    global free_mins
    global queen_rows
    free_rows = [True] * 8
    free_maxs = [True] * 16
    free_mins = [True] * 16
    queen_rows = [-1] * 8

    return place_queen(0)


def verify_result(result):
    result

def benchmark_main():
    result = True
    for _ in range(10):
        result = result and queens()
    return result

