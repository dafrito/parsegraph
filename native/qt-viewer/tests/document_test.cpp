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
    future["capabilities"] = capabilities;
    const auto ignored = load(future)->ignoredCapabilities();
    check(ignored == QStringList{"future/42"}, "unsupported capabilities reported");
    capabilities["appearance/1"] = QJsonObject{{"arbitrary", true}};
    future["capabilities"] = capabilities;
    rejects(future, "malformed supported appearance must not be silently ignored");
    auto opaque = simple();
    auto root = record("__proto__");
    root["value"] = "opaque";
    opaque["root"] = "__proto__";
    opaque["nodes"] = QJsonArray{root};
    check(load(opaque)->nodes()[0].id == "__proto__", "opaque IDs preserved");
}

const pgqt::NodeVisual &nodeById(const pgqt::GraphDocument &doc, const QString &id) {
    for (const auto &node : doc.nodes()) if (node.id == id) return node;
    throw std::runtime_error("Missing snapshot node");
}
QRectF flatten(const pgqt::PaintGroup &group, const QRectF &rect) {
    return {group.position.x() + rect.x() * group.scale,
            group.position.y() + rect.y() * group.scale,
            rect.width() * group.scale, rect.height() * group.scale};
}
const pgqt::PaintRect &bodyById(const pgqt::GraphDocument &doc, const QString &id) {
    const auto &node = nodeById(doc, id);
    for (const auto &group : doc.groups()) if (group.id == node.groupId)
        for (const auto &body : group.bodies)
            if (flatten(group, body.rect) == node.bounds) return body;
    throw std::runtime_error("Missing snapshot body");
}
QColor labelColor(const pgqt::GraphDocument &doc, const QString &text) {
    for (const auto &group : doc.groups())
        for (const auto &label : group.labels) if (label.text == text) return label.color;
    throw std::runtime_error("Missing snapshot label");
}
void color(const QColor &actual, const char *rgb, double alpha, const char *message) {
    check(actual.name() == QColor(rgb).name(), message);
    // QColor stores alpha at 16-bit precision; separate RGB stays unpremultiplied.
    near(actual.alphaF(), alpha, message);
}
void appearances() {
    const auto source = QJsonDocument::fromJson(read("examples/fixtures/appearance-colors.parsegraph")).object();
    const auto doc = load(source);
    check(doc->ignoredCapabilities().isEmpty(), "appearance is supported");
    color(doc->pageBackgroundColor(), "#f1f5f9", 0.5, "page color and independent alpha");
    color(bodyById(*doc, "root").color, "#d9f99d", 1, "default fill");
    color(bodyById(*doc, "child").color, "#3366ff", 0.5, "overridden fill");
    color(bodyById(*doc, "transparent").color, "#d9f99d", 0, "zero fill alpha retains default RGB");
    color(labelColor(*doc, "Default"), "#0f172a", 1, "default text");
    color(labelColor(*doc, "Override"), "#ffffff", 1, "color-only text override retains alpha");
    color(labelColor(*doc, "Transparent"), "#0f172a", 0.5, "text independent of transparent fill");
    size_t lineCount = 0, zeroBorderCount = 0;
    for (const auto &group : doc->groups()) {
        for (const auto &line : group.lines) {
            color(line.color, "#ff0000", 0.6, "parent owns outgoing connectors; color-only override retains alpha");
            ++lineCount;
        }
        for (const auto &border : group.borders) {
            if (border.color.alphaF() == 0) ++zeroBorderCount;
            else color(border.color, "#334155", 0.8, "independent default border alpha");
            bool contained = false;
            for (const auto &body : group.bodies) if (body.rect.contains(border.rect)) contained = true;
            check(contained, "border fits within a body without changing geometry");
        }
    }
    check(lineCount == 2 && zeroBorderCount == 4, "fixture connections and zero-alpha border strips");

    auto invisible = source;
    auto invisibleCaps = invisible["capabilities"].toObject();
    auto invisibleAppearance = invisibleCaps["appearance/1"].toObject();
    auto invisibleDefaults = invisibleAppearance["defaults"].toObject();
    for (const auto *key : {"backgroundAlpha", "borderAlpha", "textAlpha", "lineAlpha"})
        invisibleDefaults[key] = 0;
    invisibleAppearance["defaults"] = invisibleDefaults;
    invisibleAppearance["nodeStyles"] = QJsonObject{};
    invisibleCaps["appearance/1"] = invisibleAppearance;
    invisible["capabilities"] = invisibleCaps;
    const auto invisibleDoc = load(invisible);
    for (const auto &group : invisibleDoc->groups()) {
        for (const auto &body : group.bodies) near(body.color.alphaF(), 0, "zero default body alpha");
        for (const auto &border : group.borders) near(border.color.alphaF(), 0, "zero default border alpha");
        for (const auto &line : group.lines) near(line.color.alphaF(), 0, "zero default connector alpha");
        for (const auto &label : group.labels) near(label.color.alphaF(), 0, "zero default text alpha");
    }

    auto plain = source;
    auto caps = plain["capabilities"].toObject();
    caps.remove("appearance/1");
    plain["capabilities"] = caps;
    const auto unstyled = load(plain);
    color(unstyled->pageBackgroundColor(), "#f3f5f7", 1, "absent appearance keeps page palette");
    color(bodyById(*unstyled, "root").color, "#183646", 1, "absent appearance keeps node palette");
    check(doc->bounds() == unstyled->bounds(), "appearance cannot change global bounds");
    for (const auto &node : doc->nodes()) {
        const auto &before = nodeById(*unstyled, node.id);
        check(node.bounds == before.bounds && node.extents == before.extents && node.groupId == before.groupId,
              "appearance cannot change node geometry or grouping");
    }
    for (size_t i = 0; i < doc->groups().size(); ++i) {
        const auto &a = doc->groups()[i], &b = unstyled->groups()[i];
        check(a.bounds == b.bounds && a.position == b.position && a.scale == b.scale,
              "appearance cannot change paint-group geometry");
        check(b.borders.empty(), "absent appearance keeps border-free viewer palette");
    }

    // A scaled child owns a distinct connector to its grandchild. The grandchild
    // receives defaults, never an ancestor's sparse appearance override.
    auto chain = source;
    auto root = record("root"); root["value"] = "Root";
    auto child = record("child", "root", "backward"); child["value"] = "Child"; child["scale"] = 0.5;
    auto grandchild = record("grandchild", "child", "backward"); grandchild["value"] = "Grandchild";
    grandchild["paintGroup"] = true;
    chain["nodes"] = QJsonArray{root, child, grandchild};
    caps = source["capabilities"].toObject();
    auto appearance = caps["appearance/1"].toObject();
    appearance["nodeStyles"] = QJsonObject{
        {"root", QJsonObject{{"backgroundColor", "#FF0000"}, {"lineColor", "#fF0000"}}},
        {"child", QJsonObject{{"backgroundAlpha", 0}, {"lineColor", "#0000ff"}, {"lineAlpha", 0.25}}}};
    caps["appearance/1"] = appearance;
    chain["capabilities"] = caps;
    auto chainDoc = load(chain);
    color(bodyById(*chainDoc, "child").color, "#d9f99d", 0, "alpha-only override does not inherit parent RGB");
    color(bodyById(*chainDoc, "grandchild").color, "#d9f99d", 1, "grandchild uses defaults across paint groups");
    size_t red = 0, blue = 0;
    for (const auto &group : chainDoc->groups()) for (const auto &line : group.lines) {
        if (line.color.name() == "#ff0000") { ++red; near(line.color.alphaF(), 0.6, "root connector alpha"); }
        if (line.color.name() == "#0000ff") { ++blue; near(line.color.alphaF(), 0.25, "child connector alpha"); }
    }
    check(red == 1 && blue == 1, "child style affects its outgoing connector only");
    const auto &scaledBody = bodyById(*chainDoc, "child");
    bool scaledBorder = false;
    for (const auto &border : chainDoc->groups()[0].borders)
        if (border.rect.topLeft() == scaledBody.rect.topLeft() && border.rect.width() == scaledBody.rect.width()) {
            near(border.rect.height(), 0.5, "border thickness follows node-local scale");
            scaledBorder = true;
        }
    check(scaledBorder, "scaled node has inset border");

    // An opaque ID must also work as an appearance key; no JS prototype behavior
    // or presentation style lookup is part of the format's cascade.
    auto opaque = simple();
    root = record("__proto__"); root["value"] = "opaque";
    opaque["root"] = "__proto__";
    opaque["nodes"] = QJsonArray{root};
    appearance["nodeStyles"] = QJsonObject{{"__proto__", QJsonObject{{"backgroundColor", "#aBcDeF"},
                                                                 {"backgroundAlpha", 0}}}};
    appearance["pageBackgroundAlpha"] = 0;
    opaque["capabilities"] = QJsonObject{{"appearance/1", appearance}};
    const auto opaqueDoc = load(opaque);
    color(bodyById(*opaqueDoc, "__proto__").color, "#abcdef", 0, "opaque appearance ID and mixed-case hex");
    color(opaqueDoc->pageBackgroundColor(), "#f1f5f9", 0, "fully transparent page preserves RGB");

    // Missing content and zero-sized styles are legal. Decoration cannot produce
    // negative geometry when the presentation has nothing to enclose.
    auto tiny = plain;
    tiny["nodes"] = QJsonArray{record("root")};
    caps = tiny["capabilities"].toObject();
    auto presentation = caps["presentation/1"].toObject();
    presentation["styles"] = QJsonObject{{"block", QJsonObject{{"minWidth", 0}, {"minHeight", 0},
                                                             {"paddingX", 0}, {"paddingY", 0}, {"square", false}}}};
    caps["presentation/1"] = presentation;
    appearance["nodeStyles"] = QJsonObject{{"root", QJsonObject{}}};
    caps["appearance/1"] = appearance;
    tiny["capabilities"] = caps;
    check(load(tiny)->groups()[0].borders.empty(), "zero-sized node has no border geometry");

    auto invalidAppearance = [&](const QJsonObject &payload, const char *message) {
        auto malformed = source;
        auto malformedCaps = malformed["capabilities"].toObject();
        malformedCaps["appearance/1"] = payload;
        malformed["capabilities"] = malformedCaps;
        rejects(malformed, message);
    };
    const auto valid = source["capabilities"].toObject()["appearance/1"].toObject();
    for (const auto *key : {"defaults", "nodeStyles", "pageBackgroundColor", "pageBackgroundAlpha"}) {
        auto bad = valid; bad.remove(key);
        invalidAppearance(bad, "all appearance top-level fields required");
    }
    auto bad = valid; bad["extra"] = 1;
    invalidAppearance(bad, "unknown appearance field rejected");
    bad = valid; bad["nodeStyles"] = QJsonArray{};
    invalidAppearance(bad, "nodeStyles must be object");
    bad = valid; bad["nodeStyles"] = QJsonObject{{"absent", QJsonObject{}}};
    invalidAppearance(bad, "dangling appearance ID rejected");
    bad = valid; bad["nodeStyles"] = QJsonObject{{"__proto__", QJsonObject{}}};
    invalidAppearance(bad, "opaque dangling appearance ID rejected");
    bad = valid; bad["nodeStyles"] = QJsonObject{{"root", QJsonObject{{"fontSize", 12}}}};
    invalidAppearance(bad, "unknown sparse style field rejected");
    bad = valid; bad["nodeStyles"] = QJsonObject{{"root", QJsonArray{}}};
    invalidAppearance(bad, "node override must be object");
    for (const auto *name : {"background", "border", "text", "line"}) {
        for (const auto &suffix : {QString("Color"), QString("Alpha")}) {
            bad = valid;
            auto defaults = bad["defaults"].toObject(); defaults.remove(QString(name) + suffix);
            bad["defaults"] = defaults;
            invalidAppearance(bad, "all eight default color and alpha fields required");
        }
        for (const auto &entry : QJsonArray{"red", "#abc", "#11223344", "#12gg00", "rgb(1,2,3)", "#１２３４５６", 12, false, QJsonValue()}) {
            bad = valid;
            auto defaults = bad["defaults"].toObject(); defaults[QString(name) + "Color"] = entry;
            bad["defaults"] = defaults;
            invalidAppearance(bad, "default colors require exact ASCII hex6");
            bad = valid; bad["nodeStyles"] = QJsonObject{{"root", QJsonObject{{QString(name) + "Color", entry}}}};
            invalidAppearance(bad, "override colors require exact ASCII hex6");
            bad = valid; bad["pageBackgroundColor"] = entry;
            invalidAppearance(bad, "page color requires exact ASCII hex6");
        }
        for (const auto &entry : QJsonArray{-0.1, 1.1, "0.5", false, QJsonValue(),
                                            std::numeric_limits<double>::infinity(),
                                            std::numeric_limits<double>::quiet_NaN()}) {
            bad = valid;
            auto defaults = bad["defaults"].toObject(); defaults[QString(name) + "Alpha"] = entry;
            bad["defaults"] = defaults;
            invalidAppearance(bad, "default alpha requires finite number in range");
            bad = valid; bad["nodeStyles"] = QJsonObject{{"root", QJsonObject{{QString(name) + "Alpha", entry}}}};
            invalidAppearance(bad, "override alpha requires finite number in range");
            bad = valid; bad["pageBackgroundAlpha"] = entry;
            invalidAppearance(bad, "page alpha requires finite number in range");
        }
    }
    bad = valid; auto defaults = bad["defaults"].toObject(); defaults["unknown"] = 0;
    bad["defaults"] = defaults;
    invalidAppearance(bad, "unknown default style field rejected");
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
        appearances();
        textAndContainment();
        std::cout << "Qt document: geometry fixtures, paint-group flattening, appearance, text, containment, and validation passed\n";
        return 0;
    } catch (const std::exception &error) {
        std::cerr << "Qt document test: " << error.what() << '\n';
        return 1;
    }
}
