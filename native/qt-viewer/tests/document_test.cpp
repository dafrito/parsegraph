#include "GraphDocument.h"
#include <QFile>
#include <QGuiApplication>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QSet>
#include <cmath>
#include <functional>
#include <iostream>
#include <limits>
#include <stdexcept>

namespace {
void check(bool value, const char *message) {
    if (!value) throw std::runtime_error(message);
}
void near(double actual, double expected, const char *message) {
    if (!std::isfinite(actual) || std::abs(actual - expected) > 1e-5)
        throw std::runtime_error(std::string(message) + ": " + std::to_string(actual) +
                                 " != " + std::to_string(expected));
}
QByteArray read(const QString &relative) {
    QFile file(QStringLiteral(PG_SOURCE_ROOT) + '/' + relative);
    if (!file.open(QIODevice::ReadOnly)) throw std::runtime_error(file.errorString().toStdString());
    return file.readAll();
}
std::shared_ptr<pgqt::GraphDocument> load(const QJsonObject &value, bool deterministic = true) {
    return pgqt::GraphDocument::fromJson(QJsonDocument(value).toJson(), deterministic);
}
void rejects(const QJsonObject &value, const char *message) {
    bool rejected = false;
    try { load(value); } catch (const std::runtime_error &) { rejected = true; }
    check(rejected, message);
}
QJsonObject record(const QString &id, const QJsonValue &parent = QJsonValue(QJsonValue::Null),
                   const QJsonValue &direction = QJsonValue(QJsonValue::Null)) {
    return {{"id", id}, {"scale", 1}, {"fit", "loose"},
            {"layoutPreference", parent.isNull() ? "horizontal" : "parent"},
            {"parentId", parent}, {"parentDir", direction}, {"alignment", "none"},
            {"axisOverlap", "default"}, {"rightToLeft", false}, {"paintGroup", false}};
}
QJsonObject simple() {
    auto root = record("root");
    root["value"] = "Hello";
    return {{"format", "parsegraph"}, {"version", 1}, {"root", "root"},
            {"nodes", QJsonArray{root}}, {"capabilities", QJsonObject{}}};
}
void fixtures() {
    for (const auto *preset : {"standard", "proportional", "math"}) {
        const QString base = "examples/fixtures/proportion-" + QString(preset);
        const auto source = QJsonDocument::fromJson(read(base + ".parsegraph")).object();
        const auto doc = load(source);
        const auto expected = QJsonDocument::fromJson(read(base + ".geometry.json")).object();
        check(doc->nodes().size() == 25, "fixture node count");
        check(doc->groups().size() > 1, "fixture must exercise separate paint groups");
        size_t bodyCount = 0, lineCount = 0;
        std::vector<QRectF> flattened;
        for (const auto &group : doc->groups()) {
            bodyCount += group.bodies.size();
            lineCount += group.lines.size();
            for (const auto &body : group.bodies)
                flattened.emplace_back(group.position.x() + body.rect.x() * group.scale,
                                       group.position.y() + body.rect.y() * group.scale,
                                       body.rect.width() * group.scale,
                                       body.rect.height() * group.scale);
        }
        check(bodyCount == 25 && lineCount == 24, "paint snapshot count");
        for (const auto &node : doc->nodes()) {
            check(expected.contains(node.id), "fixture ID missing");
            const auto geometry = expected[node.id].toObject();
            near(node.bounds.center().x(), geometry["x"].toDouble(), "fixture x");
            near(node.bounds.center().y(), geometry["y"].toDouble(), "fixture y");
            near(node.bounds.width(), geometry["width"].toDouble(), "fixture width");
            near(node.bounds.height(), geometry["height"].toDouble(), "fixture height");
            check(doc->bounds().contains(node.bounds), "global drawing bounds contain body");
            const auto *hit = doc->hitTest(node.bounds.center());
            check(hit && hit->id == node.id, "hit testing follows geometry");
            bool found = false;
            for (const auto &body : flattened)
                if (std::abs(body.x() - node.bounds.x()) < 1e-5 &&
                    std::abs(body.y() - node.bounds.y()) < 1e-5 &&
                    std::abs(body.width() - node.bounds.width()) < 1e-5 &&
                    std::abs(body.height() - node.bounds.height()) < 1e-5) found = true;
            check(found, "group-local rectangles flatten to node world geometry");
            if (QString(preset) == "proportional" && !node.text.isEmpty())
                near(node.bounds.center().y(), 60, "numbered endpoint baseline");
        }
        check(!doc->hitTest(QPointF(1e9, 1e9)), "hit outside graph");
        check(!doc->hitTest(QPointF(std::numeric_limits<double>::quiet_NaN(), 0)), "nonfinite hit");
        auto shuffled = source;
        const auto original = source["nodes"].toArray();
        QJsonArray reversed;
        for (auto i = original.size(); i > 0; --i) reversed.append(original[i - 1]);
        shuffled["nodes"] = reversed;
        const auto shuffledDoc = load(shuffled);
        for (const auto &node : shuffledDoc->nodes()) {
            const auto geometry = expected[node.id].toObject();
            near(node.bounds.center().x(), geometry["x"].toDouble(), "record-order independent x");
            near(node.bounds.center().y(), geometry["y"].toDouble(), "record-order independent y");
        }
        const auto nativeFonts = load(source, false);
        check(nativeFonts->bounds().width() > 0 && nativeFonts->bounds().height() > 0,
              "actual shaped text produces finite graph");
        for (const auto &node : nativeFonts->nodes())
            if (QString(preset) == "proportional" && !node.text.isEmpty())
                near(node.bounds.center().y(), 60, "actual font endpoint baseline");
    }
    const auto bundled = pgqt::GraphDocument::fromJson(
        read("native/qt-viewer/assets/proportion.parsegraph"));
    check(bundled->nodes().size() == 196 && bundled->groups().size() == 23,
          "bundled proportion exercises 196 nodes and 23 groups");
    for (const auto &node : bundled->nodes())
        if (!node.text.isEmpty()) near(node.bounds.center().y(), 240, "bundled actual font baseline");
}
void validation() {
    const auto fixture = QJsonDocument::fromJson(read("examples/fixtures/proportion-proportional.parsegraph")).object();
    auto malformed = fixture;
    malformed["version"] = 0;
    rejects(malformed, "v0 rejected explicitly");
    malformed = fixture;
    malformed["extra"] = true;
    rejects(malformed, "unknown core field");
    malformed = fixture;
    auto nodes = malformed["nodes"].toArray();
    nodes.append(nodes[0]);
    malformed["nodes"] = nodes;
    rejects(malformed, "duplicate id");
    malformed = fixture;
    nodes = malformed["nodes"].toArray();
    auto child = nodes[1].toObject();
    child["parentId"] = "absent";
    nodes[1] = child;
    malformed["nodes"] = nodes;
    rejects(malformed, "missing parent");
    malformed = fixture;
    nodes = malformed["nodes"].toArray();
    child = nodes[2].toObject();
    child["parentDir"] = nodes[1].toObject()["parentDir"];
    nodes[2] = child;
    malformed["nodes"] = nodes;
    rejects(malformed, "occupied direction must reject before tolerant connect");
    malformed = simple();
    malformed["nodes"] = QJsonArray{record("root"), record("a", "b", "backward"), record("b", "a", "backward")};
    rejects(malformed, "disconnected cycle");
    malformed["nodes"] = QJsonArray{record("root"), record("a", "root", "backward"), record("b", "a", "forward")};
    rejects(malformed, "occupied parent connection");
    malformed = fixture;
    auto capabilities = malformed["capabilities"].toObject();
    auto presentation = capabilities["presentation/1"].toObject();
    auto spacing = presentation["spacing"].toObject();
    spacing["verticalStep"] = 0;
    presentation["spacing"] = spacing;
    capabilities["presentation/1"] = presentation;
    malformed["capabilities"] = capabilities;
    rejects(malformed, "malformed supported capability");
    malformed = fixture;
    capabilities = malformed["capabilities"].toObject();
    presentation = capabilities["presentation/1"].toObject();
    presentation["future"] = true;
    capabilities["presentation/1"] = presentation;
    malformed["capabilities"] = capabilities;
    rejects(malformed, "unknown supported presentation field");
    auto future = fixture;
    capabilities = future["capabilities"].toObject();
    capabilities["future/42"] = QJsonArray{1, "opaque"};
    capabilities["appearance/1"] = QJsonObject{{"arbitrary", true}};
    future["capabilities"] = capabilities;
    const auto ignored = load(future)->ignoredCapabilities();
    check(ignored.contains("future/42") && ignored.contains("appearance/1"), "unsupported capabilities reported");
    auto opaque = simple();
    auto root = record("__proto__");
    root["value"] = "opaque";
    opaque["root"] = "__proto__";
    opaque["nodes"] = QJsonArray{root};
    check(load(opaque)->nodes()[0].id == "__proto__", "opaque IDs preserved");
}
void textAndContainment() {
    auto source = simple();
    auto root = record("root");
    root["value"] = QString::fromUtf8("a😀\r\nb\rc\n");
    source["nodes"] = QJsonArray{root};
    auto doc = load(source);
    near(doc->nodes()[0].bounds.width(), 18, "codepoint metrics");
    near(doc->nodes()[0].bounds.height(), 45, "CRLF and trailing empty line height");
    root["value"] = "WWWWWWWW";
    source["nodes"] = QJsonArray{root};
    const auto wideText = load(source, false)->nodes()[0].bounds.width();
    root["value"] = "iiiiiiii";
    source["nodes"] = QJsonArray{root};
    const auto narrowText = load(source, false)->nodes()[0].bounds.width();
    check(wideText > narrowText && narrowText > 10,
          "actual shaping measures whole lines with proportional glyph widths");
    root["value"] = "iiiiiiii    ";
    source["nodes"] = QJsonArray{root};
    check(load(source, false)->nodes()[0].bounds.width() > narrowText,
          "actual shaping retains trailing spaces");
    root["value"] = QJsonObject{{"label", "not standard text"}};
    source["nodes"] = QJsonArray{root};
    rejects(source, "structured content explicitly unsupported");
    for (const auto value : {1e20, 1e21, 1e-6, 1e-7, -0.0}) {
        root["value"] = value;
        source["nodes"] = QJsonArray{root};
        doc = load(source);
        const QString expected = value == 1e20 ? "100000000000000000000" :
                                 value == 1e21 ? "1e+21" : value == 1e-6 ? "0.000001" :
                                 value == 1e-7 ? "1e-7" : "0";
        check(doc->nodes()[0].text == expected, "JSON numerical text conventions");
    }
    root["value"] = "AB";
    auto inward = record("inner", "root", "outward");
    inward["value"] = "W";
    inward["alignment"] = "inward-horizontal";
    source["nodes"] = QJsonArray{root, inward};
    doc = load(source);
    near(doc->nodes()[0].bounds.width(), 35, "horizontal inward content width");
    near(doc->nodes()[0].bounds.height(), 20, "horizontal inward content height");
    const auto *hit = doc->hitTest(doc->nodes()[1].bounds.center());
    check(hit && hit->id == "inner", "inward child wins hit test");
    inward["alignment"] = "inward-vertical";
    source["nodes"] = QJsonArray{root, inward};
    doc = load(source);
    near(doc->nodes()[0].bounds.width(), 18, "vertical inward content width");
    near(doc->nodes()[0].bounds.height(), 35, "vertical inward content height");
    inward["paintGroup"] = true;
    inward["scale"] = 0.5;
    root["scale"] = 2;
    source["nodes"] = QJsonArray{root, inward};
    doc = load(source);
    check(doc->groups().size() == 2, "scaled inward separate group");
    // Root scale is parent-relative and therefore does not affect world space.
    near(doc->groups()[0].scale, 1, "root world scale");
    near(doc->groups()[1].scale, 0.5, "nested absolute group scale");
    near(doc->nodes()[1].bounds.width(), 6, "scaled text body absolute size");
}
} // namespace

int main(int argc, char **argv) {
    QGuiApplication app(argc, argv);
    try {
        fixtures();
        validation();
        textAndContainment();
        std::cout << "Qt document: three geometry fixtures, paint-group flattening, text, containment, and validation passed\n";
        return 0;
    } catch (const std::exception &error) {
        std::cerr << "Qt document test: " << error.what() << '\n';
        return 1;
    }
}
