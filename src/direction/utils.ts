const MAX_ITERATIONS = 50000;
const makeLimit = (maxIterations: number = MAX_ITERATIONS) => {
  let i = 0;
  return () => {
    ++i;
    if (i > maxIterations) {
      throw new Error("Endless loop after " + i + " iterations: ");
    }
  };
};

export { makeLimit };
