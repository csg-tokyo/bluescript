#! /bin/bash

set -e

unset -v benchmark

while getopts b:w:c: OPT
do
  case $OPT in
     b) benchmark=$OPTARG ;;
     w) warmup=$OPTARG;;
     c) cycle=$OPTARG;;
     *) echo "usage: sh script.sh -b benchmark_name";;
  esac
done

if [ -z "$benchmark" ]; then
        echo 'You should add -b option' >&2
        exit 1
fi

case "$benchmark" in
  "sieve"     ) benchmark_num=0 ;;
  "nbody"     ) benchmark_num=1 ;;
  "permute"   ) benchmark_num=2 ;;
  "storage"   ) benchmark_num=3 ;;
  "queens"    ) benchmark_num=4 ;;
  "towers"    ) benchmark_num=5 ;;
  "list"      ) benchmark_num=6 ;;
  "bounce"    ) benchmark_num=7 ;;
  "mandelbrot") benchmark_num=8 ;;
  "biquad"    ) benchmark_num=9 ;;
  "fir"       ) benchmark_num=10 ;;
  "crc"       ) benchmark_num=11 ;;
  "fft"       ) benchmark_num=12 ;;
  "sha256"    ) benchmark_num=13 ;;
esac

if [ -n "$benchmark_num" ]
then
    python3 main.py ${benchmark_num} ${warmup} ${cycle}
else
    echo "Unknown benchmark."
fi