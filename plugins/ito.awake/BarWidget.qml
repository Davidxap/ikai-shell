import QtQuick
import "../ito.indicators" as Indicators

// Stay Awake on its own: the indicators widget showing only this one, so it can be placed and moved by itself.
Indicators.BarWidget {
  moduleName: "ito.awake"
  only: "awake"
}
