#include "GraphView.h"
#include "ViewerBenchmark.h"
#include "primes.h"

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
    parser.addOption({"primes", QString("Generate the native primes demo through this number (1..%1).")
        .arg(PG_PRIMES_MAX_COUNT), "count"});
    parser.addOption({"prime-limit", "Fixed sizing/growth limit (defaults to --primes count).", "count"});
    parser.addOption({"benchmark", "Write a JSON viewer benchmark and exit; requires --primes.", "file"});
    parser.addOption({"frames", "Camera frames sampled by --benchmark (1..10000).", "count", "120"});
    parser.addOption({"growth-steps", "Append this many columns after the camera benchmark; requires room under --prime-limit.", "count", "0"});
    parser.process(app);
    if (parser.positionalArguments().size() > 1) parser.showHelp(1);
    const auto integer = [&](const char *option, int minimum, int maximum) {
        bool valid = false;
        const int value = parser.value(option).toInt(&valid);
        if (!valid || value < minimum || value > maximum) {
            qCritical() << "Invalid --" << option << "; expected" << minimum << "through" << maximum;
            parser.showHelp(1);
        }
        return value;
    };
    const bool primes = parser.isSet("primes"), benchmark = parser.isSet("benchmark");
    if ((primes && !parser.positionalArguments().isEmpty()) ||
        (!primes && (benchmark || parser.isSet("prime-limit"))) ||
        (!benchmark && (parser.isSet("frames") || parser.isSet("growth-steps"))) ||
        (benchmark && (parser.isSet("snapshot") || parser.isSet("quit-after"))))
        parser.showHelp(1);
    const int primeCount = primes ? integer("primes", 1, PG_PRIMES_MAX_COUNT) : 0;
    const int primeLimit = parser.isSet("prime-limit") ? integer("prime-limit", primeCount, PG_PRIMES_MAX_COUNT) : primeCount;
    const int frames = benchmark ? integer("frames", 1, 10000) : 0;
    const int growthSteps = benchmark ? integer("growth-steps", 0, primeLimit - primeCount) : 0;
    QString source = ":/viewer/assets/proportion.parsegraph";
    if (!parser.positionalArguments().isEmpty())
        source = QFileInfo(parser.positionalArguments().first()).absoluteFilePath();
    if (primes) source.clear();

    qmlRegisterType<pgqt::GraphView>("Parsegraph.Native", 1, 0, "GraphView");
    QQmlApplicationEngine engine;
    engine.setInitialProperties({{"initialSource", source}});
    engine.load(QUrl("qrc:/viewer/Main.qml"));
    if (engine.rootObjects().isEmpty()) return 1;
    auto *window = qobject_cast<QQuickWindow *>(engine.rootObjects().first());
    if (!window) return 1;
    auto *view = window->findChild<pgqt::GraphView *>("graphView");
    if (!view) return 1;
    if (benchmark) {
        auto *runner = new pgqt::ViewerBenchmark(window, view,
            QFileInfo(parser.value("benchmark")).absoluteFilePath(), frames, growthSteps);
        QTimer::singleShot(0, runner, [runner, primeCount, primeLimit] {
            runner->start(primeCount, primeLimit);
        });
    } else if (primes && !view->loadPrimes(primeCount, primeLimit)) {
        qCritical() << "Could not generate primes:" << view->error();
        return 1;
    }

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
