#! /bin/bash 

set -e

unset -v benchmark

warmup=100
times=100

while getopts b:w:t: OPT
do
  case $OPT in
     b) benchmark=$OPTARG ;;
     w) warmup=$OPTARG;;
     t) times=$OPTARG;;
     *) echo "usage: sh script.sh -b benchmark_name";;
  esac
done

if [ -z "$benchmark" ]; then
        echo 'You should add -b option' >&2
        exit 1
fi

if [ "$benchmark" == "sieve" ]
then
    echo $benchmark
    gcc -DBIT64 -O2 -DBENCHMARK=0 main.c c-runtime.c
    ./a.out $warmup $times
else
    echo "Unknown benchmark."
fi
