#include "GraphView.h"

#include <QCommandLineParser>
#include <QFileInfo>
#include <QGuiApplication>
#include <QImage>
#include <QQmlApplicationEngine>
#include <QQuickStyle>
#include <QQuickWindow>
#include <QSGRendererInterface>
#include <QTimer>

int main(int argc, char **argv) {
    QQuickStyle::setStyle("Basic");
    QGuiApplication app(argc, argv);
    QCoreApplication::setApplicationName("parsegraph-viewer");
    QGuiApplication::setApplicationDisplayName("Parsegraph Viewer");
    QCoreApplication::setApplicationVersion("0.1.0");
    QCommandLineParser parser;
    parser.setApplicationDescription("A Qt Quick viewer using the native Parsegraph layout library.");
    parser.addHelpOption();
    parser.addVersionOption();
    parser.addPositionalArgument("document", "A v1 .parsegraph document; defaults to the bundled proportion demo.", "[document]");
    parser.addOption({"snapshot", "Save the complete viewer window as PNG, then exit.", "file"});
    parser.addOption({"quit-after", "Exit after this many milliseconds (for smoke checks).", "milliseconds"});
    parser.process(app);
    if (parser.positionalArguments().size() > 1) parser.showHelp(1);
    QString source = ":/viewer/assets/proportion.parsegraph";
    if (!parser.positionalArguments().isEmpty())
        source = QFileInfo(parser.positionalArguments().first()).absoluteFilePath();

    qmlRegisterType<pgqt::GraphView>("Parsegraph.Native", 1, 0, "GraphView");
    QQmlApplicationEngine engine;
    engine.setInitialProperties({{"initialSource", source}});
    engine.load(QUrl("qrc:/viewer/Main.qml"));
    if (engine.rootObjects().isEmpty()) return 1;
    auto *window = qobject_cast<QQuickWindow *>(engine.rootObjects().first());
    if (!window) return 1;

    QObject::connect(window, &QQuickWindow::sceneGraphInitialized, window, [window] {
        qInfo() << "Parsegraph Qt renderer:" << window->rendererInterface()->graphicsApi();
    }, Qt::DirectConnection);
    if (parser.isSet("snapshot")) {
        const QString output = QFileInfo(parser.value("snapshot")).absoluteFilePath();
        QTimer::singleShot(1500, window, [&app, window, output] {
            auto *view = window->findChild<pgqt::GraphView *>("graphView");
            if (!view || !view->error().isEmpty()) {
                qCritical() << "Could not load graph:" << (view ? view->error() : "Missing viewport");
                app.exit(1);
                return;
            }
            const QImage image = window->grabWindow();
            if (image.isNull() || !image.save(output)) {
                qCritical() << "Could not save screenshot:" << output;
                app.exit(1);
                return;
            }
            qInfo() << "Saved" << output << image.size();
            app.quit();
        });
    }
    if (parser.isSet("quit-after")) {
        bool valid = false;
        const int delay = parser.value("quit-after").toInt(&valid);
        if (!valid || delay < 1) parser.showHelp(1);
        QTimer::singleShot(delay, &app, &QCoreApplication::quit);
    }
    return app.exec();
}
