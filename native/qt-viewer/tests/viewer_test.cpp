#include "GraphView.h"

#include <QFile>
#include <QImage>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QQuickWindow>
#include <QTemporaryFile>
#include <QTest>
#include <QWheelEvent>

class ViewerTest : public QObject {
    Q_OBJECT
private slots:
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
