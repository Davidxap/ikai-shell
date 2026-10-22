#!/usr/bin/env python3
"""The live-settings sweep's guard (scripts/qa/sweep-settings.py, T15): backup + marker, refusal while a marker exists (the backup is
never overwritten by a rerun), a verified byte-for-byte restore, and a restore on SIGTERM. Runs on a scratch copy only (ITO_SWEEP_DIR,
ITO_SWEEP_STYLE in a mktemp dir): the live ito-style.json is never written (it is only read, to prove it did not change).

    python3 scripts/qa/test-sweep-guard.py
"""
import atexit, importlib.util, os, shutil, signal, subprocess, sys, tempfile, textwrap, time

HERE = os.path.dirname(os.path.abspath(__file__))
SWEEP = os.path.join(HERE, "sweep-settings.py")
tmp = tempfile.mkdtemp(prefix="ito-sweep-guard-")
atexit.register(shutil.rmtree, tmp, True)      # the scratch copy goes with the test, as test-ito-config.sh does
os.environ["ITO_SWEEP_DIR"] = os.path.join(tmp, "sweep")
os.environ["ITO_SWEEP_STYLE"] = os.path.join(tmp, "ito-style.json")
LIVE = os.path.expanduser("~/.config/omarchy/bar/modules/ito-style.json")
live_before = open(LIVE, "rb").read() if os.path.exists(LIVE) else None
ORIG = b'{"iconStyle": "manga", "iconScale": 0.54}\n'
with open(os.environ["ITO_SWEEP_STYLE"], "wb") as fh:
    fh.write(ORIG)


def load():
    spec = importlib.util.spec_from_file_location("sweep_settings", SWEEP)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def fail(msg):
    print("FAIL:", msg)
    sys.exit(1)


S = load()
if S.STYLE != os.environ["ITO_SWEEP_STYLE"] or not S.DIR.startswith(tmp):
    fail("the env overrides are not honoured")
# 1. begin: backup + marker
S.begin()
if not os.path.exists(S.MARKER) or open(S.BACKUP, "rb").read() != ORIG:
    fail("begin did not write the backup and the marker")
# 2. a "sweep" changes the file, then a rerun while the marker is there must refuse and keep the first backup
with open(S.STYLE, "wb") as fh:
    fh.write(b'{"iconStyle": "gothic"}\n')
r = subprocess.run([sys.executable, "-c", "import importlib.util,sys;s=importlib.util.spec_from_file_location('s',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.begin()", SWEEP],
                   capture_output=True, text=True, env=os.environ)
if r.returncode != 2 or "refusing to start" not in r.stderr or "cp " not in r.stderr:
    fail(f"a second run did not refuse (rc {r.returncode}): {r.stderr!r}")
if open(S.BACKUP, "rb").read() != ORIG:
    fail("the refused run overwrote the backup")
# 3. restore: byte-identical, marker removed
if not S.restore() or open(S.STYLE, "rb").read() != ORIG or os.path.exists(S.MARKER):
    fail("restore did not bring the backup back byte for byte and drop the marker")
# 4. a mismatch is reported (restore returns False, the marker stays)
S2 = load()
S2.begin()
orig_copy = S2.shutil.copyfile
S2.shutil.copyfile = lambda a, b: open(b, "wb").write(b"{}\n")
if S2.restore() or not os.path.exists(S2.MARKER):
    fail("a restore that does not match was not reported")
S2.shutil.copyfile = orig_copy
if not S2.restore():
    fail("the second restore attempt failed")
# 5. SIGTERM mid-run restores (the main loop is replaced by a sleep)
child = textwrap.dedent(f"""
    import importlib.util, sys, time
    s = importlib.util.spec_from_file_location("s", {SWEEP!r}); m = importlib.util.module_from_spec(s); s.loader.exec_module(m)
    m.errors = lambda: {{}}
    m.SWEEP = [("k", ["v"])]
    def cfg(*a):
        open(m.STYLE, "w").write('{{"swept": true}}')
        time.sleep(30)
    m.cfg = cfg
    m.main()
""")
p = subprocess.Popen([sys.executable, "-c", child], env=os.environ, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
for _ in range(100):
    if os.path.exists(S.MARKER) and open(S.STYLE, "rb").read() != ORIG:
        break
    time.sleep(0.05)
p.send_signal(signal.SIGTERM)
p.wait(timeout=10)
if open(S.STYLE, "rb").read() != ORIG or os.path.exists(S.MARKER):
    fail("SIGTERM did not restore the sidecar")
# the live sidecar was never touched
if live_before is not None and open(LIVE, "rb").read() != live_before:
    fail("the live ito-style.json changed")
print("ok: sweep guard (backup + marker, refusal, verified restore, SIGTERM) on a scratch copy")
