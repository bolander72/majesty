# Cached frame submissions respect the selected FPS limit

The presenter previously submitted the same acknowledged image on every display
callback, even when Graphics selected a lower FPS limit. A fake presenter at
240 Hz reproduced 240 repeat submissions per second for each 40, 60 and 120 FPS
choice. The initial focused regression failed 11 of 22 checks.

The presenter now budgets repeat submissions independently of fresh game frames.
It retains fractional deadlines, so a 60 FPS choice also works on a 144 Hz
display. A delayed callback admits one repeat rather than accumulating catch-up
work. Clock reversal resets the budget. Changing the FPS choice takes effect
relative to the most recent admission. Resize and surface migration bypass the
budget and remain pending while an earlier flight prevents submission. Completion
and retirement run before the repeat gate. Fresh frames bypass it; offscreen and
uncapped behavior retain their existing cadence. The budget uses fixed scalar
state and does not change simulation time, resolution or sprite detail.

Official focused native checks, built with one job, pass:

- `presenter_repeat_tests`: 35 checks, zero failures; 144/240 Hz callbacks with
  40/60/120 FPS choices, fresh frames, immediate/deferred resize, live FPS changes,
  delayed/reversed clocks, GPU retirement, uncapped and offscreen cases.
- `presenter_service_tests`: 339 checks, zero failures; existing fake presenter,
  ownership, completion, migration, layout and presentation cases plus the new
  repeat checks. These use fake devices and do not launch the game or browser.

Run from `upstream/majesty-recomp`:

```sh
.venv/bin/python kit/tools/test.py --game-dir "$PWD" --native-test presenter_repeat_tests --jobs 1
.venv/bin/python kit/tools/test.py --game-dir "$PWD" --native-test presenter_service_tests --jobs 1
```

Evidence and frozen source copies are in
`output/presenter-repeat-pacing-001/observed.json`; the original failing log and
binary/source hashes are retained separately. Future private WASM builds now
also freeze `kit/host/present_thread.cpp`. Private candidate010 now compiles
with this change through the official one-job builder and passes static
inspection; it is not staged or launched. The served engine remains unchanged.
This demonstrates fewer redundant
submissions in the fake tests, not measured browser CPU/GPU/RAM savings. The
app-crash suspension, browser qualification and overall goal remain open.
