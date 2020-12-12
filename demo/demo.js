const glob = require("glob")

const express = require("express");
const app = express();
const port = 3000;

async function getDemos() {
  return new Promise((respond, reject)=>{
    glob("www/*.html", {}, function (err, files) {
      if (err) {
        reject(err);
      }
      // files is an array of filenames.
      respond(files);
    });
  });
}

app.get('/', async (req, res) => {
  resp = "";
  const write = (text)=>{
    resp += text + "\n";
  };

  write(`<!DOCTYPE html>`);
  write(`<html>`);
  write(`<head>`);
  write(`<title>parsegraph</title>`);
  write(`</head>`);
  write(`<body>`);
  write(`<h1><a href='/TODO-PACKAGE-NAME.js'>TODO-PACKAGE-NAME</a></h1>`);
  write(`<h2><a href='/coverage'>Test coverage results</a><h2>`);
  write(`<h2><a href='/docs'>Documentation</a><h2>`);
  write(`<ul>`);
  (await getDemos()).forEach((demo)=>{
    write(`<li><a href='/${demo}'>${demo}.html</li>`);
  });
  write(`</ul>`);
  write(`</body>`);
  write(`</html>`);

  res.end(resp);
})

app.use(express.static("./src"));
app.use(express.static("./dist"));
app.use(express.static("./www"));

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

