from sample_data import DATA
from array import array

TAG = "crc"
WARMUP = 1
CYCLE = 3

ANSWER = 1837082096

def make_table(poly):
    table = []
    for byte in range(256):
        crc = 0
        for _ in range(8):
            if (byte ^ crc) & 1:
                crc = (crc >> 1) ^ poly
            else:
                crc >>= 1
            byte >>= 1
        table.append(crc)        
    return table


def calc(bytes, table):
    value = 0xffffffff
    for ch in bytes:
        value = table[(ch ^ value) & 0xff] ^ (value >> 8)
    return (-1 - value) & 0xffffffff



def benchmark_main():
    table = make_table(0xedb88320)
    result = calc(DATA, table)
    assert result == ANSWER