#pragma once
// Explicit opt-in live controls. Test actors are completed through the original
// BuildingReachedMaxHP script; this does not qualify paid construction.
struct ExpansionPlayProbe {
    unsigned phase = 0;
    bool busy = false;
    std::uint32_t guild = 0, zoo = 0, palace = 0, started = 0;
    std::uint32_t gold = 0, revision = 0, stockQuote = 0;
    std::vector<std::uint32_t> heroes;
} expansionPlay;
std::vector<std::string> expansionPlayGplStack;

#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
std::uint32_t expansionProbeUnit(std::uint32_t id) {
    return call(0x005a10d0U, read(read(0x0071c68cU) + 4), {id});
}
std::uint32_t expansionProbeGold() {
    const auto manager = call(0x00415b40U, 0), player = call(0x00416980U, manager);
    return call(read(read(player) + 0x20), player, {0x00505041U});
}
std::uint32_t expansionProbeOpen(std::uint32_t actor, std::uint32_t dialog) {
    call(0x00416890U, call(0x00415b40U, 0), {dialog, actor, 0, 0});
    const auto controller = majesty_expansion_panel_for_unit(actor, dialog);
    require(controller != 0, "live expansion play panel");
    return controller;
}
void expansionProbeControl(std::uint32_t controller, std::uint32_t command) {
    require(controller != 0, "live expansion play control target");
    call(majesty_expansion_panel_bridge(14), 0, {controller, command});
}
#endif
void beginControlledExpansionPlay(std::uint32_t palace, std::uint32_t guild, std::uint32_t zoo) {
#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    require(controlledExpansionPlay && !expansionPlay.phase, "owned expansion play initialization");
    expansionPlay.guild = read(guild + 0x60);
    expansionPlay.zoo = read(zoo + 0x60);
    expansionPlay.palace = read(palace + 0x60);
    expansionPlay.started = read(0x0071c6a8U);
    expansionPlay.phase = 1;
    mechanicsGpl("BuildingReachedMaxHP", {{guild}});
    mechanicsGpl("BuildingReachedMaxHP", {{zoo}});
#else
    (void)palace;
    (void)guild;
    (void)zoo;
#endif
}
void runControlledExpansionPlay() {
#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    auto &p = expansionPlay;
    if (!p.phase || p.phase == 9 || p.busy)
        return;
    p.busy = true;
    const auto guild = expansionProbeUnit(p.guild), zoo = expansionProbeUnit(p.zoo);
    require(guild && zoo, "live completed expansion actors");
    const auto now = read(0x0071c6a8U);
    require(now - p.started < 30000, "bounded expansion play phase deadline");
    const auto *board = communityRecipes.FindLiveAgentListByChild(0x51414743U);
    require(board != nullptr, "source-bound live board record");
    const auto panel = [&](std::uint32_t actor, std::uint32_t dialog) {
        return majesty_expansion_panel_for_unit(actor, dialog);
    };
    if (p.phase == 1) {
        const auto cost = mechanicsGpl(board->actionCostCallbackSymbol.c_str(), {{guild}}, true);
        const auto *flag = communityRecipes.FindHostileMonsterFlagByPanel(
            communityRecipes.FindRewardPanelByChildDialog(0x435a4743U)->panelKey);
        if (cost == 500 && call(0x005a1c40U, zoo, {flag->availabilityAttributeId, 0})) {
            p.revision = mechanicsGpl(board->revisionCallbackSymbol.c_str(), {{guild}}, true);
            p.gold = expansionProbeGold();
            require(p.gold >= cost, "owned trial treasury covers original board cost");
            const auto child = expansionProbeOpen(guild, board->childDialogId);
            expansionProbeControl(child, 5003);
            p.phase = 2;
            p.started = now;
        }
    } else if (p.phase == 2) {
        const auto gold = expansionProbeGold();
        const auto revision = mechanicsGpl(board->revisionCallbackSymbol.c_str(), {{guild}}, true);
        if (revision != p.revision) {
            require(gold == p.gold - 500, "one original 500-gold board debit");
            const auto child = panel(guild, board->childDialogId);
            require(child != 0, "paid refresh retains its own board");
            std::fprintf(stderr, "[community-expansion-paid] gold=%u->%u revision=%u->%u rows=%u\n",
                         p.gold, gold, p.revision, revision,
                         mechanicsGpl(board->rowCountCallbackSymbol.c_str(), {{guild}}, true));
            expansionProbeControl(child, 0x1f4dU);
            expansionProbeControl(panel(guild, board->parentDialogId), 28944);
            p.phase = 3;
            p.started = now;
        }
    } else if (p.phase == 3) {
        if (call(0x005a1c40U, guild, {0x044d4541U, 0}) == 1) {
            expansionProbeControl(panel(guild, board->parentDialogId), 28945);
            const auto parent = expansionProbeOpen(zoo, 0x4d5a4743U);
            expansionProbeControl(parent, 10801);
            p.phase = 4;
            p.started = now;
        }
    } else if (p.phase == 4) {
        if (!call(0x005a1c40U, guild, {0x044d4541U, 0}) &&
            call(0x005a1c40U, zoo, {0x044d4541U, 0}) == 1) {
            const auto parent = panel(zoo, 0x4d5a4743U);
            expansionProbeControl(parent, 10802);
            p.stockQuote = read(0x006d81f4U);
            expansionProbeControl(parent, 5001);
            const auto child = panel(zoo, 0x435a4743U);
            expansionProbeControl(child, 11);
            require(read(0x006d81f4U) == p.stockQuote,
                    "private plus preserves ordinary Attack Flag quote");
            expansionProbeControl(child, 5002);
            require(call(majesty_expansion_panel_bridge(11), 0) == 1,
                    "source-declared capture mode selected");
            expansionProbeControl(child, 10);
            require(read(0x006d81f4U) == p.stockQuote &&
                        call(majesty_expansion_panel_bridge(11), 0) == 1,
                    "private minus preserves ordinary quote and re-arms private mode");
            expansionProbeControl(child, 0x1f4dU);
            require(!call(majesty_expansion_panel_bridge(11), 0),
                    "capture Back restores native selection mode");
            p.phase = 5;
            p.started = now;
        }
    } else if (p.phase == 5) {
        if (!call(0x005a1c40U, zoo, {0x044d4541U, 0})) {
            host->log(host,
                      "Controlled expansion play: original completion, paid board refresh, queued "
                      "open/close, separate reward quote and private native mode passed.");
            const auto palace = expansionProbeUnit(p.palace);
            for (const auto *name :
                 {"Necromancer", "Fire_Witch", "Dark_Paladin", "Cultist_Healer", "Wild_Monk",
                  "Lightning_Lord", "Dragoncaller", "Assassin", "Fallen_Angel", "Minstrel",
                  "Shapeshifter", "Mystic", "Timewalker"}) {
                const auto hero = mechanicsGpl("MM_Expansion_Probe_Spawn",
                                               {{palace}, {0, false, name}, {0, true}}, true);
                require(hero != 0, "original More Heroes native birth");
                p.heroes.push_back(read(hero + 0x60));
            }
            p.phase = 6;
            p.started = now;
        }
    } else if (p.phase == 6 && now - p.started >= 1000) {
        for (const auto id : p.heroes) {
            const auto hero = expansionProbeUnit(id);
            require(hero && read(hero + 0x70) == 0 && call(0x004c8ea0U, 0, {hero}),
                    "owned native More Heroes hero predicate");
            const auto hp = call(0x005a1c40U, hero, {0x00555041U, 0});
            const auto maximum = call(0x005a1c40U, hero, {0x01555041U, 0});
            require(hp && maximum && hp <= maximum, "living More Heroes initial health");
            std::fprintf(stderr, "[community-more-hero] id=%u prototype=%08x hp=%u/%u\n", id,
                         read(hero + 0x6c), hp, maximum);
        }
        require(p.heroes.size() == 13, "all 13 original More Heroes classes");
        host->log(host, "Controlled More Heroes births: all 13 original native heroes, owner, hero "
                        "classification and initial health passed.");
        p.phase = 9;
    }
    p.busy = false;
#endif
}
