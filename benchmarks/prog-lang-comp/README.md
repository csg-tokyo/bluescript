## Benchmark programs

This program contains BlueScript programs derived from 
[the ProgLangComp benchmark suite](https://github.com/ignasp/ProgLangComp_onESP32).
They implement well-known algorithms for signal processing on microcontrollers.

The programs under `bluescript` are fully type-annotated, but the programs under `bluescript-without-type` are not
type-annotated.

Some programs are missing for `bluescript-without-type` since several bitwise shift operators are available only for the values explicitly annotated as `integer` type.
