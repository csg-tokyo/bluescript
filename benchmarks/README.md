## Benchmark programs

The programs under `bluescript` are fully type-annotated, but the programs under `bluescript-without-type` are not
type-annotated.

### `are-we-fast-yet`

This directory contains BlueScript programs ported from [the "Are We Fast Yet?" benchmark suite](https://github.com/smarr/are-we-fast-yet).  

### `prog-lang-comp`

This program contains BlueScript programs ported from 
[the ProgLangComp benchmark suite](https://github.com/ignasp/ProgLangComp_onESP32).
They implement well-known algorithms for signal processing on microcontrollers.

Some programs are missing for `bluescript-without-type` since several bitwise shift operators are available only for the values explicitly annotated as `integer` type.
