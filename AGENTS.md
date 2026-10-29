# Majesty workspace testing constraints

The user explicitly lifted the browser/game launch suspension on October 9,
2026 and requested this instruction update. Browser game launches and live
co-op verification are authorized again. The earlier host-app crashes remain
unresolved, so preserve bounded testing and resource precautions across goal
continuations.

- Keep all owned browser test sessions silent. Launch test Chrome with
  `--mute-audio` (the project `agent-browser.json` supplies this default),
  including both players in co-op trials. Pass the same trial launch config
  (profile, executable and muted audio) on every automation command so launch
  reconciliation cannot replace the owned profile. Preserve user-tab audio settings.
- Browser WASM game launches and inspection are allowed. Use isolated test
  profiles and owned tabs, start with one game, and add a second only for the
  required paired co-op trial. Release owned engines and tabs after each trial.
  Stop a trial if the host app crashes or resource limits are exceeded. Do not
  switch browser control mechanisms to bypass a rejected browser action.
- Continue lightweight terminal work, focused JavaScript tests and static
  analysis.
  Run at most one resource-intensive build or native game process at
  a time, and only when a code change or unresolved failure justifies it.
- Keep tool output small. Never print binary/base64 output or full process
  command lines that might contain credentials.
- Check the actual process/session before restarting a service or test. A tool
  timeout is not evidence that the game stopped. Preserve player profiles and
  user tabs; never inspect browser storage through private browser files.
  Check the owned trial's guard-stop/stop markers before further browser
  commands. After a guard stops a trial, perform cleanup only: the automation
  CLI can otherwise launch a new browser even for an inspection command.
  Wait for launch readiness before issuing dependent browser commands.
- Current crash evidence is in `output/app-crash-investigation.json` and
  `output/app-crash-allocator-audit.json`. Three reports show host-app SIGTRAP
  on Chrome_IOThread. Two UUID-matched framework cases follow an allocator OOM
  signature with a 2 MiB requested allocation. The exhausted resource, memory
  source and exact trigger remain unresolved; this does not establish system
  RAM exhaustion or establish the cause. Browser paired-publication recovery
  is unverified; the renewed authorization allows testing, not a claim that
  the crash has been fixed.
- Read the upstream AGENTS.md before changing the game or runtime. Native
  builds use the official game tools; generated translations are not edited.

# UI consistency

- All new or changed UI elements must follow Majesty's existing native UI design system: match the surrounding framing, bevels, palette, icon scale, typography, spacing and interaction states. Reuse native UI components and resource templates where available.
- Palace building-list icons use the native 25-by-25 framed emblem contract, with an opaque inset background and readable artwork inside the frame. Do not substitute an unframed world sprite or transparent thumbnail. Check new elements beside stock UI at native scale before shipping.
- Campaign-map landmarks must retain the native interaction feedback, including the warm background glow on hover. Verify both idle and hover states against stock markers, keep their placement stable, and preserve seamless terrain/coast edges.

# Retired content

- Lost Trail, Wayfinder and Trail Lodge were removed at the user's request on October 13, 2026. Preserve their archived sources and existing player saves, but do not reactivate them or resume their narration/content work unless explicitly requested. Live game launches use the original Majesty collection. Prioritize substantive, compatible community content over renamed stock classes.

- More Heroes was retired at Mike's request on October 29, 2026 because its
  reused stock art did not meet the desired character/UI distinction. Keep
  Adventurers Guild and The Royal Menagerie active. Preserve More Heroes
  sources and saved actor definitions, but do not restore new construction,
  recruitment or random arrivals without an explicit request. Reintroduction
  requires distinct artwork and native-scale UI review; see
  `docs/more-heroes-art-direction.md`.
