#!/usr/bin/env python3
"""Bounded, sequential TypeScript/C comparisons; JSONL is the durable record."""
import argparse
import datetime as dt
import hashlib
import json
import math
import os
from pathlib import Path
import platform
import random
import signal
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[2]
SHAPES = ("deep", "balanced", "comb", "groups", "proportion", "memory-piers", "rainbow")
SCHEMA = "parsegraph.bench/1"


def strict_json(text):
    def bad(value):
        raise ValueError(f"Nonfinite JSON number: {value}")
    return json.loads(text, parse_constant=bad)


def near(a, b):
    return (isinstance(a, (float, int)) and isinstance(b, (float, int))
            and math.isfinite(a) and math.isfinite(b)
            and abs(a - b) <= 1e-5 * max(1, abs(a), abs(b)))


def validate_geometry(left, right, count):
    a = {r["stage"]: r["nodes"] for r in left if r["type"] == "geometry"}
    b = {r["stage"]: r["nodes"] for r in right if r["type"] == "geometry"}
    if not a or a.keys() != b.keys():
        raise ValueError("Geometry stages are missing or different")
    for stage in a:
        if len(a[stage]) != count or len(b[stage]) != count:
            raise ValueError(f"Geometry node count differs at {stage}")
        for index, (x, y) in enumerate(zip(a[stage], b[stage])):
            if len(x) != 16 or len(y) != 16:
                raise ValueError("Unexpected geometry vector length")
            for field, (v, w) in enumerate(zip(x, y)):
                equal = v == w if field in (9, 11, 13, 15) else near(v, w)
                if not equal:
                    raise ValueError(f"Geometry differs: stage={stage}, node={index}, field={field}, C={v}, TS={w}")
    return list(a)


def validate_samples(rows, reference=None):
    samples = [r for r in rows if r["type"] == "sample"]
    stages = [r["stage"] for r in samples]
    if not samples or len(set(stages)) != len(stages) or "full_layout/ready" not in stages:
        raise ValueError("Missing/duplicate measurement stages")
    if reference is not None and stages != [r["stage"] for r in reference]:
        raise ValueError("Measurement stages changed after verification")
    for i, r in enumerate(samples):
        if not math.isfinite(r["elapsed_ms"]) or r["elapsed_ms"] < 0 or r["iterations"] < 1:
            raise ValueError("Invalid timing")
        if reference is not None and r["stage"] != "construct":
            if (not near(r["checksum"], reference[i]["checksum"])
                    or r["memory"]["extent_bounds"] != reference[i]["memory"]["extent_bounds"]):
                raise ValueError(f"Trial geometry summary changed: {r['stage']}")
    return samples


def command(args, stdout, stderr, timeout=120, cwd=ROOT):
    # Logs go directly to files: no unbounded pipe accumulation or deadlocks.
    with open(stdout, "w") as out, open(stderr, "w") as err:
        process = subprocess.Popen([str(x) for x in args], cwd=cwd, stdout=out, stderr=err,
                                   start_new_session=True)
        try:
            code = process.wait(timeout=timeout)
        except BaseException:
            os.killpg(process.pid, signal.SIGKILL)
            process.wait()
            raise
    if code:
        tail = Path(stderr).read_text()[-2500:]
        raise RuntimeError(f"Command exited {code}: {args[0]}\n{tail}")


def capture(args):
    return subprocess.check_output(args, cwd=ROOT, text=True, timeout=15).strip()


def source_digest():
    digest = hashlib.sha256()
    for folder in ("src", "native/src", "native/include", "native/bench", "examples/generators", "tools/bench"):
        for file in sorted((ROOT / folder).rglob("*")):
            if file.is_file() and "__pycache__" not in file.parts:
                digest.update(str(file.relative_to(ROOT)).encode() + b"\0" + file.read_bytes() + b"\0")
    digest.update((ROOT / "native/CMakeLists.txt").read_bytes())
    return digest.hexdigest()


class Events:
    def __init__(self, path):
        self.file = open(path, "x")
        self.run_id = str(uuid.uuid4())
        self.sequence = 0

    def write(self, kind, **data):
        row = dict(schema=SCHEMA, run_id=self.run_id, sequence=self.sequence,
                   timestamp=dt.datetime.now(dt.timezone.utc).isoformat(), type=kind, **data)
        self.file.write(json.dumps(row, allow_nan=False, separators=(",", ":")) + "\n")
        self.file.flush()
        self.sequence += 1


def run(args):
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=False)  # Never overwrite a previous experiment.
    logs = out / "logs"
    logs.mkdir()
    events = Events(out / "events.jsonl")
    failed = 0
    started = time.monotonic()
    worker = ROOT / "dist-tools/bench/tools/bench/worker.js"
    fixture_js = worker.with_name("fixtures.js")
    binary = ROOT / "native/build-bench/parsegraph_matched_benchmark"
    try:
        import report  # Matplotlib is loaded only when rendering, not in workers.
        events.write("run_start", platform=platform.platform(), machine=platform.machine(),
                     cpu=platform.processor(), python=platform.python_version(), node=capture(["node", "--version"]),
                     commit=capture(["git", "rev-parse", "HEAD"]),
                     source_sha256=source_digest(), load_average=os.getloadavg(),
                     dirty=bool(capture(["git", "status", "--porcelain", "--untracked-files=normal"])),
                     configuration={"shapes": args.shapes, "budgets": args.nodes, "fits": args.fits,
                                    "repeats": args.repeats, "warmups": args.warmups, "seed": args.seed,
                                    "timeout_seconds": args.timeout, "node_heap_limit_mib": 256},
                     methodology="Fresh process per runtime/case/repeat; warmups reconstruct the same graph. TS GC between warmups and before trial, never inside timers. Sequential execution; runtime order shuffled deterministically. Ready = public layout API + all local/absolute transforms. Parsing, JSON output, memory accounting, verification and destruction excluded from timers. No renderer, fonts, GPU or disk I/O measured.")
        builds = [
            ["node", ROOT / "node_modules/typescript/bin/tsc", "-p", ROOT / "tools/bench/tsconfig.json"],
            ["cmake", "-S", "native", "-B", "native/build-bench", "-DCMAKE_BUILD_TYPE=Release",
             "-DBUILD_TESTING=OFF", "-DPARSEGRAPH_SANITIZE=OFF", "-DPARSEGRAPH_BUILD_EXAMPLES=OFF",
             "-DPARSEGRAPH_BUILD_BENCHMARKS=ON", "-DPARSEGRAPH_BUILD_QT_VIEWER=OFF"],
            ["cmake", "--build", "native/build-bench", "--target", "parsegraph_matched_benchmark", "--parallel", "2"],
        ]
        for i, cmd in enumerate(builds):
            command(cmd, logs / f"build-{i}.stdout", logs / f"build-{i}.stderr", 180)
        cache = (ROOT / "native/build-bench/CMakeCache.txt").read_text()
        flags = (ROOT / "native/build-bench/CMakeFiles/parsegraph.dir/flags.make")
        events.write("build", commands=[[str(v) for v in cmd] for cmd in builds],
                     native_binary_sha256=hashlib.sha256(binary.read_bytes()).hexdigest(),
                     typescript_worker_sha256=hashlib.sha256(worker.read_bytes()).hexdigest(),
                     native_flags=flags.read_text() if flags.exists() else "See CMake cache/build logs",
                     compiler_configuration="\n".join(p.read_text() for p in (ROOT / "native/build-bench/CMakeFiles").glob("*/CMakeCCompiler.cmake")),
                     cmake_cache=cache)

        def execute(runtime, fixture_path, stem, verify=False):
            cmd = ([str(binary)] if runtime == "c" else
                   ["node", "--max-old-space-size=256", "--expose-gc", str(worker)])
            cmd += [str(fixture_path), fit, str(0 if verify else args.warmups), "verify" if verify else "measure"]
            command(cmd, logs / (stem + ".jsonl"), logs / (stem + ".stderr"), args.timeout)
            return [strict_json(line) for line in (logs / (stem + ".jsonl")).read_text().splitlines()]

        rng = random.Random(args.seed)
        for shape in args.shapes:
            for budget in args.nodes:
                directory = out / "fixtures" / f"{shape}-{budget}"
                command(["node", "--max-old-space-size=256", fixture_js, shape, budget, args.seed, directory],
                        logs / "fixture.stdout", logs / "fixture.stderr", args.timeout)
                metadata = strict_json((directory / "fixture.json").read_text())
                events.write("fixture", **metadata, path=str(directory.relative_to(out)))
                for fit in args.fits:
                    case = f"{shape}-{budget}-{fit}"
                    base = dict(case=case, shape=shape, budget=budget, nodes=metadata["nodes"], fit=fit,
                                fixture_sha256=metadata["sha256"])
                    events.write("case_start", **base)
                    try:
                        checks = {r: execute(r, directory / "fixture.txt", f"{case}-{r}-verify", True)
                                  for r in ("c", "typescript")}
                        stages = validate_geometry(checks["c"], checks["typescript"], metadata["nodes"])
                        reference = {r: validate_samples(rows) for r, rows in checks.items()}
                        events.write("parity", **base, status="passed", stages=stages,
                                     comparison="All node absolute/local transforms, body sizes, extent offsets/counts after each mutation; float tolerance 1e-5 relative/absolute, integer counts exact.")
                        for repeat in range(args.repeats):
                            order = ["c", "typescript"]
                            rng.shuffle(order)
                            for runtime in order:
                                stem = f"{case}-{repeat}-{runtime}"
                                rows = execute(runtime, directory / "fixture.txt", stem)
                                for row in validate_samples(rows, reference[runtime]):
                                    row = {k: v for k, v in row.items() if k != "type"}
                                    events.write("sample", **base, runtime=runtime, repeat=repeat,
                                                 raw_log=f"logs/{stem}.jsonl", **row)
                        events.write("case_end", **base, status="passed")
                        print(f"{case}: {metadata['nodes']} nodes, parity and {args.repeats} paired trials passed", flush=True)
                    except (ValueError, RuntimeError, subprocess.TimeoutExpired) as error:
                        failed += 1
                        events.write("case_end", **base, status="failed", error=str(error))
                        print(f"{case}: FAILED: {error}", file=sys.stderr, flush=True)
        events.write("run_end", status="failed" if failed else "passed", failed_cases=failed,
                     elapsed_seconds=time.monotonic() - started)
    except BaseException as error:
        events.write("run_end", status="failed", error=str(error), elapsed_seconds=time.monotonic() - started)
        raise
    finally:
        events.file.close()
    report.render(out / "events.jsonl", out / "report.html")
    return bool(failed)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    r = sub.add_parser("run", help="Build, verify and measure; output directory must not exist")
    r.add_argument("--output", type=Path, required=True)
    r.add_argument("--nodes", nargs="+", type=int, default=[64, 256, 1024], help="Actual node budgets, not demo counts (16..4096)")
    r.add_argument("--shapes", nargs="+", choices=SHAPES, default=list(SHAPES))
    r.add_argument("--fits", nargs="+", choices=("exact", "loose"), default=["exact", "loose"])
    r.add_argument("--repeats", type=int, default=5)
    r.add_argument("--warmups", type=int, default=2)
    r.add_argument("--seed", type=int, default=20261024)
    r.add_argument("--timeout", type=float, default=30)
    p = sub.add_parser("report", help="Regenerate HTML/plots from existing JSONL without rerunning benchmarks")
    p.add_argument("events", type=Path)
    p.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if args.command == "report":
        import report
        report.render(args.events, args.output)
        return 0
    if (any(n < 16 or n > 4096 for n in args.nodes) or not 1 <= args.repeats <= 30
            or not 0 <= args.warmups <= 10 or not 0 < args.timeout <= 300
            or not 0 <= args.seed <= 0xffffffff):
        parser.error("Bounds: nodes 16..4096, repeats 1..30, warmups 0..10, timeout (0,300], seed uint32")
    if len(set(args.nodes)) != len(args.nodes) or len(set(args.shapes)) != len(args.shapes) or len(set(args.fits)) != len(args.fits):
        parser.error("Duplicate nodes/shapes/fits would overwrite trial logs")
    return run(args)


if __name__ == "__main__":
    sys.exit(main())
