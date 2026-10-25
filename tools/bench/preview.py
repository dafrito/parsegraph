"""Representative drawings from public paint helpers, checked against saved geometry."""
import hashlib
import html
import json
import math
from pathlib import Path
import re

DESCRIPTIONS = {
    "deep": "A single long chain. A leaf edit travels back through every ancestor.",
    "balanced": "A branching tree. Leaf edits can skip clean sibling subtrees.",
    "comb": "A spine with decreasing-height teeth. Exact fit retains a detailed staircase envelope.",
    "groups": "A large subtree inside nested paint groups, with a sibling outside them.",
    "proportion": "Side branches of changing depth, taken from the proportion generator.",
    "memory-piers": "Seeded branching piers, taken from the Memory Piers generator.",
    "rainbow": "Repeated rows and layers from the rainbow generator. Colors here identify paint groups, not the gallery's rainbow styling.",
}
PALETTE = ("#b8dbd4", "#b9cde9", "#e7cf9c", "#cebde3", "#e7bfb2", "#c5d5a6")


def validate_bodies(drawing, count):
    bodies = [r for r in drawing["rectangles"] if r["kind"] == "body"]
    if len(bodies) != count or {r["node"] for r in bodies} != set(range(count)):
        raise ValueError("Drawing must contain one body per node")
    for body in bodies:
        n = drawing["geometry"][body["node"]]
        expected = (n[0], n[1], n[6] * n[2], n[7] * n[2])
        if not all(math.isclose(body[key], value, rel_tol=1e-8, abs_tol=1e-8)
                   for key, value in zip(("x", "y", "width", "height"), expected)):
            raise ValueError("Painted body does not match recorded world geometry")


def bounds(rectangles):
    if not rectangles:
        raise ValueError("Empty drawing")
    for r in rectangles:
        if (any(not math.isfinite(r[k]) for k in ("x", "y", "width", "height"))
                or r["width"] < 0 or r["height"] < 0):
            raise ValueError("Invalid rectangle geometry")
    left = min(r["x"] - r["width"] / 2 for r in rectangles)
    top = min(r["y"] - r["height"] / 2 for r in rectangles)
    right = max(r["x"] + r["width"] / 2 for r in rectangles)
    bottom = max(r["y"] + r["height"] / 2 for r in rectangles)
    return left, top, right, bottom


def svg(rectangles, viewport, title):
    bounds(rectangles)  # Reject invalid/nonfinite geometry before producing XML.
    left, top, right, bottom = viewport
    pad = 12
    width, height = right - left + 2 * pad, bottom - top + 2 * pad
    groups = {group: i for i, group in enumerate(sorted({r["group"] for r in rectangles}))}
    elements = []
    # Connectors beneath bodies; all dimensions/positions are actual paint output.
    for r in sorted(rectangles, key=lambda r: r["kind"] == "body"):
        if r["kind"] not in ("body", "line"):
            raise ValueError("Unknown drawing primitive")
        fill = "#657781" if r["kind"] == "line" else PALETTE[groups[r["group"]] % len(PALETTE)]
        stroke = "none" if r["kind"] == "line" else "#365b60"
        if r["kind"] == "body" and r["node"] == 0:
            fill, stroke = "#137a70", "#073f39"
        elif r["kind"] == "body" and r["node"] == r["group"]:
            stroke = "#b96513"
        tooltip = f"Node {r['node']} · paint group {r['group']} · {r['width']:g} × {r['height']:g}"
        elements.append(f'<rect data-kind="{r["kind"]}" data-node="{r["node"]}" '
                        f'x="{r["x"]-r["width"]/2:.9g}" y="{r["y"]-r["height"]/2:.9g}" '
                        f'width="{r["width"]:.9g}" height="{r["height"]:.9g}" '
                        f'fill="{fill}" stroke="{stroke}" stroke-width="0.7">'
                        f'<title>{html.escape(tooltip)}</title></rect>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" role="img" '
            f'viewBox="{left-pad:.9g} {top-pad:.9g} {width:.9g} {height:.9g}" '
            f'width="{width:.9g}" height="{height:.9g}"><title>{html.escape(title)}</title>'
            f'<rect x="{left-pad:.9g}" y="{top-pad:.9g}" width="{width:.9g}" height="{height:.9g}" fill="#faf9f6"/>'
            + "".join(elements) + "</svg>\n")


def generate(events_path):
    # Import lazily: report regeneration remains Python-only/offline.
    import bench
    import report
    rows = report.load_events(events_path)
    root = Path(events_path).resolve().parent
    accepted = report.summarize(rows)
    fixture_rows = {(r["shape"], r["budget"]): r for r in rows if r["type"] == "fixture"}
    directory = root / "illustrations"
    directory.mkdir(exist_ok=True)
    bench.command(["node", bench.ROOT / "node_modules/typescript/bin/tsc", "-p", "tools/bench/tsconfig.json"],
                  directory / "build.stdout", directory / "build.stderr", 180)
    entries = []
    for shape in sorted({r["shape"] for r in accepted}):
        if not re.fullmatch(r"[a-z-]+", shape):
            raise ValueError("Invalid shape identifier")
        budget = min(r["budget"] for r in accepted if r["shape"] == shape)
        cases = {r["fit"]: r for r in accepted if r["shape"] == shape and r["budget"] == budget}
        meta = fixture_rows[(shape, budget)]
        fixture = root / meta["path"] / "fixture.txt"
        if not fixture.resolve().is_relative_to(root):
            raise ValueError("Fixture escaped the run directory")
        if hashlib.sha256(fixture.read_bytes()).hexdigest() != meta["sha256"]:
            raise ValueError(f"Fixture hash differs: {shape}")
        drawings = {}
        for fit, case in sorted(cases.items()):
            if fit not in ("exact", "loose") or not re.fullmatch(r"[a-z0-9-]+", case["case"]):
                raise ValueError("Invalid case identifier")
            path = directory / f"{case['case']}.json"
            bench.command(["node", "--max-old-space-size=256", "--expose-gc",
                           bench.ROOT / "dist-tools/bench/tools/bench/worker.js", fixture, fit, "0", "drawing"],
                          path, path.with_suffix(".stderr"), 30)
            drawing = bench.strict_json(path.read_text())
            saved = [bench.strict_json(line) for line in
                     (root / "logs" / f"{case['case']}-c-verify.jsonl").read_text().splitlines()]
            expected = [r for r in saved if r["type"] == "geometry" and r["stage"] == "full_layout"]
            bench.validate_geometry(expected, [{"type": "geometry", "stage": "full_layout", "nodes": drawing["geometry"]}], case["nodes"])
            validate_bodies(drawing, case["nodes"])
            drawings[fit] = drawing
        # Keep a same-scale alternative, but fit thumbnails individually so an
        # extremely expanded loose graph doesn't make the exact one illegible.
        viewport = bounds([r for d in drawings.values() for r in d["rectangles"]])
        for fit, drawing in drawings.items():
            case = cases[fit]
            name = f"{case['case']}.svg"
            own_bounds = bounds(drawing["rectangles"])
            title = f"{shape} · {fit} · {case['nodes']} nodes"
            text = svg(drawing["rectangles"], own_bounds, title)
            (directory / name).write_text(text)
            entries.append(dict(shape=shape, fit=fit, nodes=case["nodes"], budget=budget,
                                case=case["case"], groups=meta["groups"], path=name,
                                width=own_bounds[2]-own_bounds[0], height=own_bounds[3]-own_bounds[1],
                                shared_svg=svg(drawing["rectangles"], viewport, title),
                                fixture_sha256=meta["sha256"], svg_sha256=hashlib.sha256(text.encode()).hexdigest()))
    manifest = dict(schema="parsegraph.bench.illustrations/1", run_id=rows[0]["run_id"],
                    events_sha256=hashlib.sha256(Path(events_path).read_bytes()).hexdigest(), entries=entries)
    (directory / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"Generated {len(entries)} representative SVGs in {directory}")


def gallery(events_path, rows, output):
    import base64
    root = Path(events_path).resolve().parent / "illustrations"
    manifest_file = root / "manifest.json"
    if not manifest_file.exists():
        return ""
    manifest = json.loads(manifest_file.read_text())
    if (manifest.get("schema") != "parsegraph.bench.illustrations/1"
            or manifest.get("run_id") != rows[0]["run_id"]
            or manifest.get("events_sha256") != hashlib.sha256(Path(events_path).read_bytes()).hexdigest()):
        raise ValueError("Illustrations do not match this benchmark run")
    target = Path(output).parent / (Path(output).stem + "-graphs")
    target.mkdir(exist_ok=True)
    cards = []
    for shape in sorted({e["shape"] for e in manifest["entries"]}):
        items = []
        entries = [e for e in manifest["entries"] if e["shape"] == shape]
        for entry in entries:
            path = root / entry["path"]
            if path.name != entry["path"] or not path.resolve().is_relative_to(root):
                raise ValueError("Invalid SVG path")
            data = path.read_bytes()
            if hashlib.sha256(data).hexdigest() != entry["svg_sha256"]:
                raise ValueError("Illustration checksum differs")
            (target / path.name).write_bytes(data)
            caption = f"{entry['fit'].title()} fit · {entry['nodes']} nodes"
            fitted = f"data:image/svg+xml;base64,{base64.b64encode(data).decode()}"
            shared = f"data:image/svg+xml;base64,{base64.b64encode(entry['shared_svg'].encode()).decode()}"
            items.append(f'<figure><figcaption>{html.escape(caption)}</figcaption>'
                         f'<small>{entry["width"]:g} × {entry["height"]:g} layout units</small>'
                         f'<a href="{html.escape(target.name + "/" + path.name, quote=True)}" target="_blank">'
                         f'<img class="graph-preview" alt="{html.escape(shape + " " + caption, quote=True)}" '
                         f'data-fitted="{fitted}" data-shared="{shared}" src="{fitted}"/></a>'
                         '<small>Open full SVG ↗</small></figure>')
        cards.append(f'<article><h3>{html.escape(shape.replace("-", " ").title())}</h3>'
                     f'<p>{html.escape(DESCRIPTIONS.get(shape, ""))}</p>'
                     '<label><input type="checkbox" class="graph-scale"> Compare at the same scale</label><div class="graph-pair">'
                     + "".join(items) + '</div></article>')
    return ('<section id="workload-graphs"><h2>The graphs being measured</h2>'
            '<p>One small measured size per shape, before edits. Actual node bodies and connectors from Parsegraph’s paint helpers, '
            'verified against the saved layout. Thumbnails fit independently for legibility; use “same scale” to compare packing. '
            'Dark green marks the root; fill colors distinguish paint groups, with amber outlines at group roots. '
            'Colors repeat for graphs with many groups. These are the benchmark’s synthetic body sizes, not gallery styling.</p>'
            + "".join(cards) + '</section>')
