# Keyboard character ownership

The original multiplayer name and room fields duplicated physical keystrokes:
pressing `1` produced `11`, and pressing `H` produced `Hh`. The host input gate
posted both WM_KEYDOWN and WM_CHAR, while the original guest's TranslateMessage
call generated another WM_CHAR. The regression follows that actual gate and
USER32 import path. Before the fix, the official host suite failed exactly
three new assertions: an unexpected pending character, the wrong first
character, and a second character left in the queue.

The host now posts key transitions only. TranslateMessage is the single
character producer, matching the Win32 message-loop contract. Guest loops
must call it to obtain WM_CHAR/WM_SYSCHAR; directly supplied character messages
remain supported. USER32 covers the existing US ASCII layout, with explicit
OEM punctuation, shifted digits, keypad symbols and editing controls. It no
longer treats unused virtual-key values between digits and letters as text.
No message provenance cache or extra unbounded event storage is introduced.

The official new input_gate_tests target passes342 checks without a game,
GPU or audio device. It covers actual key presses/repeats, Shift, editing keys,
keypad digits, key-up refusal and consumed input. The official runtime target
passes2258 checks,0 failures and3 existing skips, including character routing
when focus changes after retrieving the key. The28 campaign launcher/progress
checks also pass. First-party formatting and the game-literal check pass.

The default Xcode compiler rejected its pending license before compilation.
The tests then used the already installed Command Line Tools by setting
DEVELOPER_DIR only for their processes; no license was accepted or global
compiler configuration changed. Builds used the official one-job test wrapper.
Logs, pre-change sources and final source hashes are in
`output/keyboard-character-001/manifest.json`.

Private candidate026 compiles this fix and has a complete isolated launcher
package. Its module SHA-256 is
`5437aaa9e67b849b6c3906ded5e921703e40a1bc2de5a8e55f443c24697806cf`.
Static inspection verifies the compiled inputs and expected protocol exports
without instantiating the module. The sampled build process tree peaked at
287.16 MiB with one compiler job. The published candidate025 WASM is unchanged;
the private package is not exposed through the live game route. This does not
qualify browser typing or browser memory use. See
`output/wasm-session-candidate-026-preserved/manifest.json`.

Native build381 also compiles the change. Original lobby019 appends exactly
one `!` to the remembered room name on one scripted Shift+1 press, confirmed
in the original dialog and its advertised session packet. The single original
game process exits normally, sampled peak129.22 MiB. The source profile and
served engine remain unchanged. Smoke keys already used key transitions before
this fix: this menu check qualifies shifted punctuation in TranslateMessage,
while the342 gate checks cover removal of duplicate host characters. It does
not establish physical SDL or browser keyboard behavior. See
`output/native-keyboard-381-preserved/manifest.json`.

On 2026-10-07 the user removed the browser launch suspension. One isolated
candidate027 browser game confirms that physical `1` enters one digit in the
original player-name and room-name fields. A rapid Shift+1 chord exposes a
remaining timing bug: TranslateMessage samples the released physical Shift
state and enters `1` instead of `!`. Screens are preserved under
`output/browser-keyboard-027/`; the test tab is closed and candidate027 is not
published. International layouts and IME remain unqualified.

Candidate028 adds a private Shift snapshot to each existing USER32 queue
entry. TranslateMessage uses it when all seven guest MSG fields match the last
retrieval, including when the guest copies the MSG; caller-authored messages
retain the live-state fallback. Guest MSG size, key lParam, focus routing and
the sole character producer remain unchanged. No provenance history is kept.
The real gate's rapid press/release regression fails six assertions before
this change and passes455 checks afterward. The official runtime passes2262
checks with0 failures and3 existing skips. One actual candidate028 browser engine now confirms `1!H` in both original
player-name and room-name dialogs, and one Backspace removes exactly the H.
A second agent-owned tab using the same test profile refuses startup with the
busy-profile message; no second game is injected. Both test tabs are closed.
The reviewed whole-site generation is published locally, with the complete
old site preserved at `build/web-site-before-keyboard-028`. HTTP hashes match
the qualified module, glue, player HTML, profile guard and engine manifest.
The server is unchanged and user profiles are not edited. Browser evidence
is in `output/browser-keyboard-028/manifest.json`; compiled inputs and terminal
checks are in `output/keyboard-shift-028/manifest.json`. This menu qualification
does not establish shared regional gameplay or a total browser memory bound.
