/** Deterministic lcg32/1 stream; seed is an unsigned 32-bit integer. */
export function createSeededRandom(seed: number): () => number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error("Seed must be an integer between 0 and 4294967295.");
  }
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}
