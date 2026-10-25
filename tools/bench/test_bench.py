import copy
import json
from pathlib import Path
import tempfile
import unittest
import xml.etree.ElementTree as ET

import bench
import report
import preview


def events():
    rows = [dict(type="run_start", configuration={"repeats": 3, "warmups": 2}, methodology="test")]
    rows += [dict(type="parity", case="comb-32-exact", status="passed")]
    for runtime, scale in (("c", 1), ("typescript", 10)):
        for repeat, time in enumerate((1, 2, 9)):
            rows.append(dict(type="sample", case="comb-32-exact", shape="comb", nodes=32, budget=32,
                             fit="exact", runtime=runtime, stage="full_layout/ready", repeat=repeat,
                             elapsed_ms=time * scale * 3, iterations=3, nodes_measured=96,
                             memory={"extent_bounds": 100, "extent_capacity_bytes": 1048576,
                                     "peak_rss_bytes": 2097152}))
    rows += [dict(type="case_end", case="comb-32-exact", status="passed"), dict(type="run_end", status="passed")]
    return [dict(schema=bench.SCHEMA, run_id="test", sequence=i, **row) for i, row in enumerate(rows)]


class AcceptanceTests(unittest.TestCase):
    def test_svg_preserves_world_geometry_and_shared_viewport(self):
        rectangles = [dict(kind="body", node=0, group=0, x=-10, y=15, width=20, height=8),
                      dict(kind="line", node=0, group=0, x=5, y=15, width=10, height=1)]
        viewport = (-50, -40, 100, 80)
        xml = ET.fromstring(preview.svg(rectangles, viewport, '<demo & "fit">'))
        self.assertEqual(xml.attrib["viewBox"], "-62 -52 174 144")
        self.assertEqual(xml.find('{http://www.w3.org/2000/svg}title').text, '<demo & "fit">')
        bodies = [r for r in xml if r.attrib.get("data-kind") == "body"]
        self.assertEqual(bodies[0].attrib["x"], "-20")
        self.assertEqual(bodies[0].attrib["y"], "11")
        self.assertEqual(bodies[0].attrib["width"], "20")
        rectangles[0]["x"] = float("nan")
        with self.assertRaises(ValueError):
            preview.svg(rectangles, viewport, "bad")

    def test_painted_bodies_apply_world_scale_exactly_once(self):
        drawing = dict(geometry=[[10, 20, .5, 0, 0, 1, 24, 16]],
                       rectangles=[dict(kind="body", node=0, group=0, x=10, y=20, width=12, height=8)])
        preview.validate_bodies(drawing, 1)
        drawing["rectangles"][0]["width"] = 24
        with self.assertRaisesRegex(ValueError, "world geometry"):
            preview.validate_bodies(drawing, 1)

    def test_gallery_binds_illustrations_to_event_stream(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            events_path = root / "events.jsonl"
            events_path.write_text("test")
            (root / "illustrations").mkdir()
            (root / "illustrations/manifest.json").write_text(json.dumps(dict(
                schema="parsegraph.bench.illustrations/1", run_id="different", events_sha256="wrong")))
            with self.assertRaisesRegex(ValueError, "match this benchmark run"):
                preview.gallery(events_path, events(), root / "report.html")

    def test_geometry_checks_every_node_and_stage(self):
        a = [{"type": "geometry", "stage": "full_layout", "nodes": [[0.] * 16, [1.] * 16]}]
        b = copy.deepcopy(a)
        self.assertEqual(bench.validate_geometry(a, b, 2), ["full_layout"])
        b[0]["nodes"][1][4] = 20
        with self.assertRaisesRegex(ValueError, "node=1, field=4"):
            bench.validate_geometry(a, b, 2)
        with self.assertRaises(ValueError):
            bench.validate_geometry(a, [], 2)

    def test_counts_are_exact_and_nonfinite_is_rejected(self):
        a = [{"type": "geometry", "stage": "full_layout", "nodes": [[1.] * 16]}]
        b = copy.deepcopy(a)
        b[0]["nodes"][0][9] += 1e-7
        with self.assertRaises(ValueError):
            bench.validate_geometry(a, b, 1)
        with self.assertRaises(ValueError):
            bench.strict_json('{"elapsed_ms":NaN}')

    def test_per_operation_median_and_interquartile(self):
        summary = report.summarize(events())
        c = next(r for r in summary if r["runtime"] == "c")
        self.assertEqual(c["median_ms"], 2)
        self.assertEqual(c["p25_ms"], 1.5)
        self.assertEqual(c["p75_ms"], 5.5)
        self.assertEqual(c["nodes_measured"], 32)

    def test_unverified_incomplete_and_failed_cases_are_excluded(self):
        rows = [r for r in events() if r["type"] != "parity"]
        self.assertEqual(report.summarize(rows), [])
        rows = [r for r in events() if r["type"] != "case_end"]
        self.assertEqual(report.summarize(rows), [])
        rows = events()
        rows[-2]["status"] = "failed"
        self.assertEqual(report.summarize(rows), [])

    def test_missing_and_duplicate_trials_or_runtime_rejected(self):
        rows = events()
        del rows[2]
        with self.assertRaisesRegex(ValueError, "Missing or duplicated trials"):
            report.summarize(rows)
        rows = events()
        rows[2]["repeat"] = rows[3]["repeat"]
        with self.assertRaises(ValueError):
            report.summarize(rows)
        rows = [r for r in events() if r.get("runtime") != "typescript"]
        with self.assertRaisesRegex(ValueError, "Missing runtime"):
            report.summarize(rows)

    def test_stream_integrity(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.jsonl"
            rows = events()
            path.write_text("\n".join(json.dumps(r) for r in rows))
            self.assertEqual(report.load_events(path), rows)
            rows[2]["sequence"] = 900
            path.write_text("\n".join(json.dumps(r) for r in rows))
            with self.assertRaisesRegex(ValueError, "Missing/reordered"):
                report.load_events(path)

    def test_trial_summary_must_match_verified_geometry(self):
        rows = [dict(type="sample", stage="full_layout/ready", elapsed_ms=1, iterations=1,
                     checksum=123, memory={"extent_bounds": 12})]
        reference = bench.validate_samples(rows)
        changed = copy.deepcopy(rows)
        changed[0]["checksum"] += 1
        with self.assertRaisesRegex(ValueError, "geometry summary changed"):
            bench.validate_samples(changed, reference)

    def test_report_is_portable_and_escapes_errors(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "events.jsonl"
            rows = events()
            rows[-1].update(status="failed", error='<script>alert("x")</script>')
            path.write_text("\n".join(json.dumps(r) for r in rows))
            output = Path(directory) / "report.html"
            report.render(path, output)
            text = output.read_text()
            self.assertIn("data:image/png;base64,", text)
            self.assertIn("&lt;script&gt;", text)
            self.assertNotIn('<script>alert("x")</script>', text)
            self.assertIn("FAILED", text)
            self.assertTrue((Path(directory) / "report-charts/full-layout.svg").exists())


if __name__ == "__main__":
    unittest.main()
