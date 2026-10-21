#ifndef PARSEGRAPH_QT_GRAPH_VIEW_H
#define PARSEGRAPH_QT_GRAPH_VIEW_H

#include <QQuickItem>
#include <QStringList>
#include <QVariantMap>
#include <atomic>
#include <memory>

namespace pgqt {

class GraphDocument;
class PrimesSession;

// The GUI thread loads and lays out documents. updatePaintNode consumes only
// immutable drawing data and owns all scene graph objects on the render thread.
class GraphView : public QQuickItem {
    Q_OBJECT
    Q_PROPERTY(QString source READ source WRITE setSource NOTIFY sourceChanged)
    Q_PROPERTY(QString error READ error NOTIFY errorChanged)
    Q_PROPERTY(int nodeCount READ nodeCount NOTIFY documentChanged)
    Q_PROPERTY(int groupCount READ groupCount NOTIFY documentChanged)
    Q_PROPERTY(QStringList ignoredCapabilities READ ignoredCapabilities NOTIFY documentChanged)
    Q_PROPERTY(QString selectedId READ selectedId NOTIFY selectionChanged)
    Q_PROPERTY(QString selectedText READ selectedText NOTIFY selectionChanged)
    Q_PROPERTY(qreal zoom READ zoom NOTIFY zoomChanged)
    Q_PROPERTY(bool showGroups READ showGroups WRITE setShowGroups NOTIFY showGroupsChanged)
    Q_PROPERTY(bool showExtents READ showExtents WRITE setShowExtents NOTIFY showExtentsChanged)
    Q_PROPERTY(qulonglong geometryBuildCount READ geometryBuildCount NOTIFY geometryBuildCountChanged)
    Q_PROPERTY(qreal lastSceneBuildMs READ lastSceneBuildMs NOTIFY geometryBuildCountChanged)
    Q_PROPERTY(int primeCount READ primeCount NOTIFY documentChanged)
    Q_PROPERTY(int primeLimit READ primeLimit NOTIFY documentChanged)
    Q_PROPERTY(QVariantMap demoBuildStats READ demoBuildStats NOTIFY documentChanged)

public:
    explicit GraphView(QQuickItem *parent = nullptr);
    ~GraphView() override;
    QString source() const { return source_; }
    void setSource(const QString &source);
    QString error() const { return error_; }
    int nodeCount() const;
    int groupCount() const;
    QStringList ignoredCapabilities() const;
    QString selectedId() const { return selectedId_; }
    QString selectedText() const { return selectedText_; }
    qreal zoom() const { return zoom_; }
    bool showGroups() const { return showGroups_; }
    void setShowGroups(bool visible);
    bool showExtents() const { return showExtents_; }
    void setShowExtents(bool visible);
    qulonglong geometryBuildCount() const { return geometryBuildCount_.load(); }
    qreal lastSceneBuildMs() const { return lastSceneBuildMs_.load(); }
    int primeCount() const { return primeCount_; }
    int primeLimit() const { return primeLimit_; }
    QVariantMap demoBuildStats() const { return demoBuildStats_; }

    Q_INVOKABLE bool loadPrimes(int count, int sizingLimit = 1000);
    Q_INVOKABLE bool growPrimes(int targetCount);
    Q_INVOKABLE void fitGraph();
    Q_INVOKABLE void zoomIn();
    Q_INVOKABLE void zoomOut();
    Q_INVOKABLE void panBy(qreal dx, qreal dy);
    Q_INVOKABLE void selectAt(qreal x, qreal y);
    Q_INVOKABLE QPointF graphToView(QPointF world) const;
    Q_INVOKABLE QPointF viewToGraph(QPointF view) const;

signals:
    void sourceChanged();
    void errorChanged();
    void documentChanged();
    void selectionChanged();
    void zoomChanged();
    void showGroupsChanged();
    void showExtentsChanged();
    void geometryBuildCountChanged();

protected:
    QSGNode *updatePaintNode(QSGNode *oldNode, UpdatePaintNodeData *) override;
    void geometryChange(const QRectF &newGeometry, const QRectF &oldGeometry) override;
    void mousePressEvent(QMouseEvent *event) override;
    void mouseMoveEvent(QMouseEvent *event) override;
    void mouseReleaseEvent(QMouseEvent *event) override;
    void mouseDoubleClickEvent(QMouseEvent *event) override;
    void mouseUngrabEvent() override;
    void wheelEvent(QWheelEvent *event) override;
    void keyPressEvent(QKeyEvent *event) override;
    bool event(QEvent *event) override;

private:
    void setError(const QString &error);
    void zoomAt(qreal factor, QPointF anchor);
    void clearSelection();
    void updateOverlays();
    void acceptPrimesDocument(std::shared_ptr<GraphDocument> document, bool coldStart,
                              qreal totalMs);

    std::shared_ptr<GraphDocument> document_;
    std::unique_ptr<PrimesSession> primes_;
    QVariantMap demoBuildStats_;
    int primeCount_ = 0;
    int primeLimit_ = 0;
    QString source_, error_, selectedId_, selectedText_;
    QPointF pan_, pressPosition_, lastPosition_;
    qreal zoom_ = 1;
    bool autoFit_ = true;
    bool pressed_ = false;
    bool dragged_ = false;
    bool showGroups_ = false;
    bool showExtents_ = false;
    quint64 documentRevision_ = 1;
    quint64 overlayRevision_ = 1;
    std::atomic<qulonglong> geometryBuildCount_ {0};
    std::atomic<qreal> lastSceneBuildMs_ {0};
};

} // namespace pgqt
#endif
