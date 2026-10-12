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
