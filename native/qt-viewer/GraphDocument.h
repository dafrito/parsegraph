#ifndef PARSEGRAPH_QT_GRAPH_DOCUMENT_H
#define PARSEGRAPH_QT_GRAPH_DOCUMENT_H

#include <QByteArray>
#include <QColor>
#include <QFont>
#include <QPointF>
#include <QRectF>
#include <QStringList>
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
    std::vector<PaintRect> lines, bodies;
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
    QStringList ignoredCapabilities() const;
    const NodeVisual *hitTest(QPointF world) const;

private:
    struct Data;
    explicit GraphDocument(std::unique_ptr<Data> data);
    std::unique_ptr<Data> data_;
};

} // namespace pgqt
#endif
