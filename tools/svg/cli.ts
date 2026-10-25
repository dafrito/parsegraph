import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import type { SvgOptions } from "./render";

function findBrowser(explicit?: string) {
  if (explicit) return explicit;
  if (process.env.PARSEGRAPH_CHROME) return process.env.PARSEGRAPH_CHROME;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ...(process.env.PATH || "")
      .split(delimiter)
      .flatMap((dir) =>
        [
          "chromium",
          "chromium-browser",
          "google-chrome",
          "google-chrome-stable",
          "chrome.exe",
        ].map((name) => join(dir, name))
      ),
    ...[
      process.env.PROGRAMFILES,
      process.env["PROGRAMFILES(X86)"],
      process.env.LOCALAPPDATA,
    ]
      .filter(Boolean)
      .map((dir) =>
        join(dir as string, "Google/Chrome/Application/chrome.exe")
      ),
  ];
  const browser = candidates.find((path) => existsSync(path));
  if (!browser)
    throw new Error(
      "Chrome/Chromium not found. Set PARSEGRAPH_CHROME or pass --browser PATH."
    );
  return browser;
}

function main(args: string[]) {
  let input: string | undefined;
  let output: string | undefined;
  let browser: string | undefined;
  const options: SvgOptions = {};
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: cli.ts INPUT.parsegraph [--output FILE.svg] [--width N] [--height N] [--padding N] [--browser PATH]\nDefault output: beside input, with .svg extension. Width defaults to 1200; height preserves aspect ratio."
      );
      return;
    }
    if (!arg.startsWith("--")) {
      if (input) throw new Error(`Unexpected argument: ${arg}`);
      input = resolve(arg);
      continue;
    }
    if (
      !["--output", "--browser", "--width", "--height", "--padding"].includes(
        arg
      )
    )
      throw new Error(`Unknown option: ${arg}`);
    const value = args[++i];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`Missing value for ${arg}`);
    if (arg === "--output") output = value;
    else if (arg === "--browser") browser = value;
    else {
      const number = Number(value);
      if (
        !Number.isFinite(number) ||
        (arg === "--padding" ? number < 0 : number <= 0)
      )
        throw new Error(`Invalid ${arg}: ${value}`);
      options[arg.slice(2) as "width" | "height" | "padding"] = number;
    }
  }
  if (!input)
    throw new Error(
      "Provide an input .parsegraph file. Use --help for options."
    );
  const data = JSON.parse(readFileSync(input, "utf8"));
  output = output ?? input.replace(/(?:\.parsegraph)?$/, ".svg");
  if (output !== "-" && resolve(output) === input)
    throw new Error("Output must not overwrite the input graph");
  const bundlePath = resolve(__dirname, "../../dist-tools/svg/renderer.js");
  if (!existsSync(bundlePath)) throw new Error("Run yarn svg:build first.");
  const bundle = readFileSync(bundlePath, "utf8").replace(
    /<\/script/gi,
    "<\\/script"
  );
  const browserPath = findBrowser(browser);
  const directory = mkdtempSync(join(tmpdir(), "parsegraph-svg-"));
  try {
    const htmlPath = join(directory, "render.html");
    const safeJson = (value: unknown) =>
      JSON.stringify(value).replace(/</g, "\\u003c");
    writeFileSync(
      htmlPath,
      `<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'"><pre id="result"></pre><script>${bundle}</script><script>
function report(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  document.getElementById('result').textContent = btoa(binary);
}
parsegraphSvg.renderSvg(${safeJson(data)}, ${safeJson(
        options
      )}).then(report, error => report({error: error.message || String(error)}));
</script>`,
      "utf8"
    );
    const result = spawnSync(
      browserPath,
      [
        "--headless",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-extensions",
        `--user-data-dir=${join(directory, "profile")}`,
        "--dump-dom",
        "--timeout=40000",
        pathToFileURL(htmlPath).href,
      ],
      { encoding: "utf8", timeout: 45000, maxBuffer: 128 * 1024 * 1024 }
    );
    if (result.error) throw result.error;
    if (result.status !== 0)
      throw new Error(
        `Chrome exited ${result.status ?? result.signal}: ${result.stderr.slice(
          -1500
        )}`
      );
    const encoded = result.stdout.match(
      /<pre id="result">([A-Za-z0-9+/=]+)<\/pre>/
    )?.[1];
    if (!encoded)
      throw new Error(
        `Browser did not return an image: ${result.stderr.slice(-1500)}`
      );
    const rendered = JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8")
    );
    if (rendered.error) throw new Error(rendered.error);
    if (typeof rendered.svg !== "string" || !rendered.svg.startsWith("<svg"))
      throw new Error("Invalid SVG result");
    if (output === "-") process.stdout.write(rendered.svg + "\n");
    else {
      const filename = resolve(output);
      mkdirSync(dirname(filename), { recursive: true });
      writeFileSync(filename, rendered.svg + "\n", "utf8");
      console.error(`Wrote ${filename} (${rendered.nodes} nodes).`);
    }
    if (rendered.ignoredCapabilities.length)
      console.error(
        `Ignored capabilities: ${rendered.ignoredCapabilities.join(", ")}`
      );
  } finally {
    rmSync(directory, {
      recursive: true,
      force: true,
      maxRetries: 5,
      retryDelay: 100,
    });
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
