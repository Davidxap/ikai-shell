import QtQuick
import "ItoCanon.js" as Canon

// The shader that moves the shell's pre-drawn art onto the installed theme (see shaders/ito-theme.frag).
// Used as a layer effect: Qt hands the layer to `source` itself.
ShaderEffect {
  id: root

  property var palette: null
  property variant source

  // what the art is drawn in, and what it should become
  property color fg: palette ? palette.bone : Canon.BONE
  property color accent: palette ? palette.blood : Canon.BLOOD
  property color bg: palette ? palette.ink : Canon.INK
  property color baseFg: Canon.BONE
  property color baseAccent: Canon.BLOOD

  fragmentShader: Qt.resolvedUrl("shaders/ito-theme.frag.qsb")
}
