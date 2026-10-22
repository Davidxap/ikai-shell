"""vt.py: a small VT screen model for the pty tests (no terminal, no screen). Enough of xterm for ito-fastfetch and ttfx output:
printable text (double-width aware), CR/LF/BS, CUP/HVP/CUU/CUD/CUF/CUB/CHA/VPA, ED/EL, ESC 7/8 and CSI s/u; SGR, modes, OSC and
APC (kitty graphics) are consumed and ignored. `images` records every kitty placement as (row, col, params) at the cursor.
"""
import re
import unicodedata


def cell_width(ch):
    if unicodedata.combining(ch):
        return 0
    return 2 if unicodedata.east_asian_width(ch) in "WF" else 1


class Screen:
    def __init__(self, cols, rows):
        self.cols, self.rows = cols, rows
        self.grid = [[" "] * cols for _ in range(rows)]
        self.x = self.y = 0
        self.saved = (0, 0)
        self.images = []
        self.torn = 0                    # wide glyphs left with a missing half (a write landed on one of their cells)
        self.wide_head = [[False] * cols for _ in range(rows)]
        self.wide_tail = [[False] * cols for _ in range(rows)]

    def _clear_wide(self, y, x):
        if self.wide_tail[y][x] and x > 0:
            self.wide_head[y][x - 1] = False
            self.grid[y][x - 1] = " "
            self.torn += 1
        if self.wide_head[y][x] and x + 1 < self.cols:
            self.wide_tail[y][x + 1] = False
            self.grid[y][x + 1] = " "
            self.torn += 1
        self.wide_head[y][x] = self.wide_tail[y][x] = False

    def put(self, ch):
        w = cell_width(ch)
        if w == 0:
            return
        if self.x + w > self.cols:
            self.x = 0
            self.lf()
        self._clear_wide(self.y, self.x)
        self.grid[self.y][self.x] = ch
        if w == 2:
            self._clear_wide(self.y, self.x + 1)
            self.wide_head[self.y][self.x] = True
            self.wide_tail[self.y][self.x + 1] = True
            self.grid[self.y][self.x + 1] = ""
        self.x += w

    def lf(self):
        if self.y + 1 >= self.rows:
            self.grid.pop(0)
            self.grid.append([" "] * self.cols)
            self.wide_head.pop(0)
            self.wide_head.append([False] * self.cols)
            self.wide_tail.pop(0)
            self.wide_tail.append([False] * self.cols)
        else:
            self.y += 1

    def feed(self, data):
        if isinstance(data, bytes):
            data = data.decode("utf-8", "replace")
        i, n = 0, len(data)
        while i < n:
            c = data[i]
            if c == "\x1b":
                nxt = data[i + 1] if i + 1 < n else ""
                if nxt == "[":
                    m = re.compile(r"[0-9;?<>=! ]*[@-~]").match(data, i + 2)
                    if not m:
                        break
                    self.csi(m.group(0))
                    i = m.end()
                elif nxt == "_" or nxt == "P" or nxt == "^":        # APC / DCS / PM, ends with ST
                    j = data.find("\x1b\\", i + 2)
                    if nxt == "_":
                        self.images.append((self.y, self.x, data[i + 2:j if j >= 0 else n][:120]))
                    i = (j + 2) if j >= 0 else n
                elif nxt == "]":
                    j1, j2 = data.find("\x07", i + 2), data.find("\x1b\\", i + 2)
                    ends = [e for e in (j1 + 1 if j1 >= 0 else -1, j2 + 2 if j2 >= 0 else -1) if e > 0]
                    i = min(ends) if ends else n
                elif nxt == "7":
                    self.saved = (self.y, self.x)
                    i += 2
                elif nxt == "8":
                    self.y, self.x = self.saved
                    i += 2
                else:
                    i += 2
            elif c == "\r":
                self.x = 0
                i += 1
            elif c == "\n":
                self.lf()
                i += 1
            elif c == "\b":
                self.x = max(0, self.x - 1)
                i += 1
            elif c == "\t":
                self.x = min(self.cols - 1, (self.x // 8 + 1) * 8)
                i += 1
            elif c < " " or c == "\x7f":
                i += 1
            else:
                self.put(c)
                i += 1

    def csi(self, seq):
        final, params = seq[-1], seq[:-1]
        if params.startswith("?") or params.startswith(">") or params.startswith("=") or params.startswith("<"):
            return
        nums = [int(p) if p.isdigit() else 0 for p in params.split(";")] if params else []
        a = lambda k, d=1: (nums[k] if len(nums) > k and nums[k] else d)
        if final in "Hf":
            self.y, self.x = min(self.rows - 1, a(0) - 1), min(self.cols - 1, a(1) - 1)
        elif final == "A":
            self.y = max(0, self.y - a(0))
        elif final == "B":
            self.y = min(self.rows - 1, self.y + a(0))
        elif final == "C":
            self.x = min(self.cols - 1, self.x + a(0))
        elif final == "D":
            self.x = max(0, self.x - a(0))
        elif final == "G":
            self.x = min(self.cols - 1, a(0) - 1)
        elif final == "d":
            self.y = min(self.rows - 1, a(0) - 1)
        elif final == "J":
            mode = nums[0] if nums else 0
            rng = range(self.y, self.rows) if mode == 0 else (range(0, self.y + 1) if mode == 1 else range(self.rows))
            for yy in rng:
                for xx in range(self.cols):
                    if mode == 0 and yy == self.y and xx < self.x:
                        continue
                    if mode == 1 and yy == self.y and xx > self.x:
                        continue
                    self._clear_wide(yy, xx)
                    self.grid[yy][xx] = " "
        elif final == "K":
            mode = nums[0] if nums else 0
            for xx in range(self.cols):
                if (mode == 0 and xx >= self.x) or (mode == 1 and xx <= self.x) or mode == 2:
                    self._clear_wide(self.y, xx)
                    self.grid[self.y][xx] = " "
        elif final == "s":
            self.saved = (self.y, self.x)
        elif final == "u":
            self.y, self.x = self.saved

    def lines(self):
        return ["".join(r).rstrip() for r in self.grid]

    def ink_box(self):
        """(left, right, top, bottom) cell indexes of the non-blank content, or None."""
        ys = [y for y, r in enumerate(self.grid) if "".join(r).strip()]
        if not ys:
            return None
        xs = [x for r in self.grid for x, ch in enumerate(r) if ch.strip()]
        return min(xs), max(xs), min(ys), max(ys)

    def margins(self):
        b = self.ink_box()
        if not b:
            return None
        l, r, t, bt = b
        # a double-width glyph's right edge is its tail cell
        for row in self.grid:
            for x, ch in enumerate(row):
                if ch == "" and x > r:
                    r = x
        return {"L": l, "R": self.cols - 1 - r, "T": t, "B": self.rows - 1 - bt}
