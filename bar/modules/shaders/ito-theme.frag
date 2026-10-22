#version 440

// Recolours the shell's pre-drawn art onto the installed theme.
//
// The art is bone linework on black, with crimson where something bleeds. Under a theme every pixel is placed
// on the line between the theme's background and its foreground (or its accent, for the crimson): black goes
// to the background, bone goes to the foreground, and everything between keeps its place on that line, so the
// hatching, the wear and the antialiasing survive the change intact. That one rule is what lets it work on a
// dark theme (light lines on a dark plate) and on a light one (dark lines on a light plate) alike. A pixel is
// told apart as blood by how much redder than it is green (bone is neutral, blood is not).

layout(location = 0) in vec2 qt_TexCoord0;
layout(location = 0) out vec4 fragColor;

layout(std140, binding = 0) uniform buf {
    mat4 qt_Matrix;
    float qt_Opacity;
    vec4 fg;          // the theme's foreground
    vec4 accent;      // the theme's accent
    vec4 baseFg;      // the bone the art was drawn in
    vec4 baseAccent;  // the crimson the art was drawn in
    vec4 bg;          // the theme's background: what black becomes
};

layout(binding = 1) uniform sampler2D source;

void main() {
    vec4 c = texture(source, qt_TexCoord0);
    if (c.a < 0.001) {
        fragColor = vec4(0.0);
        return;
    }
    vec3 rgb = c.rgb / c.a;                                  // straight colour from premultiplied
    float lum = dot(rgb, vec3(0.299, 0.587, 0.114));
    float baseLum = dot(baseFg.rgb, vec3(0.299, 0.587, 0.114));
    float red = smoothstep(0.12, 0.42, rgb.r - max(rgb.g, rgb.b));

    vec3 bone = mix(bg.rgb, fg.rgb, clamp(lum / baseLum, 0.0, 1.25));
    vec3 blood = mix(bg.rgb, accent.rgb, clamp(rgb.r / max(baseAccent.r, 0.05), 0.0, 1.25));
    vec3 outRgb = clamp(mix(bone, blood, red), 0.0, 1.0);
    fragColor = vec4(outRgb * c.a, c.a) * qt_Opacity;
}
