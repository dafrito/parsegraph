"""Offline report renderer. Raw JSONL remains authoritative; no timing reruns."""
import base64
from collections import defaultdict
import html
import io
import json
import math
import os
from pathlib import Path
import statistics

SCHEMA = "parsegraph.bench/1"
COLORS = {"c": "#137a70", "typescript": "#be542b"}


def load_events(path):
    rows = []
    for number, line in enumerate(Path(path).read_text().splitlines(), 1):
        if not line.strip():
            continue
        row = json.loads(line, parse_constant=lambda x: (_ for _ in ()).throw(ValueError(f"Nonfinite value {x}")))
        if row.get("schema") != SCHEMA:
            raise ValueError(f"Unsupported event schema at line {number}")
        if row.get("sequence") != len(rows):
            raise ValueError(f"Missing/reordered event at line {number}")
        if rows and row.get("run_id") != rows[0]["run_id"]:
            raise ValueError("Cannot silently combine different runs")
        rows.append(row)
    if not rows or rows[0]["type"] != "run_start":
        raise ValueError("Missing run_start")
    return rows


def percentile(values, q):
    data = sorted(values)
    p = (len(data) - 1) * q
    low = math.floor(p)
    high = math.ceil(p)
    return data[low] + (data[high] - data[low]) * (p - low)


def summarize(rows):
    verified = {r["case"] for r in rows if r["type"] == "parity" and r["status"] == "passed"}
    complete = {r["case"] for r in rows if r["type"] == "case_end" and r["status"] == "passed"}
    expected = rows[0]["configuration"]["repeats"]
    grouped = defaultdict(list)
    for r in rows:
        if r["type"] == "sample" and r["case"] in verified & complete:
            grouped[(r["case"], r["stage"], r["runtime"])].append(r)
    result = []
    for case in complete & verified:
        c_stages = {stage for c, stage, runtime in grouped if c == case and runtime == "c"}
        ts_stages = {stage for c, stage, runtime in grouped if c == case and runtime == "typescript"}
        if not c_stages or c_stages != ts_stages:
            raise ValueError(f"Missing runtime/stages for completed case: {case}")
    for (case, stage, runtime), samples in sorted(grouped.items()):
        if (len(samples) != expected or {r["repeat"] for r in samples} != set(range(expected))):
            raise ValueError(f"Missing or duplicated trials: {case}/{stage}/{runtime}")
        times = [r["elapsed_ms"] / r["iterations"] for r in samples]
        if any(not math.isfinite(v) or v < 0 for v in times):
            raise ValueError("Invalid timing sample")
        first = samples[0]
        memory = {}
        for key in first["memory"]:
            values = [r["memory"].get(key) for r in samples if r["memory"].get(key) is not None]
            memory[key] = statistics.median(values) if values else None
        result.append(dict(case=case, shape=first["shape"], budget=first["budget"], nodes=first["nodes"],
                           fit=first["fit"], stage=stage, runtime=runtime, trials=len(times),
                           median_ms=statistics.median(times), p25_ms=percentile(times, .25),
                           p75_ms=percentile(times, .75), min_ms=min(times), max_ms=max(times),
                           nodes_measured=statistics.median(r["nodes_measured"] / r["iterations"] for r in samples),
                           memory=memory))
    return result


def render(events_path, output):
    import preview
    rows = load_events(events_path)
    summary = summarize(rows)
    output = Path(output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    gallery = preview.gallery(events_path, rows, output)
    charts = output.parent / (output.stem + "-charts")
    charts.mkdir(exist_ok=True)
    os.environ.setdefault("MPLCONFIGDIR", str(output.parent / ".matplotlib"))
    os.environ.setdefault("XDG_CACHE_HOME", str(output.parent / ".cache"))
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 10,
                         "axes.spines.top": False, "axes.spines.right": False,
                         "axes.titleweight": "bold", "figure.facecolor": "#faf9f6",
                         "axes.facecolor": "#faf9f6", "svg.fonttype": "none"})

    def plot(stage, title, name, memory_key=None):
        subset = [r for r in summary if r["stage"] == stage]
        shapes = sorted({r["shape"] for r in subset})
        if not shapes:
            return "<p>No accepted samples for this stage.</p>"
        fig, axes = plt.subplots(math.ceil(len(shapes) / 2), 2,
                                 figsize=(11, max(3.3, math.ceil(len(shapes) / 2) * 2.9)), squeeze=False,
                                 layout="constrained")
        for ax, shape in zip(axes.flat, shapes):
            positive = []
            for runtime in ("c", "typescript"):
                for fit in ("exact", "loose"):
                    data = sorted([r for r in subset if r["shape"] == shape and r["runtime"] == runtime and r["fit"] == fit], key=lambda r: r["nodes"])
                    data = [r for r in data if not memory_key or r["memory"].get(memory_key) is not None]
                    if not data:
                        continue
                    x = [r["nodes"] for r in data]
                    y = [r["memory"][memory_key] / 1048576 if memory_key else r["median_ms"] for r in data]
                    positive.extend(v for v in y if v > 0)
                    ax.plot(x, y, marker="o" if fit == "exact" else "s", markersize=4,
                            linestyle="-" if fit == "exact" else "--", color=COLORS[runtime],
                            label=f"{'C' if runtime == 'c' else 'TypeScript'} · {fit}")
                    if not memory_key:
                        ax.fill_between(x, [r["p25_ms"] for r in data], [r["p75_ms"] for r in data],
                                        color=COLORS[runtime], alpha=.12)
            ax.set_title(shape.replace("-", " ").title(), loc="left")
            ax.set_xlabel("Actual nodes")
            ax.set_ylabel("MiB" if memory_key else "Milliseconds / operation")
            if positive:
                ax.set_yscale("log")
            ax.set_xscale("log", base=2)
            ax.grid(True, alpha=.18)
            ax.legend(fontsize=7, frameon=False)
        for ax in list(axes.flat)[len(shapes):]:
            ax.set_visible(False)
        fig.suptitle(title, fontsize=17, fontweight="bold")
        fig.savefig(charts / f"{name}.svg")
        fig.savefig(charts / f"{name}.png", dpi=130)
        buffer = io.BytesIO()
        fig.savefig(buffer, format="png", dpi=130)
        plt.close(fig)
        # Embedded plot keeps the HTML portable; separate SVG/PNG supports reuse.
        return f'<img alt="{html.escape(title, quote=True)}" src="data:image/png;base64,{base64.b64encode(buffer.getvalue()).decode()}"/>'

    start = rows[0]
    end = next((r for r in reversed(rows) if r["type"] == "run_end"), None)
    status = end["status"] if end else "interrupted"
    errors = [r for r in rows if r["type"] == "case_end" and r["status"] != "passed"]
    accepted = len({r["case"] for r in summary})
    e = html.escape
    cards = [
        ("Full layout ready for drawing", "full_layout/ready", "full-layout", None,
         "Shared endpoint: layout plus all node local and world transforms. Shading shows the middle 50% of trials, not a confidence interval."),
        ("Leaf resize → ready", "leaf_resize/ready", "leaf-resize", None,
         "Mean per update within each trial; medians across fresh processes. Includes invalidation and complete transform materialization."),
        ("Root resize → ready", "root_resize/ready", "root-resize", None,
         "Tests moving descendant geometry after enlarging the root."),
        ("Group scale → ready", "group_scale/ready", "group-scale", None,
         "Only fixtures with explicit child paint groups. Raw API cost is also retained in the table and JSONL."),
        ("Extent buffer capacity", "full_layout/ready", "extent-memory", "extent_capacity_bytes",
         "Comparable diagnostic allocation accounting: allocated extent capacity × 8 bytes, including unused capacity. Excludes node objects and temporary allocations."),
        ("Process peak resident memory", "full_layout/ready", "process-memory", "peak_rss_bytes",
         "Whole-process high-water mark through this stage, including runtime, input, warmups, allocator and temporary buffers. NOT graph-only memory or a measure of JS object size."),
    ]
    sections = []
    for i, (title, stage, name, metric, caption) in enumerate(cards):
        content = f"<p>{e(caption)}</p>" + plot(stage, title, name, metric)
        sections.append(f'<section><h2>{e(title)}</h2>{content}</section>' if i == 0 else
                        f'<details><summary>{e(title)}</summary>{content}</details>')
    table = []
    for r in summary:
        table.append("<tr>" + "".join(f"<td>{e(str(v))}</td>" for v in (
            r["shape"], r["nodes"], r["fit"], r["runtime"], r["stage"], r["trials"],
            f'{r["median_ms"]:.6g}', f'{r["p25_ms"]:.6g}–{r["p75_ms"]:.6g}',
            f'{r["nodes_measured"]:.3g}', r["memory"]["extent_bounds"])) + "</tr>")
    summary_path = output.with_suffix(".summary.json")
    summary_path.write_text(json.dumps(dict(schema=SCHEMA, run_id=start["run_id"], status=status,
                                          renderer={"matplotlib": matplotlib.__version__}, summaries=summary), indent=2) + "\n")
    # Only generated relative filenames enter HTML links; data is always escaped.
    source_link = os.path.relpath(Path(events_path).resolve(), output.parent)
    error_text = "".join(f'<li>{e(r["case"])}: {e(r.get("error", "failed"))}</li>' for r in errors)
    if end and end.get("error"):
        error_text += f'<li>{e(end["error"])}</li>'
    document = f'''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Parsegraph benchmark report</title>
<style>
:root{{color-scheme:light}}body{{margin:0;background:#faf9f6;color:#202b33;font:16px/1.6 system-ui,sans-serif}}
main{{max-width:1160px;margin:auto;padding:36px 24px}}h1{{font-size:2.5rem;line-height:1.15;margin:12px 0}}
h2{{font-size:1.4rem}}.eyebrow{{text-transform:uppercase;letter-spacing:.14em;color:#137a70;font-weight:700}}
.lead{{max-width:850px;color:#4e5d68}}.stats{{display:flex;gap:30px;flex-wrap:wrap;margin:28px 0;padding:20px 0;border-block:1px solid #d6ddd9}}
.stats strong{{display:block;font-size:1.5rem}}a{{color:#137a70}}section,details{{margin:28px 0}}summary{{cursor:pointer;font-size:1.25rem;font-weight:650}}
img{{display:block;width:100%;height:auto}}.notice{{padding:16px 20px;background:#eaf0eb;border-left:4px solid #137a70}}
.errors{{background:#fbece4;padding:16px}}.scroll{{overflow:auto;max-height:650px}}table{{border-collapse:collapse;width:100%;font-size:13px}}
th,td{{padding:8px 12px;text-align:left;border-bottom:1px solid #ddd;white-space:nowrap}}th{{position:sticky;top:0;background:#eaf0eb}}
pre{{white-space:pre-wrap;overflow-wrap:anywhere;background:#eef0ed;padding:18px;font-size:12px}}input{{padding:10px;font:inherit;width:min(90%,450px);margin:16px 0}}
footer{{margin-top:48px;color:#5f6b74;font-size:13px}}
.graph-pair{{display:grid;grid-template-columns:1fr 1fr;gap:16px}}figure{{margin:0;min-width:0}}figcaption{{font-weight:600;margin-bottom:8px}}
.graph-preview{{height:260px;object-fit:contain;background:#faf9f6;border:1px solid #d6ddd9;border-radius:6px}}
input.graph-scale{{width:auto;margin:8px 5px 14px 0}}
#workload-graphs article{{padding:20px 0;border-bottom:1px solid #d6ddd9}}#workload-graphs h3{{margin-bottom:0}}
@media(max-width:650px){{.graph-pair{{grid-template-columns:1fr}}}}
</style><main><div class="eyebrow">Parsegraph · headless performance</div>
<h1>Same graphs. Two implementations.</h1>
<p class="lead">Controlled TypeScript and C workloads, checked for geometry agreement before timing comparisons. This report is a reusable artifact generated from the accompanying JSONL event stream.</p>
<p class="lead">{e(start.get('platform', 'Environment not recorded'))} · Node {e(start.get('node', 'unrecorded'))} · source {e(start.get('commit', 'unrecorded')[:12])}</p>
<div class="stats"><div><strong>{e(status.upper())}</strong>run status</div><div><strong>{accepted}</strong>accepted cases</div>
<div><strong>{start['configuration']['repeats']}</strong>trials per runtime / case</div><div><strong>{start['configuration']['warmups']}</strong>warmups per process</div></div>
<p><a href="{e(source_link, quote=True)}">JSONL events</a> · <a href="{e(summary_path.name, quote=True)}">Summary JSON</a> · <a href="{e(charts.name, quote=True)}/full-layout.svg">Reusable SVG chart</a></p>
<div class="notice"><strong>Read the endpoint, not just the number.</strong> TypeScript eagerly computes positions; C can defer them. <code>/api</code> timings therefore measure different internal work. Compare <code>/ready</code> for the shared end-to-end contract. No timing thresholds or universal speedup claims.</div>
{'<div class="errors"><strong>Incomplete/failed cases are excluded.</strong><ul>' + error_text + '</ul></div>' if errors or status != 'passed' else ''}
{gallery}
{''.join(sections)}
<details><summary>All accepted measurements</summary><label>Filter rows <input id="filter" placeholder="e.g. comb, full_layout/api, typescript"></label><div class="scroll"><table id="samples">
<thead><tr>{''.join('<th>'+h+'</th>' for h in ['Shape','Nodes','Fit','Runtime','Stage','Trials','Median ms/op','P25–P75','Measured nodes/op','Live bounds'])}</tr></thead><tbody>{''.join(table)}</tbody></table></div></details>
<details><summary>Method and environment</summary><p>{e(start['methodology'])}</p>
<p>Demo fixtures reuse the actual generator topology with synthetic precomputed body sizes and a four-unit gap. Exact/loose fits intentionally produce different spacing. GC, allocator and JIT effects remain part of their runtimes. Extent accounting is not peak RSS; Node arrayBuffers is a subset of external memory, not an additional allocation.</p>
<pre>{e(json.dumps(start, indent=2))}</pre></details>
<footer>Generated with Matplotlib {e(matplotlib.__version__)}. Plots use log axes; zero-duration samples remain in JSON/table. Median and interquartile ranges describe these observations only. Graphics snapshots, font rendering, GPU/VRAM, and browser costs are outside this run.</footer></main>
<script>document.getElementById('filter').addEventListener('input',function(){{const q=this.value.toLowerCase();document.querySelectorAll('#samples tbody tr').forEach(r=>r.hidden=!r.textContent.toLowerCase().includes(q));}});
document.querySelectorAll('.graph-scale').forEach(c=>c.addEventListener('change',function(){{this.closest('article').querySelectorAll('.graph-preview').forEach(img=>img.src=this.checked?img.dataset.shared:img.dataset.fitted);}}));</script></html>'''
    output.write_text(document)
    print(f"Report: {output}")
    return summary
