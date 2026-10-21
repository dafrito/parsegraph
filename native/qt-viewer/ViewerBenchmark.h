#ifndef PARSEGRAPH_VIEWER_BENCHMARK_H
#define PARSEGRAPH_VIEWER_BENCHMARK_H

#include <QJsonArray>
#include <QJsonObject>
#include <QObject>
#include <vector>

class QQuickWindow;
namespace pgqt {
class GraphView;

// Runs in the real viewer: cold load, cached camera motion, then optional
// append/layout/snapshot/scene updates. CPU timings are not GPU timings.
class ViewerBenchmark final : public QObject {
public:
    ViewerBenchmark(QQuickWindow *, GraphView *, QString output, int frames,
                    int growthSteps);
    void start(int count, int sizingLimit);
private:
    enum class Phase { Cold, Warmup, Camera, Growth, Finished };
    void frame(qint64 timestamp, qulonglong sceneBuild);
    void beginGrowth();
    void finish();
    QJsonObject sample(qint64 timestamp) const;
    QQuickWindow *window_;
    GraphView *view_;
    QString output_;
    int frames_, remainingGrowth_, warmup_ = 10;
    Phase phase_ = Phase::Cold;
    qint64 started_ = 0, previousFrame_ = 0;
    qulonglong expectedBuild_ = 0, cameraBuild_ = 0;
    std::vector<double> frameIntervals_;
    QJsonObject report_;
    QJsonArray updates_;
};
}
#endif
