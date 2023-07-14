
#include "c-runtime.h"
#include "utils.c"

#define WARMUP 0
#define CYCLE 2
#define TAG "nbody"

int32_t _ITERATIONS;
float _PI;
float _SOLAR_MASS;
float _DAYS_PER_YER;
int32_t _NUM_OF_BODIES;
int32_t _x;
int32_t _y;
int32_t _z;
int32_t _vx;
int32_t _vy;
int32_t _vz;
int32_t _mass;
extern struct _advance {
  void (*fptr)(value_t, float);
  const char* sig; } _advance;
extern struct _energy {
  float (*fptr)(value_t);
  const char* sig; } _energy;
extern struct _nbody_main {
  void (*fptr)();
  const char* sig; } _nbody_main;
void bluescript_main2();
ROOT_SET_DECL(global_rootset2, 5)

static void fbody_advance(value_t _bodies, float _dt) {
  ROOT_SET(func_rootset, 3)
  func_rootset.values[0] = _bodies;
  {
    for (
    int32_t _i = 0;_i < _NUM_OF_BODIES; _i++) {
      func_rootset.values[1] = (*gc_array_get(func_rootset.values[0], _i));
      for (
      int32_t _j = _i + 1;_j < _NUM_OF_BODIES; _j++) {
        func_rootset.values[2] = (*gc_array_get(func_rootset.values[0], _j));
        float _dx = safe_value_to_float(*gc_array_get(func_rootset.values[1], _x)) - safe_value_to_float(*gc_array_get(func_rootset.values[2], _x));
        float _dy = safe_value_to_float(*gc_array_get(func_rootset.values[1], _y)) - safe_value_to_float(*gc_array_get(func_rootset.values[2], _y));
        float _dz = safe_value_to_float(*gc_array_get(func_rootset.values[1], _z)) - safe_value_to_float(*gc_array_get(func_rootset.values[2], _z));
        float _dSquared = _dx * _dx + _dy * _dy + _dz * _dz;
        float _distance = _sqrt.fptr(_dSquared);
        float _mag = _dt / (_dSquared * _distance);
        (*gc_array_get(func_rootset.values[1], _vx)) = float_to_value(safe_value_to_float(*gc_array_get(func_rootset.values[1], _vx)) - (_dx * safe_value_to_float(*gc_array_get(func_rootset.values[2], _mass)) * _mag));
        (*gc_array_get(func_rootset.values[1], _vy)) = float_to_value(safe_value_to_float(*gc_array_get(func_rootset.values[1], _vy)) - (_dy * safe_value_to_float(*gc_array_get(func_rootset.values[2], _mass)) * _mag));
        (*gc_array_get(func_rootset.values[1], _vz)) = float_to_value(safe_value_to_float(*gc_array_get(func_rootset.values[1], _vz)) - (_dz * safe_value_to_float(*gc_array_get(func_rootset.values[2], _mass)) * _mag));
        (*gc_array_get(func_rootset.values[2], _vx)) = float_to_value(safe_value_to_float(*gc_array_get(func_rootset.values[2], _vx)) + (_dx * safe_value_to_float(*gc_array_get(func_rootset.values[1], _mass)) * _mag));
        (*gc_array_get(func_rootset.values[2], _vy)) = float_to_value(safe_value_to_float(*gc_array_get(func_rootset.values[2], _vy)) + (_dy * safe_value_to_float(*gc_array_get(func_rootset.values[1], _mass)) * _mag));
        (*gc_array_get(func_rootset.values[2], _vz)) = float_to_value(safe_value_to_float(*gc_array_get(func_rootset.values[2], _vz)) + (_dz * safe_value_to_float(*gc_array_get(func_rootset.values[1], _mass)) * _mag));
      }
    }
    for (
    int32_t _i = 0;_i < _NUM_OF_BODIES; _i++) {
      func_rootset.values[1] = (*gc_array_get(func_rootset.values[0], _i));
      (*gc_array_get(func_rootset.values[1], _x)) = float_to_value(safe_value_to_float(*gc_array_get(func_rootset.values[1], _x)) + _dt * safe_value_to_float(*gc_array_get(func_rootset.values[1], _vx)));
      (*gc_array_get(func_rootset.values[1], _y)) = float_to_value(safe_value_to_float(*gc_array_get(func_rootset.values[1], _y)) + _dt * safe_value_to_float(*gc_array_get(func_rootset.values[1], _vy)));
      (*gc_array_get(func_rootset.values[1], _z)) = float_to_value(safe_value_to_float(*gc_array_get(func_rootset.values[1], _z)) + _dt * safe_value_to_float(*gc_array_get(func_rootset.values[1], _vz)));
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct _advance _advance = { fbody_advance, "([[ff)v" };

static float fbody_energy(value_t _bodies) {
  ROOT_SET(func_rootset, 3)
  func_rootset.values[0] = _bodies;
  {
    float _e = 0.0;
    for (
    int32_t _i = 0;_i < _NUM_OF_BODIES; _i++) {
      func_rootset.values[1] = (*gc_array_get(func_rootset.values[0], _i));
      _e+=(0.5 * safe_value_to_float(*gc_array_get(func_rootset.values[1], _mass)) * (safe_value_to_float(*gc_array_get(func_rootset.values[1], _vx)) * safe_value_to_float(*gc_array_get(func_rootset.values[1], _vx)) + safe_value_to_float(*gc_array_get(func_rootset.values[1], _vy)) * safe_value_to_float(*gc_array_get(func_rootset.values[1], _vy)) + safe_value_to_float(*gc_array_get(func_rootset.values[1], _vz)) * safe_value_to_float(*gc_array_get(func_rootset.values[1], _vz))));
      for (
      int32_t _j = _i + 1;_j < _NUM_OF_BODIES; _j++) {
        func_rootset.values[2] = (*gc_array_get(func_rootset.values[0], _j));
        float _dx = safe_value_to_float(*gc_array_get(func_rootset.values[1], _x)) - safe_value_to_float(*gc_array_get(func_rootset.values[2], _x));
        float _dy = safe_value_to_float(*gc_array_get(func_rootset.values[1], _y)) - safe_value_to_float(*gc_array_get(func_rootset.values[2], _y));
        float _dz = safe_value_to_float(*gc_array_get(func_rootset.values[1], _z)) - safe_value_to_float(*gc_array_get(func_rootset.values[2], _z));
        float _distance = _sqrt.fptr(_dx * _dx + _dy * _dy + _dz * _dz);
        _e-=(safe_value_to_float(*gc_array_get(func_rootset.values[1], _mass)) * safe_value_to_float(*gc_array_get(func_rootset.values[2], _mass))) / _distance;
      }
    }
    { float ret_value_ = (_e); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct _energy _energy = { fbody_energy, "([[f)f" };

static void fbody_nbody_main() {
  ROOT_SET(func_rootset, 2)
  {
    func_rootset.values[0] = gc_make_array(5, (global_rootset2.values[4]), (global_rootset2.values[0]), (global_rootset2.values[1]), (global_rootset2.values[2]), (global_rootset2.values[3]));
    float _px = 0.0;
    float _py = 0.0;
    float _pz = 0.0;
    for (
    int32_t _i = 0;_i < _NUM_OF_BODIES; _i++) {
      _px+=safe_value_to_float(*gc_array_get((*gc_array_get(func_rootset.values[0], _i)), _vx)) * safe_value_to_float(*gc_array_get((*gc_array_get(func_rootset.values[0], _i)), _mass));
      _py+=safe_value_to_float(*gc_array_get((*gc_array_get(func_rootset.values[0], _i)), _vy)) * safe_value_to_float(*gc_array_get((*gc_array_get(func_rootset.values[0], _i)), _mass));
      _pz+=safe_value_to_float(*gc_array_get((*gc_array_get(func_rootset.values[0], _i)), _vz)) * safe_value_to_float(*gc_array_get((*gc_array_get(func_rootset.values[0], _i)), _mass));
    }
    (*gc_array_get((*gc_array_get(func_rootset.values[0], 0)), _vx)) = float_to_value(-(_px / _SOLAR_MASS));
    (*gc_array_get((*gc_array_get(func_rootset.values[0], 0)), _vy)) = float_to_value(-(_py / _SOLAR_MASS));
    (*gc_array_get((*gc_array_get(func_rootset.values[0], 0)), _vz)) = float_to_value(-(_pz / _SOLAR_MASS));
    for (
    int32_t _i = 0;_i < _ITERATIONS; _i++) {
      _advance.fptr(func_rootset.values[1]=func_rootset.values[0], 0.01);
    }
    float _e = _energy.fptr(func_rootset.values[1]=func_rootset.values[0]);
    _console_log_float.fptr(_e);
  }
  DELETE_ROOT_SET(func_rootset)
}
struct _nbody_main _nbody_main = { fbody_nbody_main, "()v" };

void bluescript_main2() {
  ROOT_SET_INIT(global_rootset2, 5)
  ROOT_SET(func_rootset, 0)
  _ITERATIONS = 250000;
  _PI = 3.141592653589793;
  _SOLAR_MASS = 4 * _PI * _PI;
  _DAYS_PER_YER = 365.24;
  _NUM_OF_BODIES = 5;
  _x = 0;
  _y = 1;
  _z = 2;
  _vx = 3;
  _vy = 4;
  _vz = 5;
  _mass = 6;
  global_rootset2.values[0] = gc_make_array(7, float_to_value(4.84143144246472090e00), float_to_value(-1.16032004402742839e00), float_to_value(-1.03622044471123109e-01), float_to_value(1.66007664274403694e-03 * _DAYS_PER_YER), float_to_value(7.69901118419740425e-03 * _DAYS_PER_YER), float_to_value(-6.90460016972063023e-05 * _DAYS_PER_YER), float_to_value(9.54791938424326609e-04 * _SOLAR_MASS));
  global_rootset2.values[1] = gc_make_array(7, float_to_value(8.34336671824457987e00), float_to_value(4.12479856412430479e00), float_to_value(-4.03523417114321381e-01), float_to_value(-2.76742510726862411e-03 * _DAYS_PER_YER), float_to_value(4.99852801234917238e-03 * _DAYS_PER_YER), float_to_value(2.30417297573763929e-05 * _DAYS_PER_YER), float_to_value(2.85885980666130812e-04 * _SOLAR_MASS));
  global_rootset2.values[2] = gc_make_array(7, float_to_value(1.28943695621391310e01), float_to_value(-1.51111514016986312e01), float_to_value(-2.23307578892655734e-01), float_to_value(2.96460137564761618e-03 * _DAYS_PER_YER), float_to_value(2.37847173959480950e-03 * _DAYS_PER_YER), float_to_value(-2.96589568540237556e-05 * _DAYS_PER_YER), float_to_value(4.36624404335156298e-05 * _SOLAR_MASS));
  global_rootset2.values[3] = gc_make_array(7, float_to_value(1.53796971148509165e01), float_to_value(-2.59193146099879641e01), float_to_value(1.79258772950371181e-01), float_to_value(2.68067772490389322e-03 * _DAYS_PER_YER), float_to_value(1.62824170038242295e-03 * _DAYS_PER_YER), float_to_value(-9.51592254519715870e-05 * _DAYS_PER_YER), float_to_value(5.15138902046611451e-05 * _SOLAR_MASS));
  global_rootset2.values[4] = gc_make_array(7, float_to_value(0.0), float_to_value(0.0), float_to_value(0.0), float_to_value(0.0), float_to_value(0.0), float_to_value(0.0), float_to_value(_SOLAR_MASS));
  _nbody_main.fptr();
  DELETE_ROOT_SET(func_rootset)
}
