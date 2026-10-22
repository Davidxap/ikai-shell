---
name: ito-verse-doctor
description: Diagnose and fix the IKAI shell, formerly Ito-verse (Quickshell bar for Omarchy): two bars, ghost workspaces, missing widgets, errors in the Health page, a bar that will not start. Use when the user says the bar is broken, duplicated, missing, shows errors, or a widget or icon does not appear.
---

# IKAI doctor

The shell reports its own problems and knows the safe fix for most of them. Use that before guessing.

## 1. Look
```
~/.config/omarchy/bar/modules/bin/ito-health --text
```
Each line is `[ok|WARN|FAIL] name: what was found`. A problem is followed by `why:` (what it means for the user) and
`fix:` (what to do, with the command when there is one). Errors from the log are listed one per distinct error with
the file it comes from and how often. For JSON use it with no flag.

## 1b. A full report for an assistant
```
ito-health --report          # Markdown: instructions, findings, the machine, the bar's state, the recent log, every fix
ito-health --report --save   # the same, into ~/ito-health-report.md
```
Users paste this into any AI assistant (the Health page has a "Copy report for an AI assistant" button). If you are that
assistant: follow its "Instructions for the assistant" section, run the `--fix` ids it lists, then `--text` to confirm.

## 2. Fix
```
ito-health --fix <id>      # the id is in the "fix:" line, e.g. onebar, headless, markers, plugins, seal, restart
ito-health --fix all       # every offered fix, with one restart at the end
```
Then run `ito-health --text` again to confirm. Restarts always go through `ito-restart`, never `pkill -f quickshell`
(that also kills the terminal running the command) and never a bare `omarchy-launch-shell`.

## 3. The problems that come back
| Symptom | Cause | Fix id |
|---|---|---|
| Two bars stacked | the shell reloaded a plugin while running and left the old window, or a restart was cut short | `onebar` |
| Workspaces look duplicated, a window "vanished" | a virtual/headless output is left over and holds a workspace | `headless` |
| No bar after a restart | the engine's signature (`.ito-managed.json`) no longer matches its files | `markers` |
| A widget is missing | its plugin folder is gone; the engine drops it from the layout for good | `plugins` |
| Cannot reach the control centre | the seal was switched off | `seal` |
| Blank picture | an image file is missing | `deploy` |
| Settings ignored | `ito-style.json` damaged | `settings` |
| A picture of your own is blank | the adapted copy is gone or the file was removed | `pictures` |

The full list, with the log message each one matches, is `docs/TROUBLESHOOTING.md` (made by `ito-health --table`).

## 4. Rules when working on the shell
- Deploy with `scripts/deploy.sh` (it restarts cleanly when files changed). Never copy files into a running shell by hand.
- Never create a virtual output (`hyprctl output create headless`) without removing it in the same command.
- The redrawn icons in `bar/modules/ito-art/` are the source of truth; there is no generator that rebuilds them from a sheet.
- One restart at a time: `ito-restart status` must end at `{"shells":1,"launchers":1,...}`.
- An error with no note in the table: send the `--text` report, do not guess.
