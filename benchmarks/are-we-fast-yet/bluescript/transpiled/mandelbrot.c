
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

int32_t _ITERATIONS;
extern struct func_body _mandelbrot;
extern struct func_body _verifyResult;
extern struct func_body _benchamrk;
extern CLASS_OBJECT(object_class, 1);
extern struct func_body _assert;
void bluescript_main6();
ROOT_SET_DECL(global_rootset6, 0)

static int32_t fbody_mandelbrot(value_t self, int32_t _size) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    int32_t _sum = 0;
    int32_t _byteAcc = 0;
    int32_t _bitNum = 0;
    int32_t _y = 0;
    while (_y < _size) {
      float _ci = ((2.0 * _y) / _size) - 1.0;
      int32_t _x = 0;
      while (_x < _size) {
        float _zrzr = 0.0;
        float _zi = 0.0;
        float _zizi = 0.0;
        float _cr = ((2.0 * _x) / _size) - 1.5;
        int32_t _z = 0;
        int32_t _notDone = VALUE_TRUE;
        int32_t _escape = 0;
        while (_notDone&&_z < 50) {
          float _zr = _zrzr - _zizi + _cr;
          _zi = 2.0 * _zr * _zi + _ci;
          _zrzr = _zr * _zr;
          _zizi = _zi * _zi;
          if (_zrzr + _zizi > 4.0) {
          _notDone = VALUE_FALSE;
          _escape = 1;
          }
          _z += 1;
        }
        _byteAcc = (_byteAcc << 1) + _escape;
        _bitNum += 1;
        if (_bitNum == 8) {
          _sum ^= _byteAcc;
          _byteAcc = 0;
          _bitNum = 0;
        }
        else 
          if (_x == _size - 1) {
          _byteAcc <<= (8 - _bitNum);
          _sum ^= _byteAcc;
          _byteAcc = 0;
          _bitNum = 0;
          }
        _x += 1;
      }
      _y += 1;
    }
    { int32_t ret_value_ = (_sum); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _mandelbrot = { fbody_mandelbrot, "(i)i" };

static int32_t fbody_verifyResult(value_t self, int32_t _result, int32_t _innerIterations) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    if (_innerIterations == 500) {
      { int32_t ret_value_ = (_result == 191); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    if (_innerIterations == 750) {
      { int32_t ret_value_ = (_result == 50); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    if (_innerIterations == 1) {
      { int32_t ret_value_ = (_result == 128); DELETE_ROOT_SET(func_rootset); return ret_value_; }
    }
    { int32_t ret_value_ = (VALUE_FALSE); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _verifyResult = { fbody_verifyResult, "(ii)b" };

static void fbody_benchamrk(value_t self, int32_t _cycle) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    for (
    int32_t _i = 0;_i < _cycle; (_i)++) {
      int32_t _result = ((int32_t (*)(value_t, int32_t))_mandelbrot.fptr)(0, _ITERATIONS);
      ((void (*)(value_t, int32_t))_assert.fptr)(0, ((int32_t (*)(value_t, int32_t, int32_t))_verifyResult.fptr)(0, _result, _ITERATIONS));
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _benchamrk = { fbody_benchamrk, "(i)v" };

void bluescript_main6() {
  ROOT_SET_INIT(global_rootset6, 0)
  
  _ITERATIONS = 500;
  ((void (*)(value_t, int32_t))_benchamrk.fptr)(0, 3);
  
}
