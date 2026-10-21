const path = require("node:path");

module.exports = {
  mode: "production",
  target: "web",
  entry: path.join(__dirname, "render.ts"),
  output: {
    path: path.resolve(__dirname, "../../dist-tools/svg"),
    filename: "renderer.js",
    library: { name: "parsegraphSvg", type: "var" },
  },
  resolve: { extensions: [".ts", ".js"] },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.join(__dirname, "tsconfig.json"),
            transpileOnly: true,
            compilerOptions: { noEmit: false, declaration: false },
          },
        },
      },
    ],
  },
};
