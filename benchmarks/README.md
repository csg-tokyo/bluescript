# Benchmarks

## Results

### Macbook
Apple M1 Pro, Ventura13.4

| name       |         C |     Python3 | BlueScript |
| ---------- | --------: | ----------: | ---------: |
| sieve      |  0.009 ms |    0.745 ms |  0.0486 ms |
| nbody      | 11.348 ms | 2342.687 ms | 186.126 ms |
| permute    |  0.018 ms |    2.241 ms |   0.173 ms |
| storage    |  0.286 ms |    2.029 ms |   0.234 ms |
| queens     |  0.008 ms |    1.045 ms |   0.087 ms |
| towers     |  0.017 ms |    3.559 ms |   0.360 ms |
| list       |  0.012 ms |    1.523 ms |   0.217 ms |
| bounce     |  0.011 ms |    2.103 ms |   0.173 ms |
| mandelbrot |           | 2563.784 ms |            |
| biquad     |  0.004 ms |    0.442 ms |   0.063 ms |
| fir        |  0.144 ms |   16.618 ms |            |

- nbody: C言語での実装で、doubleでやった際は 12.497msだった。(上の結果はfloat)。doubleでやった場合精度は10^(-10).
- mandelbrot: C言語での結果が合わない。精度の問題だと思うのだが、どうして精度が合わないのかわからない。

### ESP32
M5Stack fire

| name    |            C |   MicroPython |   BlueScript |
| ------- | -----------: | ------------: | -----------: |
| sieve   |     1.082 ms |     92.293 ms |     5.211 ms |
| nbody   | 17300.680 ms | 476237.200 ms | 38885.829 ms |
| permute |     2.126 ms |    342.279 ms |    15.845 ms |
| storage |   143.197 ms |           NaN |              |
| queens  |     1.301 ms |    233.184 ms |    10.047 ms |
| towers  |     3.358 ms |    574.768 ms |              |
| list    |     1.529 ms |    169.552 ms |              |
| bounce  |     1.553 ms |    205.477 ms |    18.485 ms |

- nbody: C言語での実装で、doubleでやった際は 64031.071msだった。(上の結果はfloat)。
- storage, towers: BlueScriptでmemory exhaustedになった。
- storage: MicroPythonでmemory allocation failedになった。
- list: 謎のエラー

## Open Questions
- warmupの回数と平均を取った回数は記録するべき？
- Heapサイズは記録するべき？
- 何回ぐらいの平均を取るのが良い？
- BlueScriptのGCはどのタイミングが良い?
- 結果の精度はどれくらい必要？
- BlueScriptでdoubleは扱えないが、どうする？
- nbodyの数値が合わない。(-0.169とかになって欲しいのに、-0.2084とかになる。)