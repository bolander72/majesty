# Conservative browser growth build profile

The official Kit build tool now accepts
`--target web --web-memory-growth conservative`. Its CMake profile emits
`MEMORY_GROWTH_GEOMETRIC_STEP=0.05` and
`MEMORY_GROWTH_GEOMETRIC_CAP=16777216`. These are the
[Emscripten geometric-growth settings](https://emscripten.org/docs/tools_reference/settings_reference.html#memory-growth-geometric-step).
They reduce excess reservations; they do not cap the game's required
allocation below the existing maximum.

The default remains `legacy`, with explicit 20% steps and 96 MiB excess.
The CLI always passes the selected/default policy, so running a normal web
build after an experimental one resets its cached choice. Native targets
reject the web-only option, and both the CLI and CMake reject unknown policies.
Initial memory (512 MiB), maximum memory, worker count and stack sizes are
unchanged by either profile.

| Model: 512 MiB current capacity, request one byte larger | Legacy | Conservative |
| --- | --- | --- |
| First attempted capacity | 608.0625 MiB | 528.0625 MiB |
| Excess reservation reduction | — | 80 MiB |
| Retries after first two refusals | Smaller geometric attempts | 524.8125 then 518.4375 MiB |

The comparison uses a **test-only copy** of the staged resize function with
constants substituted from the evaluated CMake options. It does not edit the
served JavaScript, allocate a WASM heap or establish what a future compiler
will emit. Eight cases check first success, retries, complete refusal and
large allocations across both policies. The conservative retries remain
distinct; lowering only the cap would otherwise repeat the same attempt for
this input. Requests larger than the geometric candidate still reach their
page-aligned requested capacity.

The 17 build-tool tests and two CMake-script tests pass. They include actual
`build.py.main` routing with mocked build/configure calls, explicit default
reset, invalid-policy/native-target rejection, real CMake function evaluation
and rejection of extra flag text. CMake runs in script mode on temporary files;
it does not configure or compile the host project.

Reproduce the lightweight checks from the workspace root:

```sh
cd upstream/majesty-recomp/kit
../.venv/bin/python -m unittest discover -s tests -p test_build_py.py
../.venv/bin/python -m unittest discover -s tests -p test_web_memory_policy.py
cd ../../..
upstream/majesty-recomp/.venv/bin/python scripts/check-web-memory-policy-config.py
node scripts/check-conservative-growth-policy.mjs
python3 scripts/qualify-web-memory-policy.py
```

The eventual compilation step uses the game wrapper, after loading the local
Emscripten SDK environment:

```sh
cd upstream/majesty-recomp
.venv/bin/python tools/build.py --target web --jobs 1 --web-memory-growth conservative
```

An official single-job build has now completed with this policy and
`--no-web-stage`. Its separate candidate passes static inspection of the actual
compiled resize function and shared imported memory metadata. The build and
inspection reports are `output/wasm-session-candidate-001-build.json` and
`output/wasm-session-candidate-001-observed.json`; see
[browser session delivery](browser-region-session.md). The served artifact
retains its [verified legacy memory contract](wasm-memory-contract.md).
Allocation growth under original gameplay, timing and crash recovery remain
unverified. Smaller reserves may mean more growth
operations; improved frame rate or total memory is not claimed. Native
simulation paging still needs verified object/terrain/cache release and reuse.

Evidence is under `output/web-memory-policy-*` and
`output/conservative-growth-policy-*`, plus Kit `build/web-memory-*-tests.log`.
The terminal qualifier binds source/evidence hashes and confirms the served
WASM/glue identity is unchanged. No original save/profile, game/browser,
worker, real WASM memory or native build was used. The app crash is unresolved,
launches remain suspended and the full goal stays active.
