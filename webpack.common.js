const path = require("path");
const { execSync} = require("child_process");
const { readFileSync } = require("fs");

const DIST_NAME = "layout";

const relDir = (...pathFrags)=>path.resolve(__dirname, ...pathFrags);

const hasFiles = (extension)=>{
  const rv = execSync(`find ${relDir("src")} -type f -name '*.${extension}'`);
  return rv.toString() && rv.toString().length > 0;
}

const hasShaderFiles = ()=>{
  return hasFiles("glsl");
}

const hasCSVFiles = ()=>{
  return hasFiles("csv") || hasFiles("tsv") || hasFiles("txt");
}

const recognizedExternals = {
  "react":{
    commonjs:"react",
    commonjs2:"react",
    amd:"react",
    root:"React"
  },
  "parsegraph-log":{
    commonjs:"parsegraph-log",
    commonjs2:"parsegraph-log",
    amd:"parsegraph-log",
    root:"parsegraph_log"
  },
  "parsegraph-checkglerror":{
    commonjs:"parsegraph-checkglerror",
    commonjs2:"parsegraph-checkglerror",
    amd:"parsegraph-checkglerror",
    root:"parsegraph_checkglerror"
  }
};

const getPackageJSON = ()=>{
    return JSON.parse(readFileSync(relDir("package.json")));
};

const buildExternals = ()=>{
  const rv = {};
  const packageJson = getPackageJSON();
  if (packageJson.peerDependencies) {
    Object.keys(recognizedExternals).forEach(name=>{
      if(name in packageJson.peerDependencies) {
        rv[name] = recognizedExternals[name];
      }
    });
  }
  return rv;
};

const webpackConfig = (prod)=>{
  const rules = [
    {
      test: /\.(js|ts|tsx?)$/,
      exclude: /node_modules/,
      use: ["babel-loader", {
        loader: "ts-loader",
        options: {
          configFile: prod ? "tsconfig.prod.json" : "tsconfig.json",
          compilerOptions: {
            sourceMap: prod
          }
        }
      }]
    },
  ];
  const extensions = [".js", ".ts", ".tsx"];

  if (hasShaderFiles()) {
    rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use: ["ts-shader-loader"],
    });
    extensions.push(".glsl");
  }
  if (hasCSVFiles()) {
    rules.push({
      test: /\.(csv|tsv|txt)$/i,
      use: "raw-loader"
    });
    extensions.push(".tsv");
    extensions.push(".txt");
    extensions.push(".csv");
  }

  return {
    externals: buildExternals(),
    output: {
      path: relDir(prod ? "dist-prod" : "dist", "src"),
      globalObject: "this",
      library: `parsegraph_${DIST_NAME}`,
      libraryTarget: "umd",
    },
    module: {
      rules
    },
    resolve: {
      extensions,
      modules: [relDir("src"), relDir("node_modules")]
    },
    mode: prod ? "production" : "development",
    devtool: prod ? false : "eval-source-map",
  };
};

module.exports = {
  DIST_NAME,
  relDir,
  webpackConfig
};
