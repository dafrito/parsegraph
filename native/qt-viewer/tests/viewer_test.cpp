#include "GraphView.h"
#include "GraphDocument.h"

#include <QFile>
#include <QImage>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QQuickWindow>
#include <QTemporaryFile>
#include <QTest>
#include <QWheelEvent>
#include <algorithm>
#include <cmath>

namespace {

QJsonObject appearanceDocument()
{
    // Deliberately leave the page translucent: the QQuickWindow is an embedding
    // surface whose color must remain visible through the graph's page layer.
    return QJsonDocument::fromJson(R"json({
      "format":"parsegraph", "version":1, "root":"root",
      "nodes":[
        {"id":"root", "value":"", "scale":1, "fit":"loose",
         "layoutPreference":"horizontal", "parentId":null, "parentDir":null,
         "alignment":"none", "axisOverlap":"default", "rightToLeft":false,
         "paintGroup":false},
        {"id":"child", "value":"", "scale":0.75, "fit":"loose",
         "layoutPreference":"perpendicular", "parentId":"root", "parentDir":"forward",
         "alignment":"none", "axisOverlap":"default", "rightToLeft":false,
         "paintGroup":true}
      ],
      "capabilities":{
        "presentation/1":{
          "text":{"fontFamily":"sans-serif", "fontSize":20, "lineHeight":24},
          "styles":{"block":{"minWidth":80, "minHeight":60,
            "paddingX":5, "paddingY":5, "square":false}},
          "defaultStyle":"block", "nodeStyles":{},
          "spacing":{"horizontal":40, "vertical":40, "inward":5}
        },
        "appearance/1":{
          "defaults":{
            "backgroundColor":"#c80000", "backgroundAlpha":0.5,
            "borderColor":"#0000f0", "borderAlpha":0.25,
            "textColor":"#000000", "textAlpha":1,
            "lineColor":"#00c800", "lineAlpha":0.75
          },
          "nodeStyles":{"child":{
            "backgroundAlpha":0, "borderColor":"#f08000", "borderAlpha":1,
            "lineColor":"#f000f0", "lineAlpha":1
          }},
          "pageBackgroundColor":"#204060", "pageBackgroundAlpha":0.5
        }
      }
    })json").object();
}

QColor composite(QColor foreground, QColor background, qreal alpha)
{
    return QColor(qRound(foreground.red() * alpha + background.red() * (1 - alpha)),
                  qRound(foreground.green() * alpha + background.green() * (1 - alpha)),
                  qRound(foreground.blue() * alpha + background.blue() * (1 - alpha)));
}

QColor imageAt(const QImage &image, const QQuickWindow &window, QPointF position)
{
    const int x = qBound(0, qRound(position.x() * image.width() / window.width()), image.width() - 1);
    const int y = qBound(0, qRound(position.y() * image.height() / window.height()), image.height() - 1);
    return image.pixelColor(x, y);
}

void checkColor(QColor actual, QColor expected, int tolerance = 3)
{
    const bool matches = std::abs(actual.red() - expected.red()) <= tolerance
        && std::abs(actual.green() - expected.green()) <= tolerance
        && std::abs(actual.blue() - expected.blue()) <= tolerance;
    QVERIFY2(matches, qPrintable(QString("Expected %1, got %2")
        .arg(expected.name(QColor::HexArgb), actual.name(QColor::HexArgb))));
}

const pgqt::NodeVisual *findNode(const pgqt::GraphDocument &document, const QString &id)
{
    for (const auto &node : document.nodes()) if (node.id == id) return &node;
    return nullptr;
}

} // namespace

class ViewerTest : public QObject {
    Q_OBJECT
    static int primeNodeCount(int count) {
        int nodes = count, primes = 0;
        for (int number = 2; number <= count; ++number) {
            bool prime = true;
            for (int divisor = 2; divisor * divisor <= number; ++divisor)
                if (number % divisor == 0) { prime = false; break; }
            if (prime) ++primes;
            nodes += primes;
        }
        return nodes;
    }

private slots:
    void appearanceCompositingAndViewportBackground() {
        QQuickWindow window;
        const QColor host("#102030");
        window.setColor(host);
        window.resize(900, 650);
        auto *view = new pgqt::GraphView(window.contentItem());
        view->setSize(QSizeF(900, 650));
        auto json = appearanceDocument();
        QTemporaryFile input;
        QVERIFY(input.open());
        input.write(QJsonDocument(json).toJson());
        input.flush();
        view->setSource(input.fileName());
        QVERIFY2(view->error().isEmpty(), qPrintable(view->error()));
        QVERIFY(!view->ignoredCapabilities().contains("appearance/1"));
        QCOMPARE(view->pageBackgroundColor().name(), QString("#204060"));
        QVERIFY(std::abs(view->pageBackgroundColor().alphaF() - .5) < .003);
        auto document = pgqt::GraphDocument::fromJson(QJsonDocument(json).toJson());
        const auto *root = findNode(*document, "root");
        const auto *child = findNode(*document, "child");
        QVERIFY(root && child);
        QCOMPARE(document->groups().size(), size_t(2));

        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QTRY_VERIFY(view->geometryBuildCount() > 0);
        const auto builds = view->geometryBuildCount();
        const QImage initial = window.grabWindow();
        QVERIFY(!initial.isNull());
        const QColor page = composite(QColor("#204060"), host, .5);
        const QColor fill = composite(QColor("#c80000"), page, .5);
        checkColor(imageAt(initial, window, QPointF(10, 10)), page);
        checkColor(imageAt(initial, window, view->graphToView(root->bounds.center())), fill);
        checkColor(imageAt(initial, window, view->graphToView(child->bounds.center())), page);
        // Borders are independently composited over the body, entirely inside
        // its bounds. Child styling must survive the paint-group transform.
        checkColor(imageAt(initial, window, view->graphToView(
            QPointF(root->bounds.center().x(), root->bounds.top() + .5))),
            composite(QColor("#0000f0"), fill, .25));
        checkColor(imageAt(initial, window, view->graphToView(
            QPointF(child->bounds.center().x(), child->bounds.top() + .375))), QColor("#f08000"));
        const QPointF connection((root->bounds.right() + child->bounds.left()) / 2,
                                  root->bounds.center().y());
        checkColor(imageAt(initial, window, view->graphToView(connection)),
                   composite(QColor("#00c800"), page, .75));

        // Moving the entire graph offscreen leaves the page covering the whole
        // viewport; neither camera movement nor resizing uploads graph data.
        view->panBy(5000, 5000);
        view->zoomIn();
        const QImage panned = window.grabWindow();
        checkColor(imageAt(panned, window, QPointF(10, 10)), page);
        checkColor(imageAt(panned, window, QPointF(890, 640)), page);
        QCOMPARE(view->geometryBuildCount(), builds);
        window.resize(1000, 700);
        view->setSize(QSizeF(1000, 700));
        const QImage resized = window.grabWindow();
        checkColor(imageAt(resized, window, QPointF(990, 690)), page);
        QCOMPARE(view->geometryBuildCount(), builds);

        // A zero-alpha page must expose the embedding surface, not substitute
        // an opaque viewer color. Invalid subsequent loads preserve this page.
        auto capabilities = json["capabilities"].toObject();
        auto appearance = capabilities["appearance/1"].toObject();
        appearance["pageBackgroundAlpha"] = 0;
        capabilities["appearance/1"] = appearance;
        json["capabilities"] = capabilities;
        QTemporaryFile transparent;
        QVERIFY(transparent.open());
        transparent.write(QJsonDocument(json).toJson());
        transparent.flush();
        view->setSource(transparent.fileName());
        QVERIFY2(view->error().isEmpty(), qPrintable(view->error()));
        QCOMPARE(view->pageBackgroundColor().alpha(), 0);
        const QImage clearPage = window.grabWindow();
        checkColor(imageAt(clearPage, window, QPointF(10, 10)), host);
        checkColor(imageAt(clearPage, window, view->graphToView(child->bounds.center())), host);
        appearance["pageBackgroundAlpha"] = -1;
        capabilities["appearance/1"] = appearance;
        json["capabilities"] = capabilities;
        QTemporaryFile invalid;
        QVERIFY(invalid.open());
        invalid.write(QJsonDocument(json).toJson());
        invalid.flush();
        view->setSource(invalid.fileName());
        QVERIFY(!view->error().isEmpty());
        QCOMPARE(view->pageBackgroundColor().alpha(), 0);
        checkColor(imageAt(window.grabWindow(), window, QPointF(10, 10)), host);
    }

    void independentTextAlpha() {
        auto json = appearanceDocument();
        auto nodes = json["nodes"].toArray();
        auto root = nodes[0].toObject();
        root["value"] = "MMMM";
        nodes[0] = root;
        auto child = nodes[1].toObject();
        child["value"] = "MMMM";
        child["scale"] = 1;
        nodes[1] = child;
        auto transparent = child;
        transparent["id"] = "transparent";
        transparent["parentId"] = "child";
        nodes.append(transparent);
        json["nodes"] = nodes;
        auto capabilities = json["capabilities"].toObject();
        auto appearance = capabilities["appearance/1"].toObject();
        auto defaults = appearance["defaults"].toObject();
        defaults["backgroundAlpha"] = 0;
        defaults["borderAlpha"] = 0;
        defaults["lineAlpha"] = 0;
        appearance["defaults"] = defaults;
        appearance["nodeStyles"] = QJsonObject {
            {"child", QJsonObject {{"textAlpha", .5}}},
            {"transparent", QJsonObject {{"textAlpha", 0}}}
        };
        appearance["pageBackgroundColor"] = "#ffffff";
        appearance["pageBackgroundAlpha"] = 1;
        capabilities["appearance/1"] = appearance;
        json["capabilities"] = capabilities;
        QTemporaryFile input;
        QVERIFY(input.open());
        input.write(QJsonDocument(json).toJson());
        input.flush();
        const auto document = pgqt::GraphDocument::fromJson(QJsonDocument(json).toJson());
        QQuickWindow window;
        window.resize(1000, 500);
        auto *view = new pgqt::GraphView(window.contentItem());
        view->setSize(QSizeF(1000, 500));
        view->setSource(input.fileName());
        QVERIFY2(view->error().isEmpty(), qPrintable(view->error()));
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QTRY_VERIFY(view->geometryBuildCount() > 0);
        const QImage image = window.grabWindow();
        QVERIFY(!image.isNull());
        const auto darkest = [&](const QString &id) {
            const auto *node = findNode(*document, id);
            const QRectF inner = node->bounds.adjusted(4, 4, -4, -4);
            const QPointF begin = view->graphToView(inner.topLeft());
            const QPointF end = view->graphToView(inner.bottomRight());
            int result = 255;
            for (int y = qCeil(begin.y()); y < qFloor(end.y()); ++y)
                for (int x = qCeil(begin.x()); x < qFloor(end.x()); ++x)
                    result = std::min(result, imageAt(image, window, QPointF(x, y)).red());
            return result;
        };
        QVERIFY(darkest("root") < 30);
        QVERIFY(darkest("child") >= 120);
        QVERIFY(darkest("child") < 145);
        QCOMPARE(darkest("transparent"), 255);
    }

    void nativePrimesGrowAndRebuild() {
        QQuickWindow window;
        window.resize(900, 650);
        auto *view = new pgqt::GraphView(window.contentItem());
        view->setSize(QSizeF(900, 650));
        QVERIFY(view->loadPrimes(10, 30));
        QVERIFY2(view->error().isEmpty(), qPrintable(view->error()));
        QCOMPARE(view->source(), QString("primes:10"));
        QCOMPARE(view->primeCount(), 10);
        QCOMPARE(view->primeLimit(), 30);
        QCOMPARE(view->nodeCount(), primeNodeCount(10));
        QCOMPARE(view->groupCount(), 9);
        QVERIFY(view->demoBuildStats()["coldStart"].toBool());
        QVERIFY(view->demoBuildStats()["nodesCommitted"].toULongLong() > 0);

        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QTRY_VERIFY(view->geometryBuildCount() > 0);
        const auto initialBuilds = view->geometryBuildCount();
        QVERIFY(view->lastSceneBuildMs() > 0);
        QVERIFY(view->growPrimes(11));
        QCOMPARE(view->primeCount(), 11);
        QCOMPARE(view->nodeCount(), primeNodeCount(11));
        QCOMPARE(view->groupCount(), 10);
        QVERIFY(!view->demoBuildStats()["coldStart"].toBool());
        QVERIFY(view->demoBuildStats()["nodesMeasured"].toULongLong() > 0);
        QVERIFY(!window.grabWindow().isNull());
        QCOMPARE(view->geometryBuildCount(), initialBuilds + 1);

        // Appending changes the native graph and snapshot. A deliberate camera
        // position survives growth, while the scene must upload the new graph.
        view->panBy(20, 10);
        const QPointF rootPosition = view->graphToView(QPointF(0, 0));
        const qreal zoom = view->zoom();
        QVERIFY(view->growPrimes(30));
        QCOMPARE(view->primeCount(), 30);
        QCOMPARE(view->source(), QString("primes:30"));
        QCOMPARE(view->nodeCount(), primeNodeCount(30));
        QCOMPARE(view->groupCount(), 29);
        QCOMPARE(view->graphToView(QPointF(0, 0)), rootPosition);
        QCOMPARE(view->zoom(), zoom);
        QVERIFY(!window.grabWindow().isNull());
        QCOMPARE(view->geometryBuildCount(), initialBuilds + 2);
        const auto sceneBuildMs = view->lastSceneBuildMs();
        QVERIFY(sceneBuildMs > 0);
        view->zoomOut();
        view->panBy(-20, -10);
        QVERIFY(!window.grabWindow().isNull());
        QCOMPARE(view->geometryBuildCount(), initialBuilds + 2);
        QCOMPARE(view->lastSceneBuildMs(), sceneBuildMs);

        // A no-op append does not pretend to perform an incremental update.
        QVERIFY(view->growPrimes(30));
        window.grabWindow();
        QCOMPARE(view->geometryBuildCount(), initialBuilds + 2);
    }

    void primesFailuresPreserveTheDocument() {
        pgqt::GraphView view;
        QVERIFY(view.loadPrimes(10, 30));
        const auto stats = view.demoBuildStats();
        QVERIFY(!view.growPrimes(9));
        QVERIFY(!view.error().isEmpty());
        QCOMPARE(view.primeCount(), 10);
        QCOMPARE(view.nodeCount(), primeNodeCount(10));
        QCOMPARE(view.demoBuildStats(), stats);
        QVERIFY(!view.growPrimes(31));
        QVERIFY(!view.loadPrimes(20, 10));
        QCOMPARE(view.primeCount(), 10);
        QCOMPARE(view.primeLimit(), 30);
        QCOMPARE(view.source(), QString("primes:10"));
        QVERIFY(view.growPrimes(11));
        QVERIFY(view.error().isEmpty());

        view.setSource(QStringLiteral(PG_SOURCE_ROOT "/examples/fixtures/proportion-proportional.parsegraph"));
        QVERIFY(view.error().isEmpty());
        QCOMPARE(view.nodeCount(), 25);
        QCOMPARE(view.primeCount(), 0);
        QCOMPARE(view.primeLimit(), 0);
        QVERIFY(view.demoBuildStats().isEmpty());
        QVERIFY(!view.growPrimes(12));
        QCOMPARE(view.nodeCount(), 25);

        view.setSource(QStringLiteral("primes:5"));
        QVERIFY(view.error().isEmpty());
        QCOMPARE(view.primeCount(), 5);
        QCOMPARE(view.primeLimit(), 10000);
        QCOMPARE(view.nodeCount(), primeNodeCount(5));
        view.setSource(QStringLiteral("primes:invalid"));
        QVERIFY(!view.error().isEmpty());
        QCOMPARE(view.primeCount(), 5);
        QCOMPARE(view.nodeCount(), primeNodeCount(5));
    }

    void maximumPrimeLimit() {
        pgqt::GraphView view;
        QCOMPARE(view.maximumPrimeCount(), 10000);
        QCOMPARE(view.property("maximumPrimeCount").toInt(), 10000);
        QVERIFY(view.loadPrimes(2, 10000));
        QCOMPARE(view.primeCount(), 2);
        QCOMPARE(view.primeLimit(), 10000);
        QCOMPARE(view.nodeCount(), primeNodeCount(2));
        const auto stats = view.demoBuildStats();
        QVERIFY(!view.loadPrimes(2, 10001));
        QVERIFY(!view.error().isEmpty());
        QCOMPARE(view.primeCount(), 2);
        QCOMPARE(view.primeLimit(), 10000);
        QCOMPARE(view.nodeCount(), primeNodeCount(2));
        QCOMPARE(view.demoBuildStats(), stats);
        view.setSource(QStringLiteral("primes:10001"));
        QVERIFY(!view.error().isEmpty());
        QCOMPARE(view.source(), QString("primes:2"));
        QCOMPARE(view.primeCount(), 2);
        QCOMPARE(view.nodeCount(), primeNodeCount(2));
    }

    void renderNavigateAndSelect() {
        QQuickWindow window;
        window.setColor(QColor("#f3f5f7"));
        window.resize(900, 650);
        auto *view = new pgqt::GraphView(window.contentItem());
        view->setSize(QSizeF(900, 650));
        view->setSource(QStringLiteral(PG_SOURCE_ROOT "/examples/fixtures/proportion-proportional.parsegraph"));
        QVERIFY2(view->error().isEmpty(), qPrintable(view->error()));
        QCOMPARE(view->nodeCount(), 25);
        QVERIFY(view->groupCount() > 1);
        window.show();
        QVERIFY(QTest::qWaitForWindowExposed(&window));
        QTRY_VERIFY(view->geometryBuildCount() > 0);
        const auto builds = view->geometryBuildCount();
        const QImage initial = window.grabWindow();
        QVERIFY(!initial.isNull());
        int ink = 0;
        for (int y = 0; y < initial.height(); y += 2)
            for (int x = 0; x < initial.width(); x += 2)
                if (initial.pixelColor(x, y).lightness() < 180) ++ink;
        QVERIFY2(ink > 100, "The native viewport must actually draw graph geometry.");

        const QPointF before = view->graphToView(QPointF(0, 0));
        view->panBy(30, 20);
        QCOMPARE(view->graphToView(QPointF(0, 0)), before + QPointF(30, 20));
        const qreal zoom = view->zoom();
        view->zoomIn();
        QVERIFY(view->zoom() > zoom);
        window.grabWindow(); // Wait for the updated scene to render.
        QCOMPARE(view->geometryBuildCount(), builds);

        // A real wheel event must preserve the graph point under the cursor.
        const QPointF cursor(350, 250);
        const QPointF anchored = view->viewToGraph(cursor);
        QWheelEvent wheel(cursor, window.mapToGlobal(cursor.toPoint()), QPoint(), QPoint(0, 120),
                          Qt::NoButton, Qt::NoModifier, Qt::NoScrollPhase, false);
        QCoreApplication::sendEvent(&window, &wheel);
        QVERIFY(QLineF(view->viewToGraph(cursor), anchored).length() < 1e-6);
        window.grabWindow();
        QCOMPARE(view->geometryBuildCount(), builds);

        view->fitGraph();
        const QPoint rootPosition = view->graphToView(QPointF(0, 0)).toPoint();
        QTest::mouseClick(&window, Qt::LeftButton, Qt::NoModifier, rootPosition);
        QCOMPARE(view->selectedId(), QString("proportion-0"));
        view->setShowGroups(true);
        view->setShowExtents(true);
        QVERIFY(!window.grabWindow().isNull());
        QCOMPARE(view->geometryBuildCount(), builds);

        // Drag input changes the camera without uploading graph geometry again.
        const QPointF dragStart = view->graphToView(QPointF(0, 0));
        QTest::mousePress(&window, Qt::LeftButton, Qt::NoModifier, QPoint(400, 300));
        QTest::mouseMove(&window, QPoint(445, 330));
        QTest::mouseRelease(&window, Qt::LeftButton, Qt::NoModifier, QPoint(445, 330));
        QVERIFY(QLineF(view->graphToView(QPointF(0, 0)), dragStart).length() > 20);
        window.grabWindow();
        QCOMPARE(view->geometryBuildCount(), builds);
    }

    void invalidDocumentIsReported() {
        pgqt::GraphView view;
        QTemporaryFile invalid;
        QVERIFY(invalid.open());
        invalid.write("{\"format\":\"parsegraph\",\"version\":1,\"nodes\":[]}");
        invalid.flush();
        view.setSource(invalid.fileName());
        QVERIFY(!view.error().isEmpty());
        QCOMPARE(view.nodeCount(), 0);

        view.setSource(QStringLiteral(PG_SOURCE_ROOT "/examples/fixtures/proportion-proportional.parsegraph"));
        QVERIFY(view.error().isEmpty());
        QCOMPARE(view.nodeCount(), 25);
        view.setSource(invalid.fileName());
        QVERIFY(!view.error().isEmpty());
        QCOMPARE(view.nodeCount(), 25); // Preserve the last usable scene on error.

        QFile fixture(QStringLiteral(PG_SOURCE_ROOT "/examples/fixtures/proportion-proportional.parsegraph"));
        QVERIFY(fixture.open(QIODevice::ReadOnly));
        auto envelope = QJsonDocument::fromJson(fixture.readAll()).object();
        auto nodes = envelope["nodes"].toArray();
        // Scale is parent-relative; a root's scale does not change world size.
        auto child = nodes[1].toObject();
        child["scale"] = 1e35;
        nodes[1] = child;
        envelope["nodes"] = nodes;
        QTemporaryFile tooLarge;
        QVERIFY(tooLarge.open());
        tooLarge.write(QJsonDocument(envelope).toJson());
        tooLarge.flush();
        view.setSource(tooLarge.fileName());
        QVERIFY(!view.error().isEmpty());
        QCOMPARE(view.nodeCount(), 25);
    }
};

QTEST_MAIN(ViewerTest)
#include "viewer_test.moc"
