type integer = number;
type float = number;

const PI = 3.141592653589793;
const SOLAR_MASS = 4 * PI * PI;
const DAYS_PER_YER = 365.24;
const NUM_OF_BODIES = 5;

// id of each element.
const x = 0;
const y = 1;
const z = 2;
const vx = 3;
const vy = 4;
const vz = 5;
const mass = 6;


const jupiter:float[] = [
  4.84143144246472090e00,
  -1.16032004402742839e00,
  -1.03622044471123109e-01,
  1.66007664274403694e-03 * DAYS_PER_YER,
  7.69901118419740425e-03 * DAYS_PER_YER,
  -6.90460016972063023e-05 * DAYS_PER_YER,
  9.54791938424326609e-04 * SOLAR_MASS
];

const saturn: float[] = [
  8.34336671824457987e00,
  4.12479856412430479e00,
  -4.03523417114321381e-01,
  -2.76742510726862411e-03 * DAYS_PER_YER,
  4.99852801234917238e-03 * DAYS_PER_YER,
  2.30417297573763929e-05 * DAYS_PER_YER,
  2.85885980666130812e-04 * SOLAR_MASS
];

const uranus: float[] = [
  1.28943695621391310e01,
  -1.51111514016986312e01,
  -2.23307578892655734e-01,
  2.96460137564761618e-03 * DAYS_PER_YER,
  2.37847173959480950e-03 * DAYS_PER_YER,
  -2.96589568540237556e-05 * DAYS_PER_YER,
  4.36624404335156298e-05 * SOLAR_MASS
];

const neptune: float[] = [
  1.53796971148509165e01,
  -2.59193146099879641e01,
  1.79258772950371181e-01,
  2.68067772490389322e-03 * DAYS_PER_YER,
  1.62824170038242295e-03 * DAYS_PER_YER,
  -9.51592254519715870e-05 * DAYS_PER_YER,
  5.15138902046611451e-05 * SOLAR_MASS,
];

const sun: float[] = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0 * SOLAR_MASS];

function main() {
  const bodies: float[][] = [sun, jupiter, saturn, uranus, neptune];
  let px: float = 0.0;
  let py: float = 0.0;
  let pz: float = 0.0;

  for (let i = 0; i < NUM_OF_BODIES; i++) {
    px += bodies[i][vx] * bodies[i][mass];
    py += bodies[i][vy] * bodies[i][mass];
    pz += bodies[i][vz] * bodies[i][mass];
  }

  bodies[0][vx] = - (px / SOLAR_MASS);
  bodies[0][vy] = - (py / SOLAR_MASS);
  bodies[0][vz] = - (pz / SOLAR_MASS);
}