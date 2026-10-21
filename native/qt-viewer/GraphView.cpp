#include "GraphView.h"
#include "GraphDocument.h"
#include "primes.h"

#include <QCursor>
#include <QElapsedTimer>
#include <QFile>
#include <QGuiApplication>
#include <QKeyEvent>
#include <QMatrix4x4>
#include <QMouseEvent>
#include <QNativeGestureEvent>
#include <QQuickWindow>
#include <QSGGeometryNode>
#include <QSGTextNode>
#include <QSGTransformNode>
#include <QSGVertexColorMaterial>
#include <QStyleHints>
#include <QTextLayout>
#include <QUrl>
#include <QWheelEvent>
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace pgqt {
namespace {

constexpr qreal MinimumZoom = 0.00001;
constexpr qreal MaximumZoom = 10000;
// Leave headroom for the camera matrix and outline strokes. C layout uses
// doubles; Qt's public scene graph vertices and matrices use floats.
constexpr qreal RenderCoordinateLimit = std::numeric_limits<float>::max()
    / (MaximumZoom * 64);

bool renderable(qreal value)
{
    return std::isfinite(value) && std::abs(value) <= RenderCoordinateLimit
        && (value == 0 || float(value) != 0);
}

bool renderable(QPointF value) { return renderable(value.x()) && renderable(value.y()); }

bool renderable(const QRectF &rect)
{
    return renderable(rect.topLeft()) && renderable(rect.bottomRight())
        && renderable(rect.width()) && renderable(rect.height());
}

void validateDrawingRange(const GraphDocument &document)
{
    const auto require = [](bool valid) {
        if (!valid)
            throw std::runtime_error("This graph exceeds the Qt viewer's floating-point drawing range.");
    };
    require(renderable(document.bounds()) && renderable(document.lineHeight()));
    for (const auto &group : document.groups()) {
        require(renderable(group.position) && renderable(group.scale)
                && renderable(group.bounds));
        for (const auto &line : group.lines) require(renderable(line.rect));
        for (const auto &body : group.bodies) require(renderable(body.rect));
        for (const auto &border : group.borders) require(renderable(border.rect));
        for (const auto &label : group.labels) {
            require(renderable(label.origin) && renderable(label.scale));
            require(renderable(group.scale * label.scale));
        }
    }
    for (const auto &node : document.nodes())
        require(renderable(node.bounds) && renderable(node.extents));
}

// The page is viewport-sized, outside the camera transform. Camera changes
// alter one matrix only. Overlays have a separate revision, so selection does
// not rebuild graph vertices or glyphs.
class GraphSceneNode final : public QSGNode {
public:
    GraphSceneNode()
    {
        appendChildNode(background);
        appendChildNode(camera);
        camera->appendChildNode(groups);
        camera->appendChildNode(overlays);
    }
    QSGNode *background = new QSGNode;
    QSGTransformNode *camera = new QSGTransformNode;
    QSGNode *groups = new QSGNode;
    QSGNode *overlays = new QSGNode;
    QSizeF viewportSize;
    QColor backgroundColor;
    quint64 documentRevision = 0;
    quint64 overlayRevision = 0;
};

void clearChildren(QSGNode *parent)
{
    while (auto *child = parent->firstChild()) {
        parent->removeChildNode(child);
        delete child;
    }
}

QMatrix4x4 sceneTransform(QPointF position, qreal scale)
{
    QMatrix4x4 matrix;
    matrix.translate(float(position.x()), float(position.y()));
    matrix.scale(float(scale));
    return matrix;
}

// Six vertices per rectangle allow differently colored bodies to share one
// geometry node per paint group. This uses Qt's public, backend-neutral material.
void appendRectangles(QSGNode *parent, const std::vector<PaintRect> &rectangles)
{
    if (rectangles.empty()) return;
    const auto maximumRectangles = size_t(std::numeric_limits<int>::max() / 6);
    for (size_t start = 0; start < rectangles.size(); start += maximumRectangles) {
        const size_t count = std::min(maximumRectangles, rectangles.size() - start);
        auto *node = new QSGGeometryNode;
        auto *geometry = new QSGGeometry(QSGGeometry::defaultAttributes_ColoredPoint2D(),
                                         int(count * 6));
        geometry->setDrawingMode(QSGGeometry::DrawTriangles);
        geometry->setVertexDataPattern(QSGGeometry::StaticPattern);
        auto *vertex = geometry->vertexDataAsColoredPoint2D();
        bool translucent = false;
        for (size_t i = start; i < start + count; ++i) {
            const auto &entry = rectangles[i];
            const auto &rect = entry.rect;
            const auto &color = entry.color;
            // QSGVertexColorMaterial expects premultiplied color components.
            const auto alpha = uchar(color.alpha());
            translucent = translucent || alpha < 255;
            const auto red = uchar((color.red() * alpha + 127) / 255);
            const auto green = uchar((color.green() * alpha + 127) / 255);
            const auto blue = uchar((color.blue() * alpha + 127) / 255);
            const float left = float(rect.left()), top = float(rect.top());
            const float right = float(rect.right()), bottom = float(rect.bottom());
            vertex++->set(left, top, red, green, blue, alpha);
            vertex++->set(right, top, red, green, blue, alpha);
            vertex++->set(left, bottom, red, green, blue, alpha);
            vertex++->set(left, bottom, red, green, blue, alpha);
            vertex++->set(right, top, red, green, blue, alpha);
            vertex++->set(right, bottom, red, green, blue, alpha);
        }
        node->setGeometry(geometry);
        node->setFlag(QSGNode::OwnsGeometry);
        auto *material = new QSGVertexColorMaterial;
        material->setFlag(QSGMaterial::Blending, translucent);
        node->setMaterial(material);
        node->setFlag(QSGNode::OwnsMaterial);
        parent->appendChildNode(node);
    }
}

void appendOutline(std::vector<PaintRect> &rectangles, const QRectF &rect,
                   QColor color, qreal thickness)
{
    if (rect.isEmpty()) return;
    const QRectF outer = rect.adjusted(-thickness, -thickness, thickness, thickness);
    rectangles.push_back({QRectF(outer.left(), outer.top(), outer.width(), thickness), color});
    rectangles.push_back({QRectF(outer.left(), rect.bottom(), outer.width(), thickness), color});
    rectangles.push_back({QRectF(outer.left(), rect.top(), thickness, rect.height()), color});
    rectangles.push_back({QRectF(rect.right(), rect.top(), thickness, rect.height()), color});
}

void appendLabels(QSGNode *parent, QQuickWindow *window, const PaintGroup &group,
                  const GraphDocument &document)
{
    for (const auto &label : group.labels) {
        if (label.text.isEmpty()) continue;
        auto *position = new QSGTransformNode;
        position->setMatrix(sceneTransform(label.origin, label.scale));
        auto *text = window->createTextNode();
        text->setColor(label.color);
        text->setRenderType(QSGTextNode::QtRendering);
        text->setTextStyle(QSGTextNode::Normal);
        position->appendChildNode(text);
        parent->appendChildNode(position);

        const QStringList lines = label.text.split('\n');
        qreal y = 0;
        for (const auto &lineText : lines) {
            QTextLayout layout(lineText, document.font());
            QTextOption options;
            options.setWrapMode(QTextOption::NoWrap);
            layout.setTextOption(options);
            layout.beginLayout();
            QTextLine line = layout.createLine();
            if (line.isValid()) {
                line.setLineWidth(1e9);
                // The measurement adapter uses the same text layout and logical
                // line height. Native glyph ascent/descent sit centered in it.
                line.setPosition(QPointF(0, (document.lineHeight() - line.height()) / 2));
            }
            layout.endLayout();
            text->addTextLayout(QPointF(0, y), &layout);
            y += document.lineHeight();
        }
    }
}

void buildGroups(QSGNode *parent, QQuickWindow *window, const GraphDocument &document)
{
    for (const auto &group : document.groups()) {
        auto *position = new QSGTransformNode;
        position->setMatrix(sceneTransform(group.position, group.scale));
        parent->appendChildNode(position);
        appendRectangles(position, group.lines);
        appendRectangles(position, group.bodies);
        appendRectangles(position, group.borders);
        appendLabels(position, window, group, document);
    }
}

void buildOverlays(QSGNode *parent, const GraphDocument &document,
                   bool showGroups, bool showExtents, const QString &selectedId)
{
    std::vector<PaintRect> rectangles;
    // These strokes are graph-space widths and deliberately scale with the
    // graph. Camera motion therefore never requires regenerating even overlays.
    const qreal baseStroke = std::max(qreal(0.5), document.lineHeight() / 16);
    if (showGroups) {
        size_t index = 0;
        for (const auto &group : document.groups()) {
            const QRectF bounds(group.position + group.bounds.topLeft() * group.scale,
                                group.bounds.size() * group.scale);
            const QColor color = QColor::fromHsv(int(index++ * 83 % 360), 185, 180, 190);
            appendOutline(rectangles, bounds, color, baseStroke);
        }
    }
    for (const auto &node : document.nodes()) {
        if (showExtents)
            appendOutline(rectangles, node.extents, QColor(151, 78, 184, 120), baseStroke * .5);
        if (node.id == selectedId)
            appendOutline(rectangles, node.bounds, QColor("#dc6b24"), baseStroke * 2);
    }
    appendRectangles(parent, rectangles);
}

} // namespace

GraphView::GraphView(QQuickItem *parent) : QQuickItem(parent)
{
    setFlag(ItemHasContents);
    setClip(true);
    setAcceptedMouseButtons(Qt::LeftButton | Qt::MiddleButton);
    setAcceptHoverEvents(true);
    setActiveFocusOnTab(true);
}

GraphView::~GraphView() = default;

void GraphView::setError(const QString &error)
{
    if (error_ == error) return;
    error_ = error;
    emit errorChanged();
}

void GraphView::setSource(const QString &source)
{
    if (source_ == source) return;
    if (source.startsWith(QStringLiteral("primes:"))) {
        bool valid = false;
        const int count = source.mid(7).toInt(&valid);
        if (!valid) {
            setError(QStringLiteral("A primes source must have the form primes:<count>."));
            return;
        }
        loadPrimes(count);
        return;
    }
    source_ = source;
    emit sourceChanged();
    try {
        std::shared_ptr<GraphDocument> document;
        if (!source.isEmpty()) {
            const QUrl url(source);
            QString path = url.isLocalFile() ? url.toLocalFile() : source;
            if (path.startsWith("qrc:/")) path.remove(0, 3);
            QFile input(path);
            if (!input.open(QIODevice::ReadOnly))
                throw std::runtime_error(input.errorString().toStdString());
            document = GraphDocument::fromJson(input.readAll());
            validateDrawingRange(*document);
        }
        document_ = std::move(document);
        primes_.reset();
        primeCount_ = primeLimit_ = 0;
        demoBuildStats_.clear();
        ++documentRevision_;
        clearSelection();
        updateOverlays();
        setError({});
        emit documentChanged();
        fitGraph();
        update();
    } catch (const std::exception &error) {
        // Retain the last good scene; the UI shows the requested source and error.
        setError(QString::fromUtf8(error.what()));
    }
}

int GraphView::maximumPrimeCount() const { return PG_PRIMES_MAX_COUNT; }

bool GraphView::loadPrimes(int count)
{
    return loadPrimes(count, maximumPrimeCount());
}

bool GraphView::loadPrimes(int count, int sizingLimit)
{
    try {
        QElapsedTimer timer;
        timer.start();
        auto session = std::make_unique<PrimesSession>(sizingLimit);
        auto document = session->growTo(count);
        validateDrawingRange(*document);
        primes_ = std::move(session);
        acceptPrimesDocument(std::move(document), true, timer.nsecsElapsed() / 1e6);
        return true;
    } catch (const std::exception &error) {
        setError(QString::fromUtf8(error.what()));
        return false;
    }
}

bool GraphView::growPrimes(int targetCount)
{
    if (!primes_) {
        setError(QStringLiteral("Load the primes demo before adding columns."));
        return false;
    }
    if (targetCount < primeCount_ || targetCount > primeLimit_) {
        setError(QStringLiteral("Growth must stay between the current count (%1) and sizing limit (%2).")
                     .arg(primeCount_).arg(primeLimit_));
        return false;
    }
    if (targetCount == primeCount_) {
        setError({});
        return true;
    }
    try {
        QElapsedTimer timer;
        timer.start();
        auto document = primes_->growTo(targetCount);
        validateDrawingRange(*document);
        acceptPrimesDocument(std::move(document), false, timer.nsecsElapsed() / 1e6);
        return true;
    } catch (const std::exception &error) {
        // The old immutable snapshot remains visible. Do not attempt further
        // mutations after a native allocation or layout failure.
        primes_.reset();
        setError(QString::fromUtf8(error.what()));
        return false;
    }
}

void GraphView::acceptPrimesDocument(std::shared_ptr<GraphDocument> document,
                                   bool coldStart, qreal totalMs)
{
    document_ = std::move(document);
    primeCount_ = primes_->count();
    primeLimit_ = primes_->limit();
    const auto &metrics = primes_->metrics();
    demoBuildStats_ = {
        {QStringLiteral("count"), primeCount_},
        {QStringLiteral("sizingLimit"), primeLimit_},
        {QStringLiteral("coldStart"), coldStart},
        {QStringLiteral("generationMs"), metrics.generationMs},
        {QStringLiteral("layoutMs"), metrics.layoutMs},
        {QStringLiteral("snapshotMs"), metrics.snapshotMs},
        {QStringLiteral("totalMs"), totalMs},
        {QStringLiteral("nodesCommitted"), qulonglong(metrics.nodesCommitted)},
        {QStringLiteral("nodesMeasured"), qulonglong(metrics.nodesMeasured)},
        {QStringLiteral("cleanSubtreesSkipped"), qulonglong(metrics.cleanSubtreesSkipped)},
        {QStringLiteral("workUnits"), qulonglong(metrics.workUnits)},
        {QStringLiteral("restarts"), qulonglong(metrics.restarts)}
    };
    const QString source = QStringLiteral("primes:%1").arg(primeCount_);
    if (source_ != source) {
        source_ = source;
        emit sourceChanged();
    }
    ++documentRevision_;
    clearSelection();
    updateOverlays();
    setError({});
    emit documentChanged();
    if (coldStart || autoFit_) fitGraph();
    update();
}

int GraphView::nodeCount() const { return document_ ? int(document_->nodes().size()) : 0; }
int GraphView::groupCount() const { return document_ ? int(document_->groups().size()) : 0; }
QStringList GraphView::ignoredCapabilities() const
{
    return document_ ? document_->ignoredCapabilities() : QStringList {};
}

QColor GraphView::pageBackgroundColor() const
{
    return document_ ? document_->pageBackgroundColor() : QColor("#f3f5f7");
}

void GraphView::setShowGroups(bool visible)
{
    if (showGroups_ == visible) return;
    showGroups_ = visible;
    emit showGroupsChanged();
    updateOverlays();
}

void GraphView::setShowExtents(bool visible)
{
    if (showExtents_ == visible) return;
    showExtents_ = visible;
    emit showExtentsChanged();
    updateOverlays();
}

void GraphView::updateOverlays()
{
    ++overlayRevision_;
    update();
}

void GraphView::clearSelection()
{
    if (selectedId_.isEmpty() && selectedText_.isEmpty()) return;
    selectedId_.clear();
    selectedText_.clear();
    emit selectionChanged();
    updateOverlays();
}

QPointF GraphView::graphToView(QPointF world) const { return pan_ + world * zoom_; }
QPointF GraphView::viewToGraph(QPointF view) const { return (view - pan_) / zoom_; }

void GraphView::fitGraph()
{
    autoFit_ = true;
    if (!document_ || width() <= 0 || height() <= 0) return;
    const QRectF bounds = document_->bounds();
    constexpr qreal margin = 48;
    const qreal horizontal = std::max(qreal(1), width() - 2 * margin)
        / std::max(qreal(1), bounds.width());
    const qreal vertical = std::max(qreal(1), height() - 2 * margin)
        / std::max(qreal(1), bounds.height());
    zoom_ = std::clamp(std::min(horizontal, vertical), MinimumZoom, MaximumZoom);
    pan_ = QPointF(width() / 2, height() / 2) - bounds.center() * zoom_;
    emit zoomChanged();
    update();
}

void GraphView::zoomAt(qreal factor, QPointF anchor)
{
    if (!std::isfinite(factor) || factor <= 0) return;
    const QPointF world = viewToGraph(anchor);
    const qreal next = std::clamp(zoom_ * factor, MinimumZoom, MaximumZoom);
    if (next == zoom_) return;
    zoom_ = next;
    pan_ = anchor - world * zoom_;
    autoFit_ = false;
    emit zoomChanged();
    update();
}

void GraphView::zoomIn() { zoomAt(1.25, QPointF(width() / 2, height() / 2)); }
void GraphView::zoomOut() { zoomAt(.8, QPointF(width() / 2, height() / 2)); }

void GraphView::panBy(qreal dx, qreal dy)
{
    if (!std::isfinite(dx) || !std::isfinite(dy)) return;
    const QPointF next = pan_ + QPointF(dx, dy);
    if (!renderable(next)) return;
    pan_ = next;
    autoFit_ = false;
    update();
}

void GraphView::selectAt(qreal x, qreal y)
{
    if (!document_ || !std::isfinite(x) || !std::isfinite(y)) return;
    const auto *node = document_->hitTest(viewToGraph(QPointF(x, y)));
    if (!node) { clearSelection(); return; }
    if (selectedId_ == node->id) return;
    selectedId_ = node->id;
    selectedText_ = node->text;
    emit selectionChanged();
    updateOverlays();
}

QSGNode *GraphView::updatePaintNode(QSGNode *oldNode, UpdatePaintNodeData *)
{
    auto *scene = static_cast<GraphSceneNode *>(oldNode);
    if (!scene) scene = new GraphSceneNode;
    const QColor background = pageBackgroundColor();
    if (scene->viewportSize != size() || scene->backgroundColor != background) {
        clearChildren(scene->background);
        if (width() > 0 && height() > 0 && background.alpha() > 0)
            appendRectangles(scene->background, {{QRectF(QPointF(0, 0), size()), background}});
        scene->viewportSize = size();
        scene->backgroundColor = background;
    }
    if (scene->documentRevision != documentRevision_) {
        QElapsedTimer timer;
        timer.start();
        clearChildren(scene->groups);
        if (document_) {
            buildGroups(scene->groups, window(), *document_);
            lastSceneBuildMs_.store(timer.nsecsElapsed() / 1e6);
            geometryBuildCount_.fetch_add(1);
            QMetaObject::invokeMethod(this, [this] { emit geometryBuildCountChanged(); },
                                      Qt::QueuedConnection);
        }
        scene->documentRevision = documentRevision_;
    }
    if (scene->overlayRevision != overlayRevision_) {
        clearChildren(scene->overlays);
        if (document_)
            buildOverlays(scene->overlays, *document_, showGroups_, showExtents_, selectedId_);
        scene->overlayRevision = overlayRevision_;
    }
    scene->camera->setMatrix(sceneTransform(pan_, zoom_));
    return scene;
}

void GraphView::geometryChange(const QRectF &newGeometry, const QRectF &oldGeometry)
{
    QQuickItem::geometryChange(newGeometry, oldGeometry);
    if (newGeometry.size() == oldGeometry.size()) return;
    if (autoFit_) fitGraph();
    else {
        pan_ += QPointF((newGeometry.width() - oldGeometry.width()) / 2,
                        (newGeometry.height() - oldGeometry.height()) / 2);
    }
    update(); // The page background also changes size without a document.
}

void GraphView::mousePressEvent(QMouseEvent *event)
{
    forceActiveFocus(Qt::MouseFocusReason);
    pressed_ = true;
    dragged_ = false;
    pressPosition_ = lastPosition_ = event->position();
    event->accept();
}

void GraphView::mouseMoveEvent(QMouseEvent *event)
{
    if (!pressed_) { event->ignore(); return; }
    if (!dragged_ && (event->position() - pressPosition_).manhattanLength()
        >= QGuiApplication::styleHints()->startDragDistance()) {
        dragged_ = true;
        setCursor(Qt::ClosedHandCursor);
    }
    if (dragged_) {
        const QPointF delta = event->position() - lastPosition_;
        panBy(delta.x(), delta.y());
        lastPosition_ = event->position();
    }
    event->accept();
}

void GraphView::mouseReleaseEvent(QMouseEvent *event)
{
    if (pressed_ && !dragged_ && event->button() == Qt::LeftButton)
        selectAt(event->position().x(), event->position().y());
    pressed_ = false;
    unsetCursor();
    event->accept();
}

void GraphView::mouseDoubleClickEvent(QMouseEvent *event)
{
    fitGraph();
    event->accept();
}

void GraphView::mouseUngrabEvent()
{
    pressed_ = false;
    unsetCursor();
}

void GraphView::wheelEvent(QWheelEvent *event)
{
    forceActiveFocus(Qt::MouseFocusReason);
    if (!event->pixelDelta().isNull() && !(event->modifiers() & Qt::ControlModifier)) {
        panBy(event->pixelDelta().x(), event->pixelDelta().y());
    } else {
        const qreal delta = !event->pixelDelta().isNull()
            ? event->pixelDelta().y() * 2 : event->angleDelta().y();
        zoomAt(std::exp(delta * .0015), event->position());
    }
    event->accept();
}

void GraphView::keyPressEvent(QKeyEvent *event)
{
    switch (event->key()) {
    case Qt::Key_F: case Qt::Key_Home: fitGraph(); break;
    case Qt::Key_Plus: case Qt::Key_Equal: zoomIn(); break;
    case Qt::Key_Minus: zoomOut(); break;
    case Qt::Key_Left: panBy(60, 0); break;
    case Qt::Key_Right: panBy(-60, 0); break;
    case Qt::Key_Up: panBy(0, 60); break;
    case Qt::Key_Down: panBy(0, -60); break;
    case Qt::Key_Escape: clearSelection(); break;
    default: QQuickItem::keyPressEvent(event); return;
    }
    event->accept();
}

bool GraphView::event(QEvent *event)
{
    if (event->type() == QEvent::NativeGesture) {
        auto *gesture = static_cast<QNativeGestureEvent *>(event);
        if (gesture->gestureType() == Qt::ZoomNativeGesture)
            zoomAt(1 + gesture->value(), gesture->position());
        else if (gesture->gestureType() == Qt::PanNativeGesture)
            panBy(gesture->delta().x(), gesture->delta().y());
        else if (gesture->gestureType() == Qt::SmartZoomNativeGesture)
            fitGraph();
        else return QQuickItem::event(event);
        event->accept();
        return true;
    }
    return QQuickItem::event(event);
}

} // namespace pgqt
