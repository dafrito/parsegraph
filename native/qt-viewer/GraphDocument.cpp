#include "GraphDocument.h"

#include "parsegraph/layout.h"
#include "parsegraph/paint.h"
#include "primes.h"
#include <QGuiApplication>
#include <QFontDatabase>
#include <QHash>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QScreen>
#include <QSet>
#include <QTextLayout>
#include <algorithm>
#include <array>
#include <cmath>
#include <chrono>
#include <limits>
#include <stdexcept>

namespace pgqt {
namespace {

[[noreturn]] void fail(const QString &message) {
    throw std::runtime_error(message.toStdString());
}
void require(bool condition, const QString &message) {
    if (!condition) fail("Invalid parsegraph v1: " + message);
}
void checked(pg_status status, const char *operation) {
    if (status != PG_OK)
        fail(QString("Native layout failed during %1 (status %2)")
                 .arg(operation).arg(static_cast<int>(status)));
}
QJsonObject object(const QJsonValue &value, const QString &what) {
    require(value.isObject(), what + " must be an object");
    return value.toObject();
}
void fields(const QJsonObject &obj, const QStringList &required,
            const QStringList &optional = {}) {
    for (const auto &key : required)
        require(obj.contains(key), "missing " + key);
    for (auto it = obj.begin(); it != obj.end(); ++it)
        require(required.contains(it.key()) || optional.contains(it.key()),
                "unknown field " + it.key());
}
QString nonempty(const QJsonValue &value, const QString &what) {
    require(value.isString() && !value.toString().isEmpty(),
            what + " must be a nonempty string");
    return value.toString();
}
double number(const QJsonValue &value, const QString &what, bool positive = false) {
    const double result = value.toDouble(std::numeric_limits<double>::quiet_NaN());
    require(value.isDouble() && std::isfinite(result) &&
                (positive ? result > 0 : result >= 0),
            what + " must be a finite " + (positive ? "positive" : "nonnegative") + " number");
    return result;
}
QString choice(const QJsonValue &value, const QStringList &choices, const QString &what) {
    require(value.isString() && choices.contains(value.toString()),
            "unknown " + what);
    return value.toString();
}
bool boolean(const QJsonValue &value, const QString &what) {
    require(value.isBool(), what + " must be boolean");
    return value.toBool();
}
void validateDepth(const QJsonValue &value, int depth = 0) {
    require(depth <= 100, "JSON nesting exceeds 100 levels");
    if (value.isArray()) {
        for (const auto &child : value.toArray()) validateDepth(child, depth + 1);
    } else if (value.isObject()) {
        const auto obj = value.toObject();
        for (auto it = obj.begin(); it != obj.end(); ++it) validateDepth(it.value(), depth + 1);
    }
}

// Qt emits shortest JSON doubles, but may choose exponential notation at
// different thresholds than JSON.stringify. Normalize those thresholds and
// exponent zeros to the standard text policy used by the TypeScript viewer.
QString numericText(const QJsonValue &value) {
    if (value.toDouble() == 0) return "0";
    // Qt can retain an int64 JSON token beyond JavaScript's exact integer
    // range. Use its double value to match the document's TypeScript reader.
    QByteArray encoded = QJsonDocument(QJsonArray{value.toDouble()}).toJson(QJsonDocument::Compact);
    QString text = QString::fromUtf8(encoded.mid(1, encoded.size() - 2));
    const int exponentAt = text.indexOf('e', 0, Qt::CaseInsensitive);
    if (exponentAt < 0) return text;
    const int exponent = text.mid(exponentAt + 1).toInt();
    QString mantissa = text.left(exponentAt);
    const QString sign = mantissa.startsWith('-') ? "-" : "";
    if (!sign.isEmpty()) mantissa.remove(0, 1);
    const int dot = mantissa.indexOf('.');
    const int decimal = (dot < 0 ? mantissa.size() : dot) + exponent;
    mantissa.remove('.');
    if (decimal > 0 && decimal <= 21) {
        if (decimal >= mantissa.size())
            return sign + mantissa + QString(decimal - mantissa.size(), '0');
        return sign + mantissa.left(decimal) + '.' + mantissa.mid(decimal);
    }
    if (decimal <= 0 && decimal > -6)
        return sign + "0." + QString(-decimal, '0') + mantissa;
    QString normalized = mantissa.left(1);
    if (mantissa.size() > 1) normalized += '.' + mantissa.mid(1);
    const int adjustedExponent = decimal - 1;
    return sign + normalized + 'e' + (adjustedExponent >= 0 ? "+" : "") +
           QString::number(adjustedExponent);
}

struct Style {
    double minWidth = 10, minHeight = 15, paddingX = 3, paddingY = 2.5;
    bool square = false;
};
struct Presentation {
    QString family = "sans-serif";
    double fontSize = 10, lineHeight = 10;
    QHash<QString, Style> styles{{"block", Style{}}};
    QString defaultStyle = "block";
    QHash<QString, QString> nodeStyles;
    double horizontal = 5, vertical = 5, inward = 5;
    double verticalStep = 0;
};
Presentation presentationFromJson(const QJsonValue &value, const QHash<QString, size_t> &ids) {
    const auto obj = object(value, "presentation/1");
    fields(obj, {"text", "styles", "defaultStyle", "nodeStyles", "spacing"});
    Presentation result;
    const auto text = object(obj["text"], "text");
    fields(text, {"fontFamily", "fontSize", "lineHeight"});
    result.family = nonempty(text["fontFamily"], "fontFamily");
    require(!result.family.trimmed().isEmpty(), "fontFamily cannot be blank");
    result.fontSize = number(text["fontSize"], "fontSize", true);
    result.lineHeight = number(text["lineHeight"], "lineHeight", true);
    result.styles.clear();
    const auto styles = object(obj["styles"], "styles");
    require(!styles.isEmpty(), "styles cannot be empty");
    for (auto it = styles.begin(); it != styles.end(); ++it) {
        require(!it.key().isEmpty(), "style name cannot be empty");
        const auto style = object(it.value(), "style");
        fields(style, {"minWidth", "minHeight", "paddingX", "paddingY", "square"});
        result.styles.insert(it.key(), {
            number(style["minWidth"], "minWidth"), number(style["minHeight"], "minHeight"),
            number(style["paddingX"], "paddingX"), number(style["paddingY"], "paddingY"),
            boolean(style["square"], "square")});
    }
    result.defaultStyle = nonempty(obj["defaultStyle"], "defaultStyle");
    require(result.styles.contains(result.defaultStyle), "defaultStyle must reference a style");
    const auto assignments = object(obj["nodeStyles"], "nodeStyles");
    for (auto it = assignments.begin(); it != assignments.end(); ++it) {
        require(ids.contains(it.key()), "nodeStyles references missing node " + it.key());
        const auto style = nonempty(it.value(), "node style");
        require(result.styles.contains(style), "nodeStyles references missing style " + style);
        result.nodeStyles.insert(it.key(), style);
    }
    const auto spacing = object(obj["spacing"], "spacing");
    fields(spacing, {"horizontal", "vertical", "inward"}, {"verticalStep"});
    result.horizontal = number(spacing["horizontal"], "horizontal spacing");
    result.vertical = number(spacing["vertical"], "vertical spacing");
    result.inward = number(spacing["inward"], "inward spacing");
    if (spacing.contains("verticalStep"))
        result.verticalStep = number(spacing["verticalStep"], "verticalStep", true);
    return result;
}

struct Record {
    QString id, parentId, text;
    bool root = false, hasLabel = false, crease = false, rtl = false;
    pg_direction parentDir = PG_DIRECTION_NONE;
    pg_fit fit = PG_FIT_LOOSE;
    pg_preferred_axis preference = PG_PREFERRED_HORIZONTAL;
    pg_alignment alignment = PG_ALIGN_NONE;
    pg_axis_overlap overlap = PG_OVERLAP_DEFAULT;
    double scale = 1;
    double textWidth = 0, textHeight = 0;
    Style style;
    pg_node *node = nullptr;
    std::array<size_t, 6> children;
    Record() { children.fill(std::numeric_limits<size_t>::max()); }
};
struct NativeNodes {
    std::vector<pg_node *> values;
    ~NativeNodes() { for (auto *node : values) pg_node_free(node); }
};
struct LayoutContext { const Presentation *presentation; };

pg_status measure(pg_node *node, double out[2], void *opaque) {
    const auto &record = *static_cast<Record *>(pg_node_value(node));
    const auto &presentation = *static_cast<LayoutContext *>(opaque)->presentation;
    double width = record.textWidth, height = record.textHeight;
    if (auto *child = pg_node_child(node, PG_INWARD)) {
        double extent[2];
        const auto status = pg_node_extent_size(child, extent);
        if (status != PG_OK) return status;
        const double childWidth = extent[0] * pg_node_scale(child);
        const double childHeight = extent[1] * pg_node_scale(child);
        if (pg_node_alignment(node, PG_INWARD) == PG_ALIGN_INWARD_VERTICAL) {
            width = std::max(width, childWidth);
            height += childHeight + presentation.inward;
        } else {
            width += childWidth + presentation.inward;
            height = std::max(height, childHeight);
        }
    }
    out[0] = std::max(record.style.minWidth, width + 2 * record.style.paddingX);
    out[1] = std::max(record.style.minHeight, height + 2 * record.style.paddingY);
    if (record.style.square) out[0] = out[1] = std::max(out[0], out[1]);
    return std::isfinite(out[0]) && std::isfinite(out[1]) ? PG_OK : PG_RANGE;
}
double separation(pg_node *node, pg_axis axis, pg_direction direction, bool, void *opaque) {
    const auto &presentation = *static_cast<LayoutContext *>(opaque)->presentation;
    if (axis == PG_Z) return presentation.inward;
    if (axis == PG_HORIZONTAL) return presentation.horizontal;
    double gap = presentation.vertical;
    if (presentation.verticalStep > 0) {
        auto *child = pg_node_child(node, direction);
        double parentSize[2], childSize[2];
        if (!child || measure(node, parentSize, opaque) != PG_OK ||
            measure(child, childSize, opaque) != PG_OK)
            return std::numeric_limits<double>::quiet_NaN();
        const double scale = pg_node_scale(child);
        gap = std::max(gap, (presentation.verticalStep - parentSize[1] / 2 -
                            childSize[1] * scale / 2) / scale);
    }
    return gap;
}
QRectF rect(double x, double y, double width, double height) {
    const QRectF result(x - width / 2, y - height / 2, width, height);
    require(std::isfinite(result.left()) && std::isfinite(result.top()) &&
                std::isfinite(result.right()) && std::isfinite(result.bottom()),
            "geometry exceeds finite coordinates");
    return result;
}
QRectF worldRect(const QRectF &local, const pg_transform &transform) {
    return rect(transform.x + local.center().x() * transform.scale,
                transform.y + local.center().y() * transform.scale,
                local.width() * transform.scale, local.height() * transform.scale);
}
struct RectSink { std::vector<PaintRect> *rects; QColor color; };
void collectRect(double x, double y, double width, double height, void *opaque) {
    auto &sink = *static_cast<RectSink *>(opaque);
    sink.rects->push_back({rect(x, y, width, height), sink.color});
}

struct DrawingRecord {
    QString id, text;
    bool hasLabel = false, slot = false;
    double textWidth = 0, textHeight = 0;
    Style style;
};

// Both document loading and direct generators finish at this boundary. The
// resulting snapshots contain no pointers into mutable native graph storage.
template<typename Snapshot, typename Metadata>
void collectSnapshot(Snapshot &data, pg_node *root, size_t nodeCount, Metadata metadata) {
    const QColor bodyColor("#183646"), slotColor("#dbe6e8"),
                 lineColor("#789694"), labelColor("#f4f6ee");
    const double lineThickness = 1;
    QHash<pg_node *, size_t> groupIndexes;
    bool haveBounds = false;
    for (auto *groupNode = root; groupNode; groupNode = pg_node_next_paint_group(groupNode, root)) {
        const auto record = metadata(groupNode);
        pg_transform absolute;
        checked(pg_node_absolute_transform(groupNode, &absolute), "paint-group transform");
        pg_rect groupBounds;
        checked(pg_paint_group_bounds(groupNode, lineThickness, &groupBounds), "paint-group bounds");
        PaintGroup group;
        group.id = record.id;
        group.position = QPointF(absolute.x, absolute.y);
        group.scale = absolute.scale;
        group.bounds = rect(groupBounds.x, groupBounds.y, groupBounds.width, groupBounds.height);
        const auto worldBounds = worldRect(group.bounds, absolute);
        data.bounds = haveBounds ? data.bounds.united(worldBounds) : worldBounds;
        haveBounds = true;
        groupIndexes.insert(groupNode, data.groups.size());
        data.groups.push_back(std::move(group));
    }
    data.nodes.reserve(nodeCount);
    for (auto *node = root; node; node = pg_node_next_preorder(node, root)) {
        const auto record = metadata(node);
        auto &group = data.groups[groupIndexes.value(pg_node_paint_group(node))];
        RectSink lineSink{&group.lines, lineColor}, bodySink{&group.bodies, record.slot ? slotColor : bodyColor};
        checked(pg_paint_node_lines(node, lineThickness, collectRect, &lineSink), "connector geometry");
        checked(pg_paint_node_bounds(node, collectRect, &bodySink), "body geometry");
        pg_transform absolute, local;
        checked(pg_node_absolute_transform(node, &absolute), "node transform");
        checked(pg_node_group_transform(node, &local), "node group transform");
        double size[2], extent[2];
        checked(pg_node_size(node, size), "node size");
        checked(pg_node_extent_size(node, extent), "extent size");
        const QRectF bounds = rect(absolute.x, absolute.y, size[0] * absolute.scale, size[1] * absolute.scale);
        const double offsetX = pg_extent_offset(pg_node_extent(node, PG_DOWNWARD));
        const double offsetY = pg_extent_offset(pg_node_extent(node, PG_FORWARD));
        const QRectF extents = rect(absolute.x + (extent[0] / 2 - offsetX) * absolute.scale,
                                   absolute.y + (extent[1] / 2 - offsetY) * absolute.scale,
                                   extent[0] * absolute.scale, extent[1] * absolute.scale);
        data.nodes.push_back({record.id, record.text, group.id, bounds, extents});
        if (record.hasLabel && !record.text.isEmpty()) {
            double left = -record.textWidth / 2, top = -record.textHeight / 2;
            if (pg_node_child(node, PG_INWARD)) {
                if (pg_node_alignment(node, PG_INWARD) == PG_ALIGN_INWARD_VERTICAL)
                    top = -size[1] / 2 + record.style.paddingY;
                else left = -size[0] / 2 + record.style.paddingX;
            }
            group.labels.push_back({record.text,
                QPointF(local.x + left * local.scale, local.y + top * local.scale),
                local.scale, labelColor});
        }
    }
}

QFont presentationFont(const Presentation &presentation) {
    require(presentation.fontSize <= 16384,
            "this viewer supports fontSize up to 16384 logical units");
    QFont font;
    font.setFamily(presentation.family == "sans-serif"
        ? QFontDatabase::systemFont(QFontDatabase::GeneralFont).family()
        : presentation.family);
    font.setWeight(QFont::Normal);
    font.setStyle(QFont::StyleNormal);
    // Point sizing preserves fractional logical sizes on the default screen.
    const auto *screen = QGuiApplication::primaryScreen();
    const double dpi = screen ? screen->logicalDotsPerInchY() : 96;
    font.setPointSizeF(presentation.fontSize * 72 / dpi);
    return font;
}

double shapedWidth(const QString &line, const QFont &font) {
    if (line.isEmpty()) return 0;
    QTextLayout layout(line, font);
    QTextOption option;
    option.setWrapMode(QTextOption::NoWrap);
    option.setFlags(QTextOption::IncludeTrailingSpaces);
    layout.setTextOption(option);
    layout.beginLayout();
    auto shapedLine = layout.createLine();
    double width = 0;
    if (shapedLine.isValid()) {
        // createLine alone leaves text unlaid-out. NoWrap keeps a complete line.
        shapedLine.setLineWidth(1e9);
        width = shapedLine.naturalTextWidth();
    }
    layout.endLayout();
    require(std::isfinite(width) && width >= 0, "invalid shaped text width");
    return width;
}

using Clock = std::chrono::steady_clock;
double milliseconds(Clock::time_point start, Clock::time_point end) {
    return std::chrono::duration<double, std::milli>(end - start).count();
}

} // namespace

struct GraphDocument::Data {
    std::vector<PaintGroup> groups;
    std::vector<NodeVisual> nodes;
    QRectF bounds;
    QFont font;
    qreal lineHeight = 10;
    QStringList ignored;
};

GraphDocument::GraphDocument(std::unique_ptr<Data> data) : data_(std::move(data)) {}
GraphDocument::~GraphDocument() = default;
const std::vector<PaintGroup> &GraphDocument::groups() const { return data_->groups; }
const std::vector<NodeVisual> &GraphDocument::nodes() const { return data_->nodes; }
QRectF GraphDocument::bounds() const { return data_->bounds; }
QFont GraphDocument::font() const { return data_->font; }
qreal GraphDocument::lineHeight() const { return data_->lineHeight; }
QStringList GraphDocument::ignoredCapabilities() const { return data_->ignored; }
const NodeVisual *GraphDocument::hitTest(QPointF world) const {
    if (!std::isfinite(world.x()) || !std::isfinite(world.y())) return nullptr;
    // Ancestors are stored before descendants, so inward contents win over
    // their containing body. No layout or native graph mutation is needed.
    for (auto it = data_->nodes.rbegin(); it != data_->nodes.rend(); ++it)
        if (it->bounds.contains(world)) return &*it;
    return nullptr;
}

std::shared_ptr<GraphDocument> GraphDocument::fromJson(const QByteArray &json,
                                                     bool deterministicMetrics) {
    require(qobject_cast<QGuiApplication *>(QCoreApplication::instance()) != nullptr,
            "QGuiApplication must exist before loading a document");
    QJsonParseError error;
    const auto parsed = QJsonDocument::fromJson(json, &error);
    require(error.error == QJsonParseError::NoError, "JSON: " + error.errorString());
    require(parsed.isObject(), "document must be an object");
    const auto envelope = parsed.object();
    require(envelope["format"].toString() == "parsegraph" &&
                envelope["version"].isDouble() && envelope["version"].toDouble() == 1,
            "this proof of concept reads version 1 documents only");
    validateDepth(envelope);
    fields(envelope, {"format", "version", "root", "nodes", "capabilities"}, {"metadata"});
    const auto rootId = nonempty(envelope["root"], "root");
    const auto capabilities = object(envelope["capabilities"], "capabilities");
    if (envelope.contains("metadata")) object(envelope["metadata"], "metadata");
    require(envelope["nodes"].isArray() && !envelope["nodes"].toArray().isEmpty(),
            "nodes must be a nonempty array");
    const auto inputNodes = envelope["nodes"].toArray();
    std::vector<Record> records(static_cast<size_t>(inputNodes.size()));
    QHash<QString, size_t> ids;
    size_t rootIndex = std::numeric_limits<size_t>::max();
    for (size_t i = 0; i < records.size(); ++i) {
        const auto node = object(inputNodes[static_cast<qsizetype>(i)], "node");
        fields(node, {"id", "scale", "fit", "layoutPreference", "parentId", "parentDir",
                      "alignment", "axisOverlap", "rightToLeft", "paintGroup"}, {"value"});
        auto &record = records[i];
        record.id = nonempty(node["id"], "node id");
        require(!ids.contains(record.id), "duplicate node id " + record.id);
        ids.insert(record.id, i);
        record.scale = number(node["scale"], "scale", true);
        record.fit = pg_fit_read(choice(node["fit"], {"exact", "loose", "naive"}, "fit").toUtf8().constData());
        record.preference = pg_preferred_axis_read(choice(node["layoutPreference"],
            {"parent", "perpendicular", "horizontal", "vertical"}, "layoutPreference").toUtf8().constData());
        const QStringList alignments{
            "none", "negative", "center", "positive", "inward-horizontal", "inward-vertical"};
        record.alignment = static_cast<pg_alignment>(PG_ALIGN_NONE + alignments.indexOf(
            choice(node["alignment"], alignments, "alignment")));
        record.overlap = pg_axis_overlap_read(choice(node["axisOverlap"],
            {"allowed", "prevented", "default"}, "axisOverlap").toUtf8().constData());
        record.rtl = boolean(node["rightToLeft"], "rightToLeft");
        record.crease = boolean(node["paintGroup"], "paintGroup");
        record.root = node["parentId"].isNull();
        if (record.root) {
            require(rootIndex == std::numeric_limits<size_t>::max(), "more than one root");
            rootIndex = i;
            require(node["parentDir"].isNull() && record.alignment == PG_ALIGN_NONE &&
                        record.overlap == PG_OVERLAP_DEFAULT &&
                        (record.preference == PG_PREFERRED_HORIZONTAL || record.preference == PG_PREFERRED_VERTICAL),
                    "invalid root connection fields or layout preference");
        } else {
            record.parentId = nonempty(node["parentId"], "parentId");
            record.parentDir = pg_direction_read(choice(node["parentDir"],
                {"outward", "downward", "upward", "forward", "backward"}, "parentDir").toUtf8().constData());
            const bool inward = record.alignment == PG_ALIGN_INWARD_HORIZONTAL ||
                                record.alignment == PG_ALIGN_INWARD_VERTICAL;
            require(record.parentDir == PG_OUTWARD
                        ? record.alignment == PG_ALIGN_NONE || inward : !inward,
                    "alignment does not match connection direction");
        }
        if (node.contains("value")) {
            const auto value = node["value"];
            require(value.isString() || value.isDouble(),
                    "this viewer supports string and number content only (node " + record.id + ')');
            record.hasLabel = true;
            record.text = value.isString() ? value.toString() : numericText(value);
            record.text.replace("\r\n", "\n").replace('\r', '\n');
        }
    }
    require(rootIndex != std::numeric_limits<size_t>::max() && records[rootIndex].id == rootId,
            "declared root does not match the unique root node");
    for (size_t i = 0; i < records.size(); ++i) {
        const auto &record = records[i];
        if (record.root) continue;
        require(ids.contains(record.parentId) && record.parentId != record.id,
                "missing or self-referencing parent for " + record.id);
        auto &parent = records[ids.value(record.parentId)];
        const auto direction = pg_direction_reverse(record.parentDir);
        require(parent.children[direction] == std::numeric_limits<size_t>::max(),
                "two children occupy the same direction on " + parent.id);
        require(parent.root || direction != parent.parentDir,
                "child conflicts with parent's own parent direction");
        parent.children[direction] = i;
    }
    // Validate reachability before using the C API's intentionally tolerant
    // replacement/reparent operations. Iterative traversal accepts deep trees.
    std::vector<size_t> order{rootIndex};
    for (size_t cursor = 0; cursor < order.size(); ++cursor) {
        for (const auto child : records[order[cursor]].children)
            if (child != std::numeric_limits<size_t>::max()) order.push_back(child);
        require(order.size() <= records.size(), "cycle in node topology");
    }
    require(order.size() == records.size(), "nodes contain a disconnected cycle");

    auto data = std::make_unique<Data>();
    Presentation presentation;
    for (auto it = capabilities.begin(); it != capabilities.end(); ++it) {
        require(!it.key().isEmpty(), "capability names cannot be empty");
        if (it.key() == "presentation/1") presentation = presentationFromJson(it.value(), ids);
        else data->ignored.append(it.key());
    }
    data->lineHeight = presentation.lineHeight;
    data->font = presentationFont(presentation);
    for (auto &record : records) {
        const auto style = presentation.nodeStyles.value(record.id, presentation.defaultStyle);
        record.style = presentation.styles.value(style);
        if (!record.hasLabel) continue;
        const auto lines = record.text.split('\n', Qt::KeepEmptyParts);
        record.textHeight = static_cast<double>(lines.size()) * presentation.lineHeight;
        for (const auto &line : lines) {
            double width = 0;
            if (deterministicMetrics) width = static_cast<double>(line.toUcs4().size()) * 6;
            else width = shapedWidth(line, data->font);
            require(std::isfinite(width) && width >= 0, "invalid shaped text width");
            record.textWidth = std::max(record.textWidth, width);
        }
    }

    NativeNodes owned;
    owned.values.reserve(records.size());
    for (auto &record : records) {
        record.node = pg_node_new(&record);
        if (!record.node) throw std::bad_alloc();
        owned.values.push_back(record.node);
        checked(pg_node_set_scale(record.node, record.scale), "node scale");
        checked(pg_node_set_fit(record.node, record.fit), "node fit");
        checked(pg_node_set_right_to_left(record.node, record.rtl), "node direction");
        if (record.crease) checked(pg_node_crease(record.node), "paint group");
    }
    // Parent-first construction avoids repeatedly migrating assembled subtrees.
    for (const auto index : order) {
        auto &record = records[index];
        if (record.root) continue;
        auto *parent = records[ids.value(record.parentId)].node;
        const auto direction = pg_direction_reverse(record.parentDir);
        checked(pg_node_connect(parent, direction, record.node), "node connection");
        checked(pg_node_set_alignment(parent, direction, record.alignment), "alignment");
        checked(pg_node_set_overlap(parent, direction, record.overlap), "axis overlap");
    }
    // Like the TypeScript document reader, preferences apply after connection.
    for (const auto &record : records)
        checked(pg_node_set_preferred_axis(record.node, record.preference), "layout preference");
    auto *root = records[rootIndex].node;
    LayoutContext context{&presentation};
    const pg_layout_painter painter{measure, separation, &context};
    std::unique_ptr<pg_layout, decltype(&pg_layout_free)> layout(pg_layout_new(root, &painter), pg_layout_free);
    if (!layout) throw std::bad_alloc();
    checked(pg_layout_run(layout.get()), "layout");

    collectSnapshot(*data, root, records.size(), [](pg_node *node) {
        const auto &record = *static_cast<Record *>(pg_node_value(node));
        return DrawingRecord{record.id, record.text, record.hasLabel, false,
                             record.textWidth, record.textHeight, record.style};
    });
    return std::shared_ptr<GraphDocument>(new GraphDocument(std::move(data)));
}

struct PrimesSession::Data {
    // Destruction order is deliberate: a layout borrows its root and painter.
    std::unique_ptr<pg_primes, decltype(&pg_primes_free)> graph{nullptr, pg_primes_free};
    std::unique_ptr<pg_layout, decltype(&pg_layout_free)> layout{nullptr, pg_layout_free};
    int limit = 0;
    double side = 0;
    QFont font;
    QHash<QString, double> textWidths;
    PrimesMetrics metrics;

    static pg_status measure(pg_node *, double out[2], void *opaque) {
        const auto &data = *static_cast<Data *>(opaque);
        out[0] = out[1] = data.side;
        return PG_OK;
    }
    static double separation(pg_node *, pg_axis, pg_direction, bool, void *) {
        return 0;
    }
};

PrimesSession::PrimesSession(int sizingLimit) {
    if (sizingLimit < 1 || sizingLimit > 1000)
        throw std::invalid_argument("Primes limit must be between 1 and 1000");
    require(qobject_cast<QGuiApplication *>(QCoreApplication::instance()) != nullptr,
            "QGuiApplication must exist before creating a primes session");
    data_ = std::make_unique<Data>();
    data_->limit = sizingLimit;
    data_->graph.reset(pg_primes_new(sizingLimit));
    if (!data_->graph) throw std::bad_alloc();
    data_->side = pg_primes_cell_side(data_->graph.get());
    data_->font = presentationFont(Presentation{});
    const pg_layout_painter painter{Data::measure, Data::separation, data_.get()};
    data_->layout.reset(pg_layout_new(pg_primes_root(data_->graph.get()), &painter));
    if (!data_->layout) throw std::bad_alloc();
}
PrimesSession::~PrimesSession() = default;
int PrimesSession::count() const { return pg_primes_count(data_->graph.get()); }
int PrimesSession::limit() const { return data_->limit; }
const PrimesMetrics &PrimesSession::metrics() const { return data_->metrics; }

std::shared_ptr<GraphDocument> PrimesSession::growTo(int target) {
    if (target < count() || target > limit())
        throw std::invalid_argument("Primes count must be between the current count and session limit");
    const auto start = Clock::now();
    checked(pg_primes_append(data_->graph.get(), target), "primes generation");
    const auto generated = Clock::now();
    pg_layout_clear_metrics(data_->layout.get());
    checked(pg_layout_run(data_->layout.get()), "primes layout");
    const auto laidOut = Clock::now();
    pg_layout_metrics nativeMetrics;
    pg_layout_get_metrics(data_->layout.get(), &nativeMetrics);
    auto snapshot = std::make_unique<GraphDocument::Data>();
    snapshot->font = data_->font;
    snapshot->lineHeight = 10;
    collectSnapshot(*snapshot, pg_primes_root(data_->graph.get()),
                    pg_primes_node_count(data_->graph.get()), [this](pg_node *node) {
        const auto &record = *static_cast<const pg_primes_record *>(pg_node_value(node));
        const QString text = QString::fromLatin1(record.text);
        double width = 0;
        if (!text.isEmpty()) {
            auto it = data_->textWidths.constFind(text);
            if (it == data_->textWidths.cend()) {
                width = shapedWidth(text, data_->font);
                data_->textWidths.insert(text, width);
            } else width = *it;
        }
        return DrawingRecord{QString::fromLatin1(record.id), text, true, text.isEmpty(),
                             width, 10, {data_->side, data_->side, 3, 2.5, true}};
    });
    const auto captured = Clock::now();
    data_->metrics = {milliseconds(start, generated), milliseconds(generated, laidOut),
                      milliseconds(laidOut, captured),
                      static_cast<size_t>(nativeMetrics.nodes_committed),
                      static_cast<size_t>(nativeMetrics.nodes_measured),
                      static_cast<size_t>(nativeMetrics.clean_subtrees_skipped),
                      static_cast<size_t>(nativeMetrics.work_units),
                      static_cast<size_t>(nativeMetrics.restarts)};
    return std::shared_ptr<GraphDocument>(new GraphDocument(std::move(snapshot)));
}

} // namespace pgqt
