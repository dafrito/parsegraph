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
      respond(files.map((file)=>{
        return file.match(/www\/(\w+)\.html/)[1];
      }));
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
  write(`<title>TODO-PACKAGE-NAME</title>`);
  write(`</head>`);
  write(`<body>`);
  write(`<h1>TODO-PACKAGE-NAME <a href='/coverage'>Coverage</a> <a href='/docs'>Docs</a></h1>`);
  write(`<p>This library is available as JavaScript UMD module: <a href='/TODO-PACKAGE-NAME.js'>TODO-PACKAGE-NAME.js</a></p>`);
  write(`<h2>Samples &amp; Demos</h2>`);
  write(`<ul>`);
  (await getDemos()).forEach((demo)=>{
    write(`<li><a href='/${demo}.html'>${demo}</li>`);
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
  console.log(`See TODO-PACKAGE-NAME build information at http://localhost:${port}`);
});

