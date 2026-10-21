#include "GraphDocument.h"
#include <QFile>
#include <QGuiApplication>
#include <QHash>
#include <cmath>
#include <functional>
#include <iostream>
#include <stdexcept>

namespace {
void check(bool condition, const char *message) {
    if (!condition) throw std::runtime_error(message);
}
void near(double actual, double expected, const char *message) {
    if (!std::isfinite(actual) || std::abs(actual - expected) > 1e-5)
        throw std::runtime_error(std::string(message) + ": " + std::to_string(actual) +
                                 " != " + std::to_string(expected));
}
void sameRect(const QRectF &actual, const QRectF &expected, const char *message) {
    near(actual.x(), expected.x(), message);
    near(actual.y(), expected.y(), message);
    near(actual.width(), expected.width(), message);
    near(actual.height(), expected.height(), message);
}
void rejects(const std::function<void()> &operation) {
    bool rejected = false;
    try { operation(); } catch (const std::invalid_argument &) { rejected = true; }
    check(rejected, "invalid session operation must be rejected before mutation");
}
void sameGeometry(const pgqt::GraphDocument &actual, const pgqt::GraphDocument &expected) {
    check(actual.nodes().size() == expected.nodes().size(), "same node count");
    check(actual.groups().size() == expected.groups().size(), "same group count");
    sameRect(actual.bounds(), expected.bounds(), "document bounds");
    QHash<QString, const pgqt::NodeVisual *> expectedNodes;
    for (const auto &node : expected.nodes()) expectedNodes.insert(node.id, &node);
    for (const auto &node : actual.nodes()) {
        check(expectedNodes.contains(node.id), "node ID parity");
        const auto &other = *expectedNodes.value(node.id);
        check(node.text == other.text && node.groupId == other.groupId, "node metadata parity");
        sameRect(node.bounds, other.bounds, "node body parity");
        sameRect(node.extents, other.extents, "node extent parity");
    }
    for (size_t i = 0; i < actual.groups().size(); ++i) {
        const auto &a = actual.groups()[i], &b = expected.groups()[i];
        check(a.id == b.id, "paint group order parity");
        near(a.position.x(), b.position.x(), "group x");
        near(a.position.y(), b.position.y(), "group y");
        near(a.scale, b.scale, "group scale");
        sameRect(a.bounds, b.bounds, "group bounds");
        check(a.lines.size() == b.lines.size() && a.bodies.size() == b.bodies.size() &&
              a.labels.size() == b.labels.size(), "group geometry counts");
        for (size_t j = 0; j < a.lines.size(); ++j)
            sameRect(a.lines[j].rect, b.lines[j].rect, "group-local line geometry");
        for (size_t j = 0; j < a.bodies.size(); ++j)
            sameRect(a.bodies[j].rect, b.bodies[j].rect, "group-local body geometry");
        for (size_t j = 0; j < a.labels.size(); ++j) {
            check(a.labels[j].text == b.labels[j].text, "label parity");
            near(a.labels[j].origin.x(), b.labels[j].origin.x(), "label x");
            near(a.labels[j].origin.y(), b.labels[j].origin.y(), "label y");
            near(a.labels[j].scale, b.labels[j].scale, "label scale");
        }
    }
}

// Captured from the canonical TypeScript generator, rather than recreating its
// topology in the test: ts-node --project examples/tsconfig.json
// examples/generators/primes.ts --count 6. It covers 1, primes, composites,
// empty slots, and separate paint groups; no Node runtime is needed by CTest.
const char sixFixture[] = R"PARSEGRAPH({
"format":"parsegraph",
"version":1,
"root":"primes-1",
"nodes":[{"id":"primes-1","value":"1","scale":1,"fit":"loose","layoutPreference":"horizontal","parentId":null,"parentDir":null,"alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-2","value":"2","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-1","parentDir":"backward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-3","value":"3","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-2","parentDir":"backward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-4","value":"4","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-3","parentDir":"backward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-5","value":"5","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-4","parentDir":"backward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-6","value":"6","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-5","parentDir":"backward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-2-factor-2","value":"2","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-2","parentDir":"downward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-6-factor-2","value":"2","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-6","parentDir":"downward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":true},
{"id":"primes-6-factor-3","value":"3","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-6-factor-2","parentDir":"downward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-6-factor-5","value":"","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-6-factor-3","parentDir":"downward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-5-factor-2","value":"","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-5","parentDir":"downward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":true},
{"id":"primes-5-factor-3","value":"","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-5-factor-2","parentDir":"downward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-5-factor-5","value":"5","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-5-factor-3","parentDir":"downward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-4-factor-2","value":"2","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-4","parentDir":"downward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":true},
{"id":"primes-4-factor-3","value":"","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-4-factor-2","parentDir":"downward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false},
{"id":"primes-3-factor-2","value":"","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-3","parentDir":"downward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":true},
{"id":"primes-3-factor-3","value":"3","scale":1,"fit":"loose","layoutPreference":"perpendicular","parentId":"primes-3-factor-2","parentDir":"downward","alignment":"none","axisOverlap":"default","rightToLeft":false,"paintGroup":false}],
"capabilities":{"presentation/1":{"text":{"fontFamily":"sans-serif","fontSize":10,"lineHeight":10},"styles":{"block":{"minWidth":30,"minHeight":30,"paddingX":3,"paddingY":2.5,"square":true},"bud":{"minWidth":30,"minHeight":30,"paddingX":0,"paddingY":0,"square":true},"slot":{"minWidth":30,"minHeight":30,"paddingX":3,"paddingY":2.5,"square":true}},"defaultStyle":"block","nodeStyles":{"primes-1":"block","primes-2":"block","primes-3":"block","primes-4":"block","primes-5":"block","primes-6":"block","primes-2-factor-2":"block","primes-6-factor-2":"block","primes-6-factor-3":"block","primes-6-factor-5":"slot","primes-5-factor-2":"slot","primes-5-factor-3":"slot","primes-5-factor-5":"block","primes-4-factor-2":"block","primes-4-factor-3":"slot","primes-3-factor-2":"slot","primes-3-factor-3":"block"},"spacing":{"horizontal":0,"vertical":0,"inward":0}}}
})PARSEGRAPH";

void canonical() {
    pgqt::PrimesSession session(6);
    const auto native = session.growTo(6);
    const auto serialized = pgqt::GraphDocument::fromJson(sixFixture);
    sameGeometry(*native, *serialized);
    check(native->nodes().size() == 17 && native->groups().size() == 5,
          "canonical six has 17 nodes and five paint groups");
    check(session.metrics().nodesMeasured == 17, "cold layout measures each node");
    size_t light = 0, dark = 0, labels = 0;
    for (const auto &group : native->groups()) {
        labels += group.labels.size();
        for (const auto &body : group.bodies) {
            if (body.color == QColor("#dbe6e8")) ++light;
            else if (body.color == QColor("#183646")) ++dark;
            else check(false, "unknown primes palette color");
        }
    }
    check(light == 5 && dark == 12 && labels == 12, "slots distinguished from labeled factors");
    for (const auto &node : native->nodes()) {
        near(node.bounds.width(), 30, "math cell width");
        near(node.bounds.height(), 30, "math cell height");
    }
}

void incremental() {
    pgqt::PrimesSession incremental(120), cold(120);
    check(incremental.count() == 1 && incremental.limit() == 120, "initial session bounds");
    auto original = incremental.growTo(1);
    const auto originalBounds = original->bounds();
    auto previous = original;
    for (const int target : {2, 3, 9, 10, 30, 100, 120}) {
        const auto before = previous->nodes().size();
        const int previousCount = incremental.count();
        previous = incremental.growTo(target);
        check(incremental.count() == target, "session target reached");
        check(previous->nodes().size() > before, "growth adds new native nodes");
        const auto &metrics = incremental.metrics();
        check(metrics.nodesMeasured == previous->nodes().size() - before +
                                          static_cast<size_t>(previousCount),
              "append measures new nodes and the previous base-row ancestor path");
        if (previousCount >= 2)
            check(metrics.cleanSubtreesSkipped > 0, "append skips prior factor columns");
        check(metrics.nodesCommitted >= metrics.nodesMeasured, "commits include ancestor path");
        check(metrics.generationMs >= 0 && metrics.layoutMs >= 0 && metrics.snapshotMs >= 0,
              "monotonic stage timings");
        for (const auto &node : previous->nodes()) {
            near(node.bounds.width(), 50, "fixed cell width through digit boundaries");
            near(node.bounds.height(), 50, "fixed cell height through digit boundaries");
        }
    }
    sameGeometry(*previous, *cold.growTo(120));
    check(original->nodes().size() == 1 && original->nodes()[0].text == "1",
          "old snapshot retains original nodes");
    sameRect(original->bounds(), originalBounds, "old snapshot keeps original bounds");
    const auto unchanged = incremental.growTo(120);
    sameGeometry(*unchanged, *previous);
    check(incremental.metrics().nodesMeasured == 0 && incremental.metrics().nodesCommitted == 0,
          "unchanged graph avoids layout recomputation");
    rejects([&] { incremental.growTo(119); });
    rejects([&] { incremental.growTo(121); });
    rejects([&] { incremental.growTo(0); });
    check(incremental.count() == 120, "invalid count leaves session unchanged");
    sameGeometry(*incremental.growTo(120), *previous);
}

void lifetime() {
    rejects([] { pgqt::PrimesSession invalid(0); });
    rejects([] { pgqt::PrimesSession invalid(10001); });
    std::shared_ptr<pgqt::GraphDocument> retained;
    {
        pgqt::PrimesSession session(6);
        retained = session.growTo(6);
    }
    sameGeometry(*retained, *pgqt::GraphDocument::fromJson(sixFixture));
    check(retained->hitTest(retained->nodes()[0].bounds.center()) != nullptr,
          "snapshot hit testing survives native graph destruction");
}

void maximumSizingLimit() {
    // Exercise the maximum sizing/growth limit without allocating millions of
    // nodes: the fixed target determines cell dimensions before later appends.
    pgqt::PrimesSession session(10000);
    check(session.limit() == 10000, "maximum sizing limit accepted");
    const auto document = session.growTo(2);
    check(document->nodes().size() == 3, "small initial graph at maximum limit");
    for (const auto &node : document->nodes()) {
        near(node.bounds.width(), 70, "five-digit sizing limit sets fixed cell width");
        near(node.bounds.height(), 70, "five-digit sizing limit sets fixed cell height");
    }
    rejects([&] { session.growTo(10001); });
    check(session.count() == 2, "exceeding maximum leaves graph unchanged");
}
} // namespace

int main(int argc, char **argv) {
    QGuiApplication app(argc, argv);
    try {
        canonical();
        incremental();
        lifetime();
        maximumSizingLimit();
        // Optional externally generated canonical fixture for larger parity
        // runs: qt_primes_document_test document.parsegraph count.
        if (argc == 3) {
            QFile file(QString::fromLocal8Bit(argv[1]));
            check(file.open(QIODevice::ReadOnly), "external fixture open");
            const int count = QString::fromLocal8Bit(argv[2]).toInt();
            pgqt::PrimesSession session(count);
            sameGeometry(*session.growTo(count), *pgqt::GraphDocument::fromJson(file.readAll()));
        }
        std::cout << "Qt native primes: canonical, incremental, snapshot lifetime checks passed\n";
        return 0;
    } catch (const std::exception &error) {
        std::cerr << error.what() << '\n';
        return 1;
    }
}
