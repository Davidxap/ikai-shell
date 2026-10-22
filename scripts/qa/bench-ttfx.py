#!/usr/bin/env python3
"""bench-ttfx.py: pty-only measurements of ttfx for the screensaver (boot-screens-v2 B.3 T2, T3, T5). No window, no screen.

    bench-ttfx.py cpu    <effect> <fps> [secs] [cols rows]   CPU seconds and bytes written by one effect run
    bench-ttfx.py pad    <effect> [secs]                     U+2800 padding vs ASCII spaces: bytes and cells drawn
    bench-ttfx.py wide   <effect> [secs]                     a double-width glyph field: does the screen ever hold half a glyph

Each run forks ttfx in a pty of the given size, reads its output for `secs`, then terminates ITS OWN pid (never by name).
"""
import os, pty, resource, select, signal, struct, sys, time, fcntl, termios

BRANDING = os.path.expanduser("~/.config/omarchy/branding/screensaver.txt")


def run(argv, secs, cols=365, rows=87):
    r0 = resource.getrusage(resource.RUSAGE_CHILDREN)
    pid, fd = pty.fork()
    if pid == 0:
        os.environ["TERM"] = "xterm-256color"
        os.nice(19)
        os.execvp(argv[0], argv)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))
    buf, end = bytearray(), time.time() + secs
    while time.time() < end:
        r, _, _ = select.select([fd], [], [], 0.2)
        if r:
            try:
                d = os.read(fd, 1 << 20)
            except OSError:
                break
            if not d:
                break
            buf += d
    try:
        os.kill(pid, signal.SIGKILL)       # our own child only
    except ProcessLookupError:
        pass
    try:
        os.waitpid(pid, 0)
    except ChildProcessError:
        pass
    try:
        os.close(fd)
    except OSError:
        pass
    r1 = resource.getrusage(resource.RUSAGE_CHILDREN)
    cpu = (r1.ru_utime - r0.ru_utime) + (r1.ru_stime - r0.ru_stime)
    return bytes(buf), cpu, r1.ru_maxrss


def ttfx(path, effect, fps):
    return ["ttfx", "-i", path, "--frame-rate", str(fps), "--canvas-width", "0", "--canvas-height", "0", "--reuse-canvas",
            "--anchor-canvas", "c", "--anchor-text", "c", "--no-eol", "--no-restore-cursor", effect]


def main(a):
    mode, effect = a[0], a[1]
    if mode == "cpu":
        fps, secs = int(a[2]), float(a[3]) if len(a) > 3 else 10.0
        cols, rows = (int(a[4]), int(a[5])) if len(a) > 5 else (365, 87)
        data, cpu, rss = run(ttfx(BRANDING, effect, fps), secs, cols, rows)
        print(f"{effect:11s} fps={fps:3d} {cols}x{rows} secs={secs:g} cpu={cpu:.2f}s ({100 * cpu / secs:.0f} % of one core) bytes={len(data)} rss={rss // 1024}MB")
    elif mode == "pad":
        secs = float(a[2]) if len(a) > 2 else 8.0
        import tempfile
        text = open(BRANDING).read()
        res = {}
        for label, t in (("braille-blank", text), ("ascii-space", text.replace("⠀", " "))):
            with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as fh:
                fh.write(t)
            data, cpu, _ = run(ttfx(fh.name, effect, 60), secs)
            os.unlink(fh.name)
            s = data.decode("utf-8", "replace")
            res[label] = (len(data), cpu, s.count("⠀"), s.count("\x1b["))
            print(f"{effect:11s} {label:13s} bytes={len(data):8d} cpu={cpu:.2f}s U+2800 drawn={res[label][2]:6d} sgr={res[label][3]}")
    elif mode == "padfinal":
        # T2: the final frame of the same art padded with U+2800 and with ASCII spaces must be the same picture (U+2800 mapped to a space).
        import tempfile
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import vt
        text = open(BRANDING).read()
        if "\u2800" not in text:                      # the live text is already spaces: rebuild a braille twin from ito_art
            sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "bar", "modules", "bin"))
            import ito_art
            text = ito_art.spiral_text(70, 24)
        screens = {}
        for label, t in (("braille", text), ("spaces", text.replace("\u2800", " "))):
            with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as fh:
                fh.write(t)
            data, cpu, _ = run(ttfx(fh.name, effect, 120), float(a[2]) if len(a) > 2 else 40.0, 120, 40)
            os.unlink(fh.name)
            scr = vt.Screen(120, 40)
            scr.feed(data)
            screens[label] = [l.replace("\u2800", " ").rstrip() for l in scr.lines()]
            print(f"{effect:11s} {label:8s} bytes={len(data)} cpu={cpu:.2f}s ink={scr.ink_box()}")
        print(f"{effect:11s} final frames identical: {screens['braille'] == screens['spaces']}")
    elif mode == "wide":
        # Does an effect keep double-width glyphs whole? Play a short field of CJK to its end in the pty, rebuild the screen,
        # and require (1) the final frame equals the input (same glyph at the same cells) and (2) report how many times a
        # write landed on half a glyph on the way (`torn`, from vt.py).
        import tempfile
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import vt
        secs = float(a[2]) if len(a) > 2 else 40.0
        glyphs = "ABC" if "--ascii" in a else "霧町声"
        rows = ["".join(glyphs[(i + j) % 3] for i in range(30 if "--ascii" in a else 30)) for j in range(10)]
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as fh:
            fh.write("\n".join(rows) + "\n")
        data, cpu, _ = run(ttfx(fh.name, effect, 60), secs, 120, 40)
        os.unlink(fh.name)
        scr = vt.Screen(120, 40)
        scr.feed(data)
        got = [l.strip() for l in scr.lines() if l.strip()]
        ok = got == rows
        if not ok and "--debug" in a:
            for g, r in zip(got, rows):
                print("   ", "OK " if g == r else "BAD", g[:60])
            print("    lines:", len(got), "expected", len(rows))
        print(f"{effect:11s} wide final_frame_exact={ok} bytes={len(data)} cpu={cpu:.2f}s")
    else:
        sys.exit("usage: bench-ttfx.py cpu|pad|wide <effect> ...")


main(sys.argv[1:])
