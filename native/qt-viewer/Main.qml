import QtQuick
import QtQuick.Controls
import QtQuick.Dialogs
import Parsegraph.Native 1.0

ApplicationWindow {
    id: window
    property string initialSource: ":/viewer/assets/proportion.parsegraph"
    width: 1120
    height: 800
    minimumWidth: 900
    minimumHeight: 520
    visible: true
    title: "Parsegraph — Native viewer"
    color: "#f3f5f7"

    component ActionButton: Button {
        opacity: enabled ? 1 : 0.4
        font.pixelSize: 13
        font.weight: Font.Medium
        leftPadding: 13
        rightPadding: 13
        topPadding: 9
        bottomPadding: 9
        contentItem: Text {
            text: parent.text
            font: parent.font
            color: parent.checked ? "#ffffff" : "#334155"
            horizontalAlignment: Text.AlignHCenter
            verticalAlignment: Text.AlignVCenter
        }
        background: Rectangle {
            radius: 6
            color: parent.checked ? "#0f766e" : parent.down ? "#dbe4e9" : parent.hovered ? "#e8eef2" : "#ffffff"
            border.color: parent.checked ? "#0f766e" : "#d9e1e7"
        }
    }

    header: Rectangle {
        height: 158
        color: "#ffffff"
        Rectangle { anchors.bottom: parent.bottom; width: parent.width; height: 1; color: "#dce3e9" }
        Row {
            x: 24; y: 17; spacing: 12
            Text { text: "Parsegraph"; font.pixelSize: 24; font.weight: Font.DemiBold; color: "#172c3c" }
            Rectangle {
                width: 100; height: 24; radius: 12; anchors.verticalCenter: parent.verticalCenter
                color: "#e3f2ef"
                Text { anchors.centerIn: parent; text: "NATIVE PREVIEW"; font.pixelSize: 9; font.weight: Font.DemiBold; font.letterSpacing: 0.5; color: "#136d63" }
            }
        }
        Text {
            x: 24; y: 53; text: graph.primeCount > 0 ? "Primes · 1 through " + graph.primeCount : graph.source.indexOf(":/viewer/") === 0 ? "Proportion study" : graph.source.split("/").pop()
            font.pixelSize: 14; color: "#64748b"
        }
        Row {
            x: 24; y: 77; spacing: 8
            Text { text: graph.nodeCount + " nodes"; font.pixelSize: 11; color: "#64748b" }
            Text { text: "·"; color: "#94a3b8" }
            Text { text: graph.groupCount + " paint groups"; font.pixelSize: 11; color: "#64748b" }
        }
        Row {
            anchors.right: parent.right; anchors.rightMargin: 24; y: 38; spacing: 8
            ActionButton { text: "Open…"; onClicked: fileDialog.open() }
            ActionButton { text: "Fit"; onClicked: { graph.fitGraph(); graph.forceActiveFocus() } }
            ActionButton { text: "−"; onClicked: graph.zoomOut() }
            Text { width: 48; anchors.verticalCenter: parent.verticalCenter; text: Math.round(graph.zoom * 100) + "%"; font.pixelSize: 12; color: "#475569"; horizontalAlignment: Text.AlignHCenter }
            ActionButton { text: "+"; onClicked: graph.zoomIn() }
            ActionButton { text: "Groups"; checkable: true; checked: graph.showGroups; onClicked: graph.showGroups = checked }
            ActionButton { text: "Extent bounds"; checkable: true; checked: graph.showExtents; onClicked: graph.showExtents = checked }
        }
        Row {
            x: 24; y: 111; spacing: 8
            ActionButton { text: "Proportion"; onClicked: graph.source = ":/viewer/assets/proportion.parsegraph" }
            Text { anchors.verticalCenter: parent.verticalCenter; text: "Primes through"; font.pixelSize: 12; color: "#475569" }
            SpinBox {
                id: primeTarget; from: 1; to: graph.maximumPrimeCount; value: graph.primeLimit > 0 ? graph.primeLimit : 100
                editable: true; width: 132; height: 34
                palette.base: "#ffffff"; palette.text: "#334155"
                palette.button: "#edf2f5"; palette.buttonText: "#334155"
            }
            ActionButton { text: "Build"; onClicked: graph.loadPrimes(primeTarget.value, primeTarget.value) }
            ActionButton { text: "Start at 1"; onClicked: graph.loadPrimes(1, primeTarget.value) }
            ActionButton { text: "+1"; enabled: graph.primeCount > 0 && graph.primeCount < graph.primeLimit; onClicked: graph.growPrimes(graph.primeCount + 1) }
            ActionButton { text: "+10"; enabled: graph.primeCount > 0 && graph.primeCount < graph.primeLimit; onClicked: graph.growPrimes(Math.min(graph.primeCount + 10, graph.primeLimit)) }
            Text {
                anchors.verticalCenter: parent.verticalCenter
                text: graph.primeCount > 0 ? "Fixed cells · limit " + graph.primeLimit : ""
                font.pixelSize: 11; color: "#64748b"
            }
        }
    }

    GraphView {
        id: graph
        objectName: "graphView"
        anchors.fill: parent
        source: window.initialSource
        focus: true
    }
    DropArea {
        anchors.fill: parent
        onDropped: function(drop) { if (drop.hasUrls) graph.source = drop.urls[0].toString() }
    }
    Rectangle {
        anchors.top: parent.top; anchors.left: parent.left; anchors.right: parent.right
        anchors.margins: 20; height: errorText.implicitHeight + 24; radius: 8; color: "#fff1f2"
        visible: graph.error.length > 0
        Text { id: errorText; anchors.fill: parent; anchors.margins: 12; text: graph.error; wrapMode: Text.Wrap; color: "#9f1239"; font.pixelSize: 13 }
    }
    Rectangle {
        visible: graph.selectedId.length > 0
        anchors.left: parent.left; anchors.bottom: parent.bottom; anchors.margins: 20
        width: 250; height: selectionText.implicitHeight + 28; radius: 8; color: "#f8ffffff"; border.color: "#d9e1e7"
        Text {
            id: selectionText; anchors.fill: parent; anchors.margins: 14
            text: graph.selectedId + (graph.selectedText.length ? "\n“" + graph.selectedText + "”" : "\nUnlabeled node")
            font.pixelSize: 12; lineHeight: 1.4; color: "#334155"; wrapMode: Text.Wrap
        }
    }
    footer: Rectangle {
        height: graph.ignoredCapabilities.length || graph.primeCount > 0 ? 58 : 36
        color: "#ffffff"
        Rectangle { width: parent.width; height: 1; color: "#dce3e9" }
        Text {
            x: 24; y: 11; text: "Drag / trackpad to pan  ·  Wheel / pinch to zoom  ·  Click to select  ·  F to fit"
            font.pixelSize: 11; color: "#64748b"
        }
        Text {
            anchors.right: parent.right; anchors.rightMargin: 24; y: 11
            text: "C layout  /  Qt Quick"; font.pixelSize: 11; color: "#80909f"
        }
        Text {
            x: 24; y: 33; visible: graph.ignoredCapabilities.length > 0
            text: "Unsupported capabilities: " + graph.ignoredCapabilities.join(", ")
            font.pixelSize: 11; color: "#976c23"
        }
        Text {
            x: 24; y: 33; visible: graph.primeCount > 0
            text: {
                const stats = graph.demoBuildStats
                if (!stats || stats.layoutMs === undefined) return ""
                return "Last update: build " + stats.generationMs.toFixed(1) + " ms · layout " + stats.layoutMs.toFixed(1)
                    + " ms · snapshot " + stats.snapshotMs.toFixed(1) + " ms · scene CPU " + graph.lastSceneBuildMs.toFixed(1)
                    + " ms · " + stats.nodesCommitted + " nodes laid out"
            }
            font.pixelSize: 11; color: "#64748b"
        }
    }
    FileDialog {
        id: fileDialog
        title: "Open a Parsegraph document"
        nameFilters: ["Parsegraph documents (*.parsegraph)", "JSON documents (*.json)"]
        onAccepted: { graph.source = selectedFile.toString(); graph.forceActiveFocus() }
    }
}
