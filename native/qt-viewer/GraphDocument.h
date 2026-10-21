#ifndef PARSEGRAPH_QT_GRAPH_DOCUMENT_H
#define PARSEGRAPH_QT_GRAPH_DOCUMENT_H

#include <QByteArray>
#include <QColor>
#include <QFont>
#include <QPointF>
#include <QRectF>
#include <QStringList>
#include <cstddef>
#include <memory>
#include <vector>

namespace pgqt {

struct PaintRect { QRectF rect; QColor color; };
struct Label {
    QString text;
    QPointF origin;
    qreal scale = 1;
    QColor color;
};
struct PaintGroup {
    QString id;
    QPointF position;
    qreal scale = 1;
    QRectF bounds;
    std::vector<PaintRect> lines, bodies, borders;
    std::vector<Label> labels;
};
struct NodeVisual {
    QString id;
    QString text;
    QString groupId;
    QRectF bounds;
    QRectF extents;
};

// An immutable drawing snapshot. Loading, measurement, and C layout happen on
// the GUI thread; render-thread consumers never touch native graph storage.
class GraphDocument {
public:
    // Requires QGuiApplication. Throws std::runtime_error for invalid documents
    // or unsupported core versions/content. Unknown capabilities are reported.
    static std::shared_ptr<GraphDocument> fromJson(
        const QByteArray &json, bool deterministicMetrics = false);
    ~GraphDocument();
    const std::vector<PaintGroup> &groups() const;
    const std::vector<NodeVisual> &nodes() const;
    QRectF bounds() const;
    QFont font() const;
    qreal lineHeight() const;
    // Carries the page alpha through to the host surface; never precomposited.
    QColor pageBackgroundColor() const;
    QStringList ignoredCapabilities() const;
    const NodeVisual *hitTest(QPointF world) const;

private:
    friend class PrimesSession;
    struct Data;
    explicit GraphDocument(std::unique_ptr<Data> data);
    std::unique_ptr<Data> data_;
};

struct PrimesMetrics {
    double generationMs = 0, layoutMs = 0, snapshotMs = 0;
    size_t nodesCommitted = 0, nodesMeasured = 0, cleanSubtreesSkipped = 0;
    size_t workUnits = 0, restarts = 0;
};

// An append-only native graph, owned by the GUI thread. Its drawing snapshots
// remain independent of subsequent changes and can be consumed by Qt Quick's
// render thread. Cell dimensions use the limit throughout the session, so
// crossing a decimal digit boundary does not change previously measured cells.
class PrimesSession {
public:
    explicit PrimesSession(int sizingLimit);
    ~PrimesSession();
    // Throws std::invalid_argument unless count() <= count <= limit(). Native
    // allocation/layout failures may mutate the graph; discard this session
    // after such a failure. Existing snapshots remain valid in all cases.
    std::shared_ptr<GraphDocument> growTo(int count);
    int count() const;
    int limit() const;
    const PrimesMetrics &metrics() const;

private:
    struct Data;
    std::unique_ptr<Data> data_;
};

} // namespace pgqt
#endif
