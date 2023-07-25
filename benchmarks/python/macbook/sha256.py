from sample_data import DATA

TAG = "sha256"
WARMUP = 1
CYCLE = 3


BLOCK_SIZE = 32 
DATA_LEN = 1024

ANSWER = [126, 44, 189, 35, 138, 120, 99, 233, 229, 125, 114, 83, 92, 183, 16, 28, 206, 116, 2, 105, 14, 202, 214, 249, 14, 253, 51, 17, 97, 176, 202, 215]

class CTX():
    data = [0]*64
    datalen = 0
    bitlen = 0
    state = [0]*8


k = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
]


## macros
ROTRIGHT = lambda x, y: (((x & 0xffffffff) >> (y & 31)) | (x << (32 - (y & 31)))) & 0xffffffff
CH = lambda x, y, z: (z ^ (x & (y ^ z)))
MAJ = lambda x, y, z: (((x | y) & z) | (x & y))
S = lambda x, n: ROTRIGHT(x, n)
R = lambda x, n: (x & 0xffffffff) >> n
EP0 = lambda x: (S(x, 2) ^ S(x, 13) ^ S(x, 22))
EP1 = lambda x: (S(x, 6) ^ S(x, 11) ^ S(x, 25))
SIG0 = lambda x: (S(x, 7) ^ S(x, 18) ^ R(x, 3))
SIG1 = lambda x: (S(x, 17) ^ S(x, 19) ^ R(x, 10))


def transform(ctx, data):
    m = [0]*64

    j = 0
    for i in range(16):
        m[i] = (data[j] << 24) | (data[j + 1] << 16) | (data[j + 2] << 8) | (data[j + 3])
        j += 4
    for i in range(16,64):
        m[i] = SIG1(m[i - 2]) + m[i - 7] + SIG0(m[i - 15]) + m[i - 16]
        
    a = ctx.state[0]
    b = ctx.state[1]
    c = ctx.state[2]
    d = ctx.state[3]
    e = ctx.state[4]
    f = ctx.state[5]
    g = ctx.state[6]
    h = ctx.state[7]

    for i in range(64):
        t1 = h + EP1(e) + CH(e,f,g) + k[i] + m[i]
        t2 = EP0(a) + MAJ(a,b,c)
        h = g
        g = f
        f = e
        e = d + t1
        d = c
        c = b
        b = a
        a = t1 + t2
        
    ctx.state[0] += a
    ctx.state[1] += b
    ctx.state[2] += c
    ctx.state[3] += d
    ctx.state[4] += e
    ctx.state[5] += f
    ctx.state[6] += g
    ctx.state[7] += h


def initialize(ctx):
    ctx.datalen = 0
    ctx.bitlen = 0
    ctx.state[0] = 0x6a09e667
    ctx.state[1] = 0xbb67ae85
    ctx.state[2] = 0x3c6ef372
    ctx.state[3] = 0xa54ff53a
    ctx.state[4] = 0x510e527f
    ctx.state[5] = 0x9b05688c
    ctx.state[6] = 0x1f83d9ab
    ctx.state[7] = 0x5be0cd19
    

def update(ctx, data):
    for i in range(len(data)):
        ctx.data[ctx.datalen] = data[i]
        ctx.datalen += 1
        if ctx.datalen == 64 :
            transform(ctx, ctx.data)
            ctx.bitlen += 512
            ctx.datalen = 0
            

def final(ctx, hash):
        i = ctx.datalen
        #Pad whatever data is left in the buffer.
        if ctx.datalen < 56 :
            ctx.data[i] = 0x80
            i += 1
            while i < 56 :
                ctx.data[i] = 0x00
                i += 1
        else:
            ctx.data[i] = 0x80
            i += 1
            while i < 64 :
                ctx.data[i] = 0x00
                i += 1
            transform(ctx, ctx.data)
            ctx.data[0:56] = 0      

        # Append to the padding the total message's length in bits and transform.
        ctx.bitlen += ctx.datalen * 8
        ctx.data[63] = ctx.bitlen
        ctx.data[62] = ctx.bitlen >> 8
        ctx.data[61] = ctx.bitlen >> 16
        ctx.data[60] = ctx.bitlen >> 24
        ctx.data[59] = ctx.bitlen >> 32
        ctx.data[58] = ctx.bitlen >> 40
        ctx.data[57] = ctx.bitlen >> 48
        ctx.data[56] = ctx.bitlen >> 56
        transform(ctx, ctx.data)


        # Since this implementation uses little endian byte ordering and SHA uses big endian,
        # reverse all the bytes when copying the final state to the output hash.
        for i in range(4) :
            hash[i]      = (ctx.state[0] >> (24 - i * 8)) & 0x000000ff
            hash[i + 4]  = (ctx.state[1] >> (24 - i * 8)) & 0x000000ff
            hash[i + 8]  = (ctx.state[2] >> (24 - i * 8)) & 0x000000ff
            hash[i + 12] = (ctx.state[3] >> (24 - i * 8)) & 0x000000ff
            hash[i + 16] = (ctx.state[4] >> (24 - i * 8)) & 0x000000ff
            hash[i + 20] = (ctx.state[5] >> (24 - i * 8)) & 0x000000ff
            hash[i + 24] = (ctx.state[6] >> (24 - i * 8)) & 0x000000ff
            hash[i + 28] = (ctx.state[7] >> (24 - i * 8)) & 0x000000ff


def benchmark_main():
    ctx_v = CTX()
    rez = [0] * BLOCK_SIZE
    initialize(ctx_v)
    update(ctx_v, DATA[:])
    final(ctx_v, rez)
    for i in range(BLOCK_SIZE):
        assert rez[i] == ANSWER[i]