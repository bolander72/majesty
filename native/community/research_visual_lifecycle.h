#pragma once
// Old-edition event adapter for the creator's idempotent research visuals.
// Saved GPL ledgers remain authoritative. No per-frame kingdom scans, cached
// actor pointers, ownership persistence or duplicate award callbacks live here.
bool researchVisuals = false, researchWorldReady = false, researchVisualBusy = false;
bool researchWorldVisualPending = false;
bool researchVisualGameActive() {
    const auto state = read(0x006d7670U);
    return researchWorldReady && state && (read(state) == 3 || read(state) == 7) &&
           !read(state + 4);
}
void syncResearchVisual(std::uint32_t unit, bool hadAgent = false) {
    if (!researchVisuals || researchVisualBusy || !researchVisualGameActive() || !unit ||
        read(unit + 0x70) >= 0x7fffffffU || (read(unit + 0x64) & 4))
        return;
    const auto family = read(unit + 0x6c) & 0xffffffU;
    for (const auto &binding : researchBindings) {
        if (binding.record.activeEffector.empty() || family != binding.nativeFamily)
            continue;
        // Placement owns no callable GPL agent. Completion establishes it;
        // removing FirstStageBuilt still needs the previous agent for cleanup.
        if ((!hadAgent && call(0x005a1c40U, unit, {0x01425041U, 0}) != 1) ||
            !call(0x005a1c40U, unit, {0x4541U, 0}))
            return;
        researchVisualBusy = true;
        std::uint32_t result = 0;
        require(
            evaluateScalar(binding.record.CallbackSymbol() + "_Visual", unit, 0, result, false) &&
                result <= 1,
            "original one-agent research visual callback");
        researchVisualBusy = false;
        return;
    }
}
void syncResearchWorldVisuals() {
    if (!researchVisuals || researchVisualBusy || !researchVisualGameActive())
        return;
    researchWorldVisualPending = false;
    researchVisualBusy = true;
    // The original world-ready callback has restored objects, GPL agents and
    // saved links. Query each extant kingdom once through the creator's own
    // ListObjects implementation, which includes hidden and completed Halls.
    for (std::uint32_t player = 0; player < 8; ++player) {
        const auto palace = call(0x00418b50U, 0, {player});
        if (!palace)
            continue;
        for (const auto &binding : researchBindings) {
            if (binding.record.activeEffector.empty())
                continue;
            std::uint32_t result = 0;
            require(evaluateScalar(binding.record.CallbackSymbol() + "_Visuals", palace, player,
                                   result) &&
                        result == 0,
                    "original world-entry research visual reconciliation");
        }
    }
    researchVisualBusy = false;
    host->log(host, "Research visuals reconciled after original world-ready callback.");
}
