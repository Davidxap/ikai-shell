import QtQuick
import "../ito.indicators" as Indicators

// Night Light on its own: the indicators widget showing only this one, so it can be placed and moved by itself.
Indicators.BarWidget {
  moduleName: "ito.nightlight"
  only: "night"
}
