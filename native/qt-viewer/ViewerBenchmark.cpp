#include "ViewerBenchmark.h"
#include "GraphView.h"

#include <QCoreApplication>
#include <QJsonDocument>
#include <QQuickWindow>
#include <QSaveFile>
#include <QScreen>
#include <QSGRendererInterface>
#include <QSysInfo>
#include <QTimer>
#include <algorithm>
#include <chrono>
#include <cmath>

namespace pgqt {
namespace {
qint64 nowNs() {
    return std::chrono::duration_cast<std::chrono::nanoseconds>(
        std::chrono::steady_clock::now().time_since_epoch()).count();
}
QJsonObject distribution(std::vector<double> samples) {
    std::sort(samples.begin(), samples.end());
    double sum = 0;
    for (double value : samples) sum += value;
    const auto percentile = [&](double fraction) {
        return samples.at(size_t(std::ceil(samples.size() * fraction)) - 1);
    };
    return {{"samples", int(samples.size())}, {"meanMs", sum / samples.size()},
            {"p50Ms", percentile(.5)}, {"p95Ms", percentile(.95)},
            {"maxMs", samples.back()}};
}
}

ViewerBenchmark::ViewerBenchmark(QQuickWindow *window, GraphView *view,
                                 QString output, int frames, int growthSteps)
    : QObject(window), window_(window), view_(view), output_(std::move(output)),
      frames_(frames), remainingGrowth_(growthSteps) {
    // Timestamp on the render thread; deliver to the GUI thread for mutation.
    // frameSwapped means a frame has been queued for presentation, not GPU time.
    connect(window, &QQuickWindow::frameSwapped, this, [this] {
        const auto timestamp = nowNs();
        const auto sceneBuild = view_->geometryBuildCount();
        QMetaObject::invokeMethod(this, [this, timestamp, sceneBuild] { frame(timestamp, sceneBuild); },
                                  Qt::QueuedConnection);
    }, Qt::DirectConnection);
    QTimer::singleShot(60000 + frames * 100 + growthSteps * 1000, this, [this] {
        if (phase_ != Phase::Finished) {
            qCritical("Viewer benchmark timed out waiting for rendered frames.");
            QCoreApplication::exit(1);
        }
    });
}

void ViewerBenchmark::start(int count, int sizingLimit) {
    report_ = {{"schemaVersion", 1}, {"qtVersion", qVersion()},
               {"platform", QSysInfo::prettyProductName()},
               {"cpuArchitecture", QSysInfo::currentCpuArchitecture()},
               {"initialCount", count}, {"sizingLimit", sizingLimit},
               {"growthSteps", remainingGrowth_},
               {"windowWidth", window_->width()}, {"windowHeight", window_->height()},
               {"devicePixelRatio", window_->devicePixelRatio()},
               {"screenRefreshHz", window_->screen() ? window_->screen()->refreshRate() : 0},
               {"notes", "Release builds recommended. Scene time is CPU vertex/glyph creation and previous scene disposal, not GPU duration. Frame intervals use frameSwapped timestamps and include presentation pacing. Growth retains native nodes/layout but rebuilds the full drawing snapshot and Qt scene. Fixed math cells use sizingLimit; all nodes are loaded, without application-level culling or label LOD."}};
    expectedBuild_ = view_->geometryBuildCount() + 1;
    started_ = nowNs();
    if (!view_->loadPrimes(count, sizingLimit)) {
        qCritical() << "Benchmark generation failed:" << view_->error();
        phase_ = Phase::Finished;
        QCoreApplication::exit(1);
    }
}

QJsonObject ViewerBenchmark::sample(qint64 timestamp) const {
    QJsonObject result = QJsonObject::fromVariantMap(view_->demoBuildStats());
    result.insert("nodes", view_->nodeCount());
    result.insert("groups", view_->groupCount());
    result.insert("sceneBuildMs", view_->lastSceneBuildMs());
    result.insert("throughFrameSubmissionMs", (timestamp - started_) / 1e6);
    result.insert("geometryBuildCount", qint64(view_->geometryBuildCount()));
    return result;
}

void ViewerBenchmark::frame(qint64 timestamp, qulonglong sceneBuild) {
    if (phase_ == Phase::Finished || started_ == 0 || timestamp < started_ ||
        sceneBuild < expectedBuild_) return;
    if (phase_ == Phase::Cold) {
        report_.insert("graphicsApi", int(window_->rendererInterface()->graphicsApi()));
        report_.insert("cold", sample(timestamp));
        cameraBuild_ = view_->geometryBuildCount();
        phase_ = Phase::Warmup;
    } else if (phase_ == Phase::Warmup) {
        if (--warmup_ == 0) phase_ = Phase::Camera;
    } else if (phase_ == Phase::Camera) {
        frameIntervals_.push_back((timestamp - previousFrame_) / 1e6);
        if (int(frameIntervals_.size()) >= frames_) {
            auto camera = distribution(frameIntervals_);
            camera.insert("geometryRebuilds", qint64(view_->geometryBuildCount() - cameraBuild_));
            report_.insert("cameraFrameIntervals", camera);
            beginGrowth();
            return;
        }
    } else if (phase_ == Phase::Growth) {
        updates_.append(sample(timestamp));
        beginGrowth();
        return;
    }
    previousFrame_ = timestamp;
    // Alternate direction periodically to keep the graph within the viewport.
    const int frameIndex = int(frameIntervals_.size()) + warmup_;
    view_->panBy(frameIndex % 40 < 20 ? 1 : -1, 0);
}

void ViewerBenchmark::beginGrowth() {
    if (remainingGrowth_ == 0) { finish(); return; }
    --remainingGrowth_;
    phase_ = Phase::Growth;
    expectedBuild_ = view_->geometryBuildCount() + 1;
    started_ = nowNs();
    if (!view_->growPrimes(view_->primeCount() + 1)) {
        qCritical() << "Benchmark growth failed:" << view_->error();
        phase_ = Phase::Finished;
        QCoreApplication::exit(1);
        return;
    }
    view_->fitGraph();
}

void ViewerBenchmark::finish() {
    phase_ = Phase::Finished;
    report_.insert("growth", updates_);
    QSaveFile output(output_);
    const auto bytes = QJsonDocument(report_).toJson(QJsonDocument::Indented);
    if (!output.open(QIODevice::WriteOnly) || output.write(bytes) != bytes.size() || !output.commit()) {
        qCritical() << "Could not write benchmark:" << output.errorString();
        QCoreApplication::exit(1);
        return;
    }
    qInfo() << "Saved benchmark" << output_;
    QCoreApplication::quit();
}
}
