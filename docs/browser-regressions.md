# Voice pitch and build-anything construction

The shared DirectX audio allocator reused host channel numbers without clearing their retained frequency override. A later sound could therefore play at the previous sound’s rate. The allocator now restores the new buffer’s own sample rate when a freed channel is reused. Existing buffers keep intentional pitch changes.

The real channel-lifetime regression fails against the old allocator with an 11,025 Hz override left behind; the fixed official DirectX suite passes all 182,813 checks. This confirms the defect. The particular intermittent voice report has not been independently reproduced in a mission. Owned browser tests remain muted.

The original `build anything` cheat skips `NotBuildable` checks. Its construction list admitted `ABA0` (an invisible placeholder with no GPL agent) and `ABJ4` (the quest-only Dark Palace), both without a construction cost. A narrow original-list insertion hook excludes these two resources. Their quest definitions, existing actors and saved worlds remain intact, and legitimate cheat unlocks keep their costs.

The source-bound private WASM candidate passed a browser check: the original cheat confirmation appeared; higher-tier Blacksmith options remained available; Building and Dark Palace were absent from their alphabetic positions. Ordinary 425-gold Wayfinder recruitment and original save/reload also work. These fixes are published with the qualified v2 content release at majesty.boland.co. Private evidence is recorded in `output/regression923-fixes-qualified.json`.
