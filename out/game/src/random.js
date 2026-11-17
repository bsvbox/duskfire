// A small seeded random number generator (xorshift32): the same seed gives the same
// run, which is what makes the screenshot scenes repeatable. The state is kept in a
// single 32-bit word and scrambled on every draw; the seed must be non-zero.
export function createRandom(seed) {
  let a = (seed | 0) || 0x9e3779b9;
  return function random() {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return (a >>> 0) / 4294967296;
  };
}

/** Pick an integer in [min, max) from a random draw. */
export function pickInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}
