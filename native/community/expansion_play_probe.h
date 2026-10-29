#pragma once
// Explicit opt-in live controls. Test actors are completed through the original
// BuildingReachedMaxHP script; this does not qualify paid construction.
struct ExpansionPlayProbe {
    unsigned phase = 0;
    bool busy = false;
    std::uint32_t guild = 0, zoo = 0, palace = 0, started = 0;
    std::uint32_t gold = 0, revision = 0, stockQuote = 0;
    std::vector<std::uint32_t> heroes;
    std::vector<std::uint32_t> startingMaxHp;
    std::vector<std::uint32_t> captureTargets;
    std::uint32_t tamed = 0, tameCost = 0, captiveCount = 0;
    std::uint32_t buyer = 0, rented = 0, rentCost = 0, buyerGold = 0, rentalPoll = 0;
    bool questAwarded = false;
    bool reloadAiChecked = false;
    bool questRefreshPending = false;
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
void expansionProbeLevelCheat() {
    require(read(0x006d87a0U) && read(read(0x006d87a0U) + 0x9c),
            "owned Freestyle trial permits ordinary cheat input");
    std::uint32_t text = 0;
    require(host->guest_alloc(host, 128, &text) == POP_OK, "owned native cheat string");
    constexpr char phrase[] = "level 1000";
    for (unsigned i = 0; i < sizeof(phrase); ++i)
        require(host->guest_write_u8(host, text + 32 + i, phrase[i]) == POP_OK,
                "native cheat phrase bytes");
    call(0x004e3520U, text, {text + 32});
    require(call(0x00480e00U, 0, {text}) == 1, "original native cheat input recognized");
    call(0x004e3820U, text);
    require(host->guest_free(host, text) == POP_OK, "native cheat string release");
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
    if (!p.phase || p.phase == 20 || p.busy)
        return;
    p.busy = true;
    const auto guild = expansionProbeUnit(p.guild), zoo = expansionProbeUnit(p.zoo);
    require(guild && zoo, "live completed expansion actors");
    const auto now = read(0x0071c6a8U);
    require(now - p.started < (p.phase == 19 ? 60000U : p.phase == 17 ? 45000U : 30000U),
            "bounded expansion play phase deadline");
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
            p.startingMaxHp.push_back(maximum);
            std::fprintf(stderr, "[community-more-hero] id=%u prototype=%08x hp=%u/%u\n", id,
                         read(hero + 0x6c), hp, maximum);
        }
        require(p.heroes.size() == 13, "all 13 original More Heroes classes");
        host->log(host, "Controlled More Heroes births: all 13 original native heroes, owner, hero "
                        "classification and initial health passed.");
        expansionProbeLevelCheat();
        p.phase = 7;
        p.started = now;
    } else if (p.phase == 7) {
        bool ready = true;
        for (const auto id : p.heroes) {
            const auto hero = expansionProbeUnit(id);
            require(hero != 0, "More Heroes actor survives native instant leveling");
            ready = ready && call(0x005a1c40U, hero, {0x0b565041U, 0}) == 1000;
        }
        if (ready) {
            for (unsigned i = 0; i < p.heroes.size(); ++i) {
                const auto hero = expansionProbeUnit(p.heroes[i]);
                const auto hp = call(0x005a1c40U, hero, {0x00555041U, 0});
                const auto maximum = call(0x005a1c40U, hero, {0x01555041U, 0});
                require(hp && hp <= maximum && maximum > p.startingMaxHp[i],
                        "native level-1000 health growth for every original More Heroes class");
                std::fprintf(
                    stderr,
                    "[community-more-hero-level] id=%u level=1000 hp=%u/%u originalMax=%u\n",
                    p.heroes[i], hp, maximum, p.startingMaxHp[i]);
            }
            host->log(host, "Controlled More Heroes leveling: original native level-1000 cheat, "
                            "all 13 classes, living health and normal HP growth passed.");
            p.phase = 8;
            p.started = now;
        }
    } else if (p.phase == 8 && now - p.started >= 5000) {
        for (const auto id : p.heroes) {
            const auto hero = expansionProbeUnit(id);
            require(hero && call(0x005a1c40U, hero, {0x00555041U, 0}),
                    "all original More Heroes remain alive after high-level AI updates");
        }
        host->log(host, "Controlled More Heroes high-level AI: all 13 remain alive through five "
                        "simulation seconds.");
        mechanicsGpl("MM_Expansion_Probe_Rows", {{guild}});
        require(mechanicsGpl(board->rowCountCallbackSymbol.c_str(), {{guild}}, true) == 2,
                "two isolated quest presentation control rows");
        const auto parent = expansionProbeOpen(guild, board->parentDialogId);
        expansionProbeControl(parent, board->openCommandId);
        require(panel(guild, board->childDialogId) != 0, "populated native quest board opens");
        host->log(host, "Controlled quest presentation: two test-only record rows opened through "
                        "the native parent control; normal quest gameplay remains unqualified.");
        p.phase = 9;
        p.started = now;
    } else if (p.phase == 9 && now - p.started >= 250) {
        // DeleteEffector finishes the native overlay exit animation first.
        // Check retirement on later updates, as the existing mechanics probe does.
        bool pending = false;
        for (const auto *marker : {"MCF2419816A7F251", "MCF2419816A7F252",
                                   "MCF2419816A7F253", "MCF2419816A7F254"})
            pending |= mechanicsGpl("CheckEffector", {{guild}, {0, false, marker}}, true) != 0;
        if (pending) {
            require(now - p.started < 6000, "follower marker native exit-animation deadline");
        } else {
            host->log(host, "Controlled follower markers: all four absent/create/present/delete/"
                            "retired checks passed through original native effectors.");
            p.phase = 10;
        }
    } else if (p.phase == 10) {
        const auto child = expansionProbeOpen(zoo, 0x435a4743U);
        expansionProbeControl(child, 5002);
        require(call(majesty_expansion_panel_bridge(11), 0) == 1,
                "native capture mode for original queued encounter");
        require(!call(majesty_expansion_panel_bridge(10), 0, {guild}) &&
                    !call(majesty_expansion_panel_bridge(10), 0,
                          {expansionProbeUnit(p.heroes.front())}),
                "capture rejects a building and an owned hero");
        std::uint32_t coord = 0;
        require(host->guest_alloc(host, 8, &coord) == POP_OK, "native capture coordinate storage");
        require(expansionProbeGold() >= 15000, "owned treasury covers three 5000-gold flags");
        for (unsigned i = 0; i < 3; ++i) {
            const auto target = mechanicsGpl("MM_Expansion_Probe_Spawn",
                {{zoo}, {0, false, "Ratman"}, {7, true}}, true);
            require(target && call(majesty_expansion_panel_bridge(10), 0, {target}) == target,
                    "original hostile Ratman passes private native capture filter");
            p.captureTargets.push_back(read(target + 0x60));
            call(0x005ad740U, target, {coord});
            // Original Fl00 completion uses this exact six-word native queue.
            // The UI hover path is separate; no source capture outcome is forced.
            call(0x0043ef50U, 0, {majesty_expansion_capture_prototype(), target,
                                 read(coord), read(coord + 4), 5000, 0});
        }
        require(host->guest_free(host, coord) == POP_OK, "native capture coordinate release");
        p.started = now;
        p.phase = 11;
    } else if (p.phase == 11 && now - p.started >= 1000) {
        unsigned attached = 0, hostileAttached = 0;
        for (const auto id : p.captureTargets) {
            const auto target = expansionProbeUnit(id);
            if (target && !call(majesty_expansion_panel_bridge(10), 0, {target})) {
                ++attached;
                if (read(target + 0x70) == 7)
                    ++hostileAttached;
            }
        }
        std::fprintf(stderr, "[community-capture] queued-targets=%zu rejected-after-queue=%u "
                             "hostile-duplicates-rejected=%u stored=%u\n",
                     p.captureTargets.size(), attached, hostileAttached,
                     mechanicsGpl("MM_Expansion_Probe_Captives", {{zoo}}, true));
        p.phase = 12;
    } else if (p.phase == 12) {
        const auto count = mechanicsGpl("MM_Expansion_Probe_Captives", {{zoo}}, true);
        if (count) {
            host->log(host, "Controlled native capture: original reward queue, lethal stock "
                            "capture roll and Hooligan delivery produced a real stored Zoo captive.");
            p.phase = 13;
        }
    } else if (p.phase == 13) {
        const auto beast = mechanicsGpl("MM_Expansion_Probe_FirstCaptive", {{zoo}}, true);
        require(beast != 0, "actual source-validated stored captive for paid taming");
        const auto *record = communityRecipes.FindOccupantPanelByChild(0x545a4743U);
        require(record != nullptr, "source-bound tame panel recipe");
        p.tamed = read(beast + 0x60);
        p.tameCost = mechanicsGpl(record->costCallbackSymbol.c_str(), {{beast}}, true);
        p.captiveCount = mechanicsGpl("MM_Expansion_Probe_Captives", {{zoo}}, true);
        p.gold = expansionProbeGold();
        require(p.tameCost && p.gold >= p.tameCost, "original source tame quote is affordable");
        const auto child = expansionProbeOpen(zoo, record->childDialogId);
        const auto begin = read(child + 0x28), end = read(child + 0x2c);
        require(end >= begin && (end - begin) % 4 == 0 && end - begin <= 4096,
                "bounded original native occupant vector");
        const auto rawDialog = read(read(child + 0x14) + 4);
        const auto list = call(0x004df260U, rawDialog, {5000});
        require(list && read(list + 0x50) == 16 && read(list + 0x58) == 0 &&
                    call(read(read(list) + 0x9c), list, {0x18, 0, 0}) == (end - begin) / 4,
                "stock compact captive rows retain the original unit-vector count");
        unsigned index = 0;
        while (begin + index * 4 < end && read(begin + index * 4) != beast)
            ++index;
        require(begin + index * 4 < end, "real captive appears in native tame panel");
        const auto window = read(child + 0x14);
        call(read(read(window) + 0x68), window, {5000, 0x1b, index, 0});
        expansionProbeControl(child, 5000);
        expansionProbeControl(child, 5003);
        p.started = now;
        p.phase = 14;
    } else if (p.phase == 14) {
        const auto beast = expansionProbeUnit(p.tamed);
        if (beast && mechanicsGpl("MM_Expansion_Probe_Tamed", {{beast}}, true)) {
            require(read(beast + 0x70) == 0 && expansionProbeGold() < p.gold &&
                        !call(majesty_expansion_panel_bridge(10), 0, {beast}),
                    "paid tame produces an owned, living, capture-ineligible guardian");
            std::fprintf(stderr, "[community-tame] cost=%u treasury=%u->%u captive-id=%u\n",
                         p.tameCost, p.gold, expansionProbeGold(), p.tamed);
            host->log(host, "Controlled native taming: real captured occupant selected in native "
                            "MX05, original paid queue/debit and source guardian release passed.");
            p.phase = 15;
            p.started = now;
        }
    } else if (p.phase == 15) {
        if (mechanicsGpl("MM_Expansion_Probe_Captives", {{zoo}}, true)) {
            const auto beast = mechanicsGpl("MM_Expansion_Probe_FirstCaptive", {{zoo}}, true);
            const auto buyer = expansionProbeUnit(p.heroes.at(7)); // Original Assassin.
            require(beast && buyer, "real remaining captive and living rental buyer");
            p.rented = read(beast + 0x60);
            p.buyer = read(buyer + 0x60);
            p.rentCost = mechanicsGpl("Restore_Zoo_Rental_Cost", {{beast}}, true);
            // This isolated buyer gets a purse through the stock gold award.
            // Prices, eligibility RNG, walking, visit delay and payment stay authored.
            mechanicsGpl("MM_Expansion_Probe_FundBuyer", {{buyer}});
            p.buyerGold = mechanicsGpl("MM_Expansion_Probe_BuyerGold", {{buyer}}, true);
            require(p.rentCost && p.buyerGold >= p.rentCost, "funded native rental precondition");
            const auto parent = expansionProbeOpen(zoo, 0x4d5a4743U);
            expansionProbeControl(parent, 10801);
            p.started = p.rentalPoll = now;
            p.phase = 16;
        }
    } else if (p.phase == 16 && now - p.rentalPoll >= 250) {
        p.rentalPoll = now;
        const auto buyer = expansionProbeUnit(p.buyer);
        require(buyer != 0, "native buyer remains valid before rental consideration");
        if (call(0x005a1c40U, zoo, {0x044d4541U, 0}) == 1 &&
            mechanicsGpl("MM_Expansion_Probe_ConsiderRental", {{buyer}}, true)) {
            p.started = now;
            p.phase = 17;
        }
    } else if (p.phase == 17) {
        const auto buyer = expansionProbeUnit(p.buyer);
        require(buyer != 0, "original rental buyer remains live");
        std::uint32_t beast = 0;
        for (const auto id : p.captureTargets) {
            const auto candidate = expansionProbeUnit(id);
            if (candidate && mechanicsGpl("MM_Expansion_Probe_Rented", {{candidate}, {buyer}}, true)) {
                beast = candidate;
                break;
            }
        }
        if (beast) {
            p.rented = read(beast + 0x60);
            const auto after = mechanicsGpl("MM_Expansion_Probe_BuyerGold", {{buyer}}, true);
            require(p.rentCost && p.buyerGold >= p.rentCost &&
                        after == p.buyerGold - p.rentCost && read(beast + 0x70) == 0,
                    "authored rental debits buyer and releases an owned monster follower");
            unsigned markers = 0;
            for (const auto *marker : {"MCF2419816A7F251", "MCF2419816A7F252",
                                       "MCF2419816A7F253", "MCF2419816A7F254"})
                markers += mechanicsGpl("CheckEffector", {{beast}, {0, false, marker}}, true) != 0;
            std::fprintf(stderr, "[community-rental] cost=%u buyer-gold=%u->%u follower=%u "
                                 "speed-markers=%u\n", p.rentCost, p.buyerGold, after,
                         p.rented, markers);
            host->log(host, "Controlled native rental: original consideration callback, "
                            "Use_Building visit, source payment and living controlled follower passed.");
            p.started = now;
            p.phase = 18;
        }
    } else if (p.phase == 18) {
        // Restore the authored presentation after the earlier isolated two-row
        // UI control. No offers, applications, objectives or payouts are seeded.
        mechanicsGpl("Adventurer_Guild_Publish_Rows", {{guild}});
        const auto parent = expansionProbeOpen(guild, board->parentDialogId);
        expansionProbeControl(parent, 28944);
        p.started = now;
        if (mechanicsGpl(board->rowCountCallbackSymbol.c_str(), {{guild}}, true) == 0) {
            host->log(host, "Controlled new-game board is empty; natural quest payout remains "
                            "a separate populated saved-world acceptance trial.");
            p.phase = 20;
        } else {
            p.phase = 19;
        }
    } else if (p.phase == 19 && p.questAwarded) {
        host->log(host, "Controlled native quest: unmodified NPC application/objective/return "
                        "guards reached Complete_Return and its original give_gold finished.");
        p.phase = 20;
    }
    p.busy = false;
#endif
}

// Read-only checks for the isolated live40 save. These pinned identities are
// never used by ordinary gameplay or the spawning fixture.
void runControlledExpansionReload() {
#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    auto &p = expansionPlay;
    if (p.busy || p.phase == 20)
        return;
    p.busy = true;
    const auto now = read(0x0071c6a8U);
    const auto guild = expansionProbeUnit(535), zoo = expansionProbeUnit(536);
    require(guild && zoo && read(guild + 0x6c) == 0x31764241U &&
                read(zoo + 0x6c) == 0x31774241U,
            "exact owned live40 saved Guild and Zoo identities");
    if (!p.phase || (!p.reloadAiChecked && now - p.started >= 5000)) {
        const auto tamed = expansionProbeUnit(606), rented = expansionProbeUnit(608);
        const auto buyer = expansionProbeUnit(552);
        require(tamed && rented && buyer &&
                    mechanicsGpl("MM_Expansion_Probe_Tamed", {{tamed}}, true) == 1 &&
                    mechanicsGpl("MM_Expansion_Probe_Rented", {{rented}, {buyer}}, true) == 1 &&
                    mechanicsGpl("MM_Expansion_Probe_Captives", {{zoo}}, true) >= 1,
                "saved tamed guardian, rental leader/scripts and remaining captive restored");
        for (const auto id : {537U, 539U, 541U, 543U, 546U, 548U, 550U,
                              552U, 555U, 557U, 559U, 561U, 565U}) {
            const auto hero = expansionProbeUnit(id);
            require(hero && call(0x005a1c40U, hero, {0x0b565041U, 0}) == 1000 &&
                        call(0x005a1c40U, hero, {0x00555041U, 0}) > 0,
                    "all thirteen saved level-1000 More Heroes restored alive");
        }
        const auto *board = communityRecipes.FindLiveAgentListByChild(0x51414743U);
        require(board != nullptr, "saved board has its source-bound recipe");
        const auto rows = mechanicsGpl(board->rowCountCallbackSymbol.c_str(), {{guild}}, true);
        const auto revision = mechanicsGpl(board->revisionCallbackSymbol.c_str(), {{guild}}, true);
        std::fprintf(stderr, "[community-reload] continued-ai=%u rows=%u revision=%u\n",
                     p.phase != 0, rows, revision);
        if (!p.phase) {
            p.started = now;
            p.phase = 19;
            host->log(host, "Controlled expansion reload: original save restored both buildings, "
                            "thirteen living level-1000 heroes, captive, paid guardian and rented follower.");
            if (controlledExpansionQuestRefresh) {
                p.gold = expansionProbeGold();
                p.revision = revision;
                require(p.gold >= 500, "saved treasury covers the original paid quest refresh");
                const auto parent = expansionProbeOpen(guild, board->parentDialogId);
                expansionProbeControl(parent, 28944);
                const auto child = expansionProbeOpen(guild, board->childDialogId);
                expansionProbeControl(child, 5003);
                p.questRefreshPending = true;
            }
        } else {
            p.reloadAiChecked = true;
            host->log(host, "Controlled expansion reload AI: restored captive, guardian, rental "
                            "and all thirteen heroes remain valid after five simulation seconds.");
        }
    }
    if (p.questRefreshPending) {
        const auto *board = communityRecipes.FindLiveAgentListByChild(0x51414743U);
        const auto revision = mechanicsGpl(board->revisionCallbackSymbol.c_str(), {{guild}}, true);
        if (revision != p.revision) {
            require(expansionProbeGold() == p.gold - 500,
                    "saved-world original quest refresh debits exactly500 kingdom gold");
            const auto rows = mechanicsGpl(board->rowCountCallbackSymbol.c_str(), {{guild}}, true);
            std::fprintf(stderr, "[community-quest-refresh] treasury=%u->%u rows=%u\n",
                         p.gold, expansionProbeGold(), rows);
            host->log(host, "Controlled saved-world quest refresh: original native paid queue "
                            "generated offers with the restored heroes present; objectives remain authored.");
            p.questRefreshPending = false;
        }
    }
    if (p.questAwarded) {
        host->log(host, "Controlled native quest: restored world naturally completed the original "
                        "application/objective/return guards and give_gold payout.");
        p.phase = 20;
    }
    p.busy = false;
#endif
}
