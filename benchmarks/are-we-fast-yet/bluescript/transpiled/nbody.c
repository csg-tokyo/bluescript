
#include <stdint.h>
#include "../../microcontroller/core/include/c-runtime.h"

int32_t _ITERATIONS;
float _RESULT;
float _PI;
float _SOLAR_MASS;
float _DAYS_PER_YER;
int32_t _NUM_OF_BODIES;
value_t new_Body(value_t self, float p0, float p1, float p2, float p3, float p4, float p5, float p6);
void mth_0_Body(value_t self, float _px, float _py, float _pz);
extern struct func_body _jupiter;
extern struct func_body _saturn;
extern struct func_body _uranus;
extern struct func_body _neptune;
extern struct func_body _sun;
extern struct func_body _advance;
extern struct func_body _energy;
extern struct func_body _verify_result;
extern struct func_body _createBodies;
extern struct func_body _benchamrk;
extern CLASS_OBJECT(object_class, 1);
extern struct func_body _sqrt;
extern struct func_body _fabs;
extern struct func_body _assert;
void bluescript_main6();
ROOT_SET_DECL(global_rootset6, 0)
static const uint16_t plist_Body[] = { 13, 14, 15, 16, 17, 18, 19 };
CLASS_OBJECT(class_Body, 1) = {
    .body = { .s = 7, .i = 7, .cn = "Body", .sc = &object_class.clazz , .pt = { .size = 7, .offset = 0,
    .unboxed = 7, .prop_names = plist_Body, .unboxed_types = "fffffff" }, .vtbl = { mth_0_Body,  }}};

static void cons_Body(value_t self, float _x, float _y, float _z, float _vx, float _vy, float _vz, float _mass) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    *get_obj_float_property(self, 0) = _x;
    *get_obj_float_property(self, 1) = _y;
    *get_obj_float_property(self, 2) = _z;
    *get_obj_float_property(self, 3) = _vx * _DAYS_PER_YER;
    *get_obj_float_property(self, 4) = _vy * _DAYS_PER_YER;
    *get_obj_float_property(self, 5) = _vz * _DAYS_PER_YER;
    *get_obj_float_property(self, 6) = _mass * _SOLAR_MASS;
  }
  DELETE_ROOT_SET(func_rootset)
}

value_t new_Body(value_t self, float p0, float p1, float p2, float p3, float p4, float p5, float p6) { cons_Body(self, p0, p1, p2, p3, p4, p5, p6); return self; }


void mth_0_Body(value_t self, float _px, float _py, float _pz) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    *get_obj_float_property(self, 3) = 0.0 - (_px / _SOLAR_MASS);
    *get_obj_float_property(self, 4) = 0.0 - (_py / _SOLAR_MASS);
    *get_obj_float_property(self, 5) = 0.0 - (_pz / _SOLAR_MASS);
  }
  DELETE_ROOT_SET(func_rootset)
}

static value_t fbody_jupiter(value_t self) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { value_t ret_value_ = (new_Body(gc_new_object(&class_Body.clazz), 4.84143144246472090e00, -1.16032004402742839e00, -1.03622044471123109e-01, 1.66007664274403694e-03, 7.69901118419740425e-03, -6.90460016972063023e-05, 9.54791938424326609e-04)); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _jupiter = { fbody_jupiter, "()'Body'" };

static value_t fbody_saturn(value_t self) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { value_t ret_value_ = (new_Body(gc_new_object(&class_Body.clazz), 8.34336671824457987e00, 4.12479856412430479e00, -4.03523417114321381e-01, -2.76742510726862411e-03, 4.99852801234917238e-03, 2.30417297573763929e-05, 2.85885980666130812e-04)); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _saturn = { fbody_saturn, "()'Body'" };

static value_t fbody_uranus(value_t self) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { value_t ret_value_ = (new_Body(gc_new_object(&class_Body.clazz), 1.28943695621391310e01, -1.51111514016986312e01, -2.23307578892655734e-01, 2.96460137564761618e-03, 2.37847173959480950e-03, -2.96589568540237556e-05, 4.36624404335156298e-05)); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _uranus = { fbody_uranus, "()'Body'" };

static value_t fbody_neptune(value_t self) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { value_t ret_value_ = (new_Body(gc_new_object(&class_Body.clazz), 1.53796971148509165e01, -2.59193146099879641e01, 1.79258772950371181e-01, 2.68067772490389322e-03, 1.62824170038242295e-03, -9.51592254519715870e-05, 5.15138902046611451e-05)); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _neptune = { fbody_neptune, "()'Body'" };

static value_t fbody_sun(value_t self) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { value_t ret_value_ = (new_Body(gc_new_object(&class_Body.clazz), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0)); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _sun = { fbody_sun, "()'Body'" };

static void fbody_advance(value_t self, value_t _bodies, float _dt) {
  ROOT_SET(func_rootset, 4)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _bodies;
  {
    for (
    int32_t _i = 0;_i < _NUM_OF_BODIES; _i += 1) {
      func_rootset.values[2] = (*gc_array_get(func_rootset.values[0], _i));
      for (
      int32_t _j = _i + 1;_j < _NUM_OF_BODIES; _j += 1) {
        func_rootset.values[3] = (*gc_array_get(func_rootset.values[0], _j));
        float _dx = *get_obj_float_property(func_rootset.values[2], 0) - *get_obj_float_property(func_rootset.values[3], 0);
        float _dy = *get_obj_float_property(func_rootset.values[2], 1) - *get_obj_float_property(func_rootset.values[3], 1);
        float _dz = *get_obj_float_property(func_rootset.values[2], 2) - *get_obj_float_property(func_rootset.values[3], 2);
        float _dSquared = _dx * _dx + _dy * _dy + _dz * _dz;
        float _distance = ((float (*)(value_t, float))_sqrt.fptr)(0, _dSquared);
        float _mag = _dt / (_dSquared * _distance);
        *get_obj_float_property(func_rootset.values[2], 3) = *get_obj_float_property(func_rootset.values[2], 3) - _dx * *get_obj_float_property(func_rootset.values[3], 6) * _mag;
        *get_obj_float_property(func_rootset.values[2], 4) = *get_obj_float_property(func_rootset.values[2], 4) - _dy * *get_obj_float_property(func_rootset.values[3], 6) * _mag;
        *get_obj_float_property(func_rootset.values[2], 5) = *get_obj_float_property(func_rootset.values[2], 5) - _dz * *get_obj_float_property(func_rootset.values[3], 6) * _mag;
        *get_obj_float_property(func_rootset.values[3], 3) = *get_obj_float_property(func_rootset.values[3], 3) + _dx * *get_obj_float_property(func_rootset.values[2], 6) * _mag;
        *get_obj_float_property(func_rootset.values[3], 4) = *get_obj_float_property(func_rootset.values[3], 4) + _dy * *get_obj_float_property(func_rootset.values[2], 6) * _mag;
        *get_obj_float_property(func_rootset.values[3], 5) = *get_obj_float_property(func_rootset.values[3], 5) + _dz * *get_obj_float_property(func_rootset.values[2], 6) * _mag;
      }
    }
    for (
    int32_t _i = 0;_i < _NUM_OF_BODIES; (_i)++) {
      func_rootset.values[2] = (*gc_array_get(func_rootset.values[0], _i));
      *get_obj_float_property(func_rootset.values[2], 0) = *get_obj_float_property(func_rootset.values[2], 0) + _dt * *get_obj_float_property(func_rootset.values[2], 3);
      *get_obj_float_property(func_rootset.values[2], 1) = *get_obj_float_property(func_rootset.values[2], 1) + _dt * *get_obj_float_property(func_rootset.values[2], 4);
      *get_obj_float_property(func_rootset.values[2], 2) = *get_obj_float_property(func_rootset.values[2], 2) + _dt * *get_obj_float_property(func_rootset.values[2], 5);
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _advance = { fbody_advance, "(['Body'f)v" };

static float fbody_energy(value_t self, value_t _bodies) {
  ROOT_SET(func_rootset, 4)
  func_rootset.values[1] = self;
  func_rootset.values[0] = _bodies;
  {
    float _e = 0.0;
    for (
    int32_t _i = 0;_i < _NUM_OF_BODIES; _i += 1) {
      func_rootset.values[2] = (*gc_array_get(func_rootset.values[0], _i));
      _e += 0.5 * *get_obj_float_property(func_rootset.values[2], 6) * (*get_obj_float_property(func_rootset.values[2], 3) * *get_obj_float_property(func_rootset.values[2], 3) + *get_obj_float_property(func_rootset.values[2], 4) * *get_obj_float_property(func_rootset.values[2], 4) + *get_obj_float_property(func_rootset.values[2], 5) * *get_obj_float_property(func_rootset.values[2], 5));
      for (
      int32_t _j = _i + 1;_j < _NUM_OF_BODIES; _j += 1) {
        func_rootset.values[3] = (*gc_array_get(func_rootset.values[0], _j));
        float _dx = *get_obj_float_property(func_rootset.values[2], 0) - *get_obj_float_property(func_rootset.values[3], 0);
        float _dy = *get_obj_float_property(func_rootset.values[2], 1) - *get_obj_float_property(func_rootset.values[3], 1);
        float _dz = *get_obj_float_property(func_rootset.values[2], 2) - *get_obj_float_property(func_rootset.values[3], 2);
        float _distance = ((float (*)(value_t, float))_sqrt.fptr)(0, _dx * _dx + _dy * _dy + _dz * _dz);
        _e -= (*get_obj_float_property(func_rootset.values[2], 6) * *get_obj_float_property(func_rootset.values[3], 6)) / _distance;
      }
    }
    { float ret_value_ = (_e); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _energy = { fbody_energy, "(['Body')f" };

static int32_t fbody_verify_result(value_t self, float _result) {
  ROOT_SET(func_rootset, 1)
  func_rootset.values[0] = self;
  {
    { int32_t ret_value_ = (((float (*)(value_t, float))_fabs.fptr)(0, _RESULT - _result) < 1.0e-4); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _verify_result = { fbody_verify_result, "(f)b" };

static value_t fbody_createBodies(value_t self) {
  ROOT_SET(func_rootset, 7)
  func_rootset.values[0] = self;
  {
    func_rootset.values[1] = gc_make_array(0, 5, func_rootset.values[2]=(((value_t (*)(value_t))_sun.fptr)(0)), func_rootset.values[3]=(((value_t (*)(value_t))_jupiter.fptr)(0)), func_rootset.values[4]=(((value_t (*)(value_t))_saturn.fptr)(0)), func_rootset.values[5]=(((value_t (*)(value_t))_uranus.fptr)(0)), func_rootset.values[6]=(((value_t (*)(value_t))_neptune.fptr)(0)));
    float _px = 0.0;
    float _py = 0.0;
    float _pz = 0.0;
    for (
    int32_t _i = 0;_i < _NUM_OF_BODIES; (_i)++) {
      func_rootset.values[2] = (*gc_array_get(func_rootset.values[1], _i));
      _px += *get_obj_float_property(func_rootset.values[2], 3) * *get_obj_float_property(func_rootset.values[2], 6);
      _py += *get_obj_float_property(func_rootset.values[2], 4) * *get_obj_float_property(func_rootset.values[2], 6);
      _pz += *get_obj_float_property(func_rootset.values[2], 5) * *get_obj_float_property(func_rootset.values[2], 6);
    }
    ;
    (func_rootset.values[2] = (*gc_array_get(func_rootset.values[1], 0)), ((void (*)(value_t, float, float, float))method_lookup(func_rootset.values[2], 0))(func_rootset.values[2], _px, _py, _pz));
    { value_t ret_value_ = (func_rootset.values[1]); DELETE_ROOT_SET(func_rootset); return ret_value_; }
  }
}
struct func_body _createBodies = { fbody_createBodies, "()['Body'" };

static void fbody_benchamrk(value_t self, int32_t _cycle) {
  ROOT_SET(func_rootset, 2)
  func_rootset.values[0] = self;
  {
    for (
    int32_t _i = 0;_i < _cycle; (_i)++) {
      func_rootset.values[1] = ((value_t (*)(value_t))_createBodies.fptr)(0);
      for (
      int32_t _i = 0;_i < _ITERATIONS; (_i)++) {
        ((void (*)(value_t, value_t, float))_advance.fptr)(0, func_rootset.values[1], 0.01);
      }
      ((void (*)(value_t, int32_t))_assert.fptr)(0, ((int32_t (*)(value_t, float))_verify_result.fptr)(0, ((float (*)(value_t, value_t))_energy.fptr)(0, func_rootset.values[1])));
    }
  }
  DELETE_ROOT_SET(func_rootset)
}
struct func_body _benchamrk = { fbody_benchamrk, "(i)v" };

void bluescript_main6() {
  ROOT_SET_INIT(global_rootset6, 0)
  
  _ITERATIONS = 250000;
  _RESULT = -0.16907495402506745;
  _PI = 3.141592653589793;
  _SOLAR_MASS = 4 * _PI * _PI; _SOLAR_MASS = _SOLAR_MASS;
  _DAYS_PER_YER = 365.24; _DAYS_PER_YER = _DAYS_PER_YER;
  _NUM_OF_BODIES = 5;
  ((void (*)(value_t, int32_t))_benchamrk.fptr)(0, 3);
  
}
