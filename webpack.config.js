const {webpackConfig, relDir} = require("./webpack.common");

module.exports = {
  entry: {
    index: relDir("src/index.ts"),
    demo: relDir("src/demo.ts"),
    demo3d: relDir("src/demo3d.ts"),
    primes: relDir("src/primes.ts"),
  },
  ...webpackConfig(false),
};
