#pragma once
// Explicitly opted-in component trials only. Original GPL owns every effect,
// timer and award calculation. These actors come from the pinned owned test
// save; a controlled trial must never be used as ordinary campaign progress.
struct MechanicsArgument {
    std::uint32_t value;
    bool integer = false;
};
std::uint32_t mechanicsGpl(const char *symbol, std::initializer_list<MechanicsArgument> args,
                           bool scalar = false) {
    const auto length = std::strlen(symbol);
    require(length && length < 120 && args.size() <= 4, "bounded mechanics GPL invocation");
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 256, &memory) == POP_OK, "mechanics GPL storage");
    for (unsigned i = 0; i <= length; ++i)
        require(host->guest_write_u8(host, memory + 128 + i, symbol[i]) == POP_OK,
                "mechanics GPL symbol");
    call(0x004e3520U, memory, {memory + 128});
    const auto evaluator = memory + 32;
    call(0x00629910U, evaluator, {memory});
    call(0x004e3820U, memory);
    const auto binding = read(evaluator + 4);
    require(binding && read(binding + 20) == 0x0061e4c0U,
            "mechanics invokes the actual interpreted creator function");
    call(0x00629bf0U, evaluator);
    for (const auto &arg : args)
        call(arg.integer ? 0x00629a40U : 0x00629a20U, evaluator, {arg.value});
    call(0x00629c40U, evaluator);
    std::uint32_t result = 0;
    if (scalar) {
        const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
        require(begin && end - begin == (args.size() + 1) * 4 && read(read(begin)) &&
                    read(read(read(begin)) + 4) == 1,
                "mechanics original typed scalar return and argument references");
        result = call(0x00629c10U, evaluator);
    }
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "mechanics GPL release");
    return result;
}
struct MechanicsProbe {
    unsigned phase = 0;
    std::uint32_t started = 0;
    bool busy = false;
    std::uint32_t dancer = 0, phantom = 0, troubadour = 0, hall = 0;
    std::uint32_t movement = 0, action = 0, strength = 0, dancerParry = 0, dancerResist = 0;
    std::uint32_t maxHp = 0, parry = 0, resist = 0, attack = 0, ranged = 0;
    std::uint32_t stat(std::uint32_t unit, std::uint32_t key) {
        return call(0x005a1c40U, unit, {key, 0});
    }
    void tick() {
        if (phase >= 5 || busy)
            return;
        const auto world = read(0x0071c68cU), manager = world ? read(world + 4) : 0;
        if (!manager)
            return;
        if (!phase) {
            dancer = call(0x005a10d0U, manager, {585});
            phantom = call(0x005a10d0U, manager, {1412});
            troubadour = call(0x005a10d0U, manager, {627});
            hall = call(0x005a10d0U, manager, {561});
            if (!dancer || !phantom || !troubadour || !hall)
                return;
            require(read(dancer + 0x6c) == 0x31745641U && read(phantom + 0x6c) == 0x31705641U &&
                        read(troubadour + 0x6c) == 0x31765641U && read(hall + 0x6c) == 0x33744241U,
                    "mechanics owns the pinned original saved community actors");
        }
        busy = true;
        const auto now = read(0x0071c6a8U);
        if (!phase) {
            maxHp = stat(phantom, 0x01555041U);
            parry = stat(phantom, 0x07565041U);
            resist = stat(phantom, 0x08565041U);
            mechanicsGpl("Eternal_Soul_Begin", {{phantom}, {phantom}});
            const auto boosted = maxHp + std::max(1U, maxHp * 30 / 100);
            require(stat(phantom, 0x01555041U) == boosted &&
                        stat(phantom, 0x07565041U) == parry + 15 &&
                        stat(phantom, 0x08565041U) == resist + 15,
                    "Eternal Soul original maximum HP, parry and resistance bonuses");
            mechanicsGpl("Eternal_Soul_Begin", {{phantom}, {phantom}});
            require(stat(phantom, 0x01555041U) == boosted &&
                        stat(phantom, 0x07565041U) == parry + 15,
                    "Eternal Soul duplicate begin does not stack");
            mechanicsGpl("Eternal_Soul_End", {{phantom}});
            mechanicsGpl("Eternal_Soul_End", {{phantom}});
            require(stat(phantom, 0x01555041U) == maxHp && stat(phantom, 0x07565041U) == parry &&
                        stat(phantom, 0x08565041U) == resist,
                    "Eternal Soul end restores original attributes and is idempotent");
            movement = stat(dancer, 0x22565041U);
            action = stat(dancer, 0x32565041U);
            unsigned scale = 0;
            for (unsigned tier : {1U, 1U, 2U, 2U, 1U}) {
                scale = std::max(scale, tier);
                mechanicsGpl("Phantom_Apply_Chill_Tier", {{dancer}, {1500, true}, {tier, true}});
                require(
                    stat(dancer, 0x22565041U) == movement + 50 * scale &&
                        stat(dancer, 0x32565041U) == action + 500 * scale,
                    "Chill refresh, empowerment and no downgrade retain exact native modifiers");
            }
            const auto hallMove = stat(hall, 0x22565041U), hallAction = stat(hall, 0x32565041U);
            mechanicsGpl("Phantom_Apply_Chill_Tier", {{hall}, {1500, true}, {2, true}});
            require(stat(hall, 0x22565041U) == hallMove && stat(hall, 0x32565041U) == hallAction,
                    "Chill refuses a building target");
            started = now;
            phase = 1;
            host->log(host, "Mechanics control: Eternal Soul apply/idempotence/restore and Chill "
                            "tier refresh passed.");
        } else if (phase == 1 && now - started >= 2200) {
            require(stat(dancer, 0x22565041U) == movement && stat(dancer, 0x32565041U) == action,
                    "original Chill watch expires without permanent rate changes");
            strength = stat(dancer, 0x00565041U);
            dancerParry = stat(dancer, 0x07565041U);
            dancerResist = stat(dancer, 0x08565041U);
            for (unsigned i = 0; i < 2; ++i) {
                mechanicsGpl("Phantom_Apply_Gravechill", {{dancer}, {1500, true}});
                require(stat(dancer, 0x00565041U) == strength - 5 &&
                            stat(dancer, 0x07565041U) == dancerParry - 2 &&
                            stat(dancer, 0x08565041U) == dancerResist - 2,
                        "Gravechill refresh does not stack penalties");
            }
            started = now;
            phase = 2;
            host->log(
                host,
                "Mechanics control: actual Chill expiry and Gravechill exact penalties passed.");
        } else if (phase == 2 && now - started >= 2200) {
            require(stat(dancer, 0x00565041U) == strength &&
                        stat(dancer, 0x07565041U) == dancerParry &&
                        stat(dancer, 0x08565041U) == dancerResist,
                    "original Gravechill watch restores all penalties");
            attack = stat(phantom, 0x05565041U);
            ranged = stat(phantom, 0x06565041U);
            mechanicsGpl("Bards_Valor_Apply", {{troubadour}, {phantom}});
            const auto skill = stat(phantom, 0x07565041U) - parry;
            require(skill >= 8 && stat(phantom, 0x08565041U) >= resist + 10,
                    "authored Valor skill and resistance bonuses");
            mechanicsGpl("Bards_Valor_Apply", {{troubadour}, {phantom}});
            require(stat(phantom, 0x07565041U) == parry + skill &&
                        stat(phantom, 0x05565041U) == attack + skill,
                    "Valor refresh applies only the difference");
            for (unsigned i = 0; i < 2; ++i)
                mechanicsGpl("Bards_Countermelody_Apply", {{troubadour}, {phantom}});
            require(stat(phantom, 0x05565041U) == attack + skill - 20 &&
                        stat(phantom, 0x06565041U) == ranged + skill - 20,
                    "Countermelody overlaps Valor without repeated penalties");
            started = now;
            phase = 3;
            host->log(host, "Mechanics control: Gravechill restored, Valor refresh and "
                            "Countermelody overlap passed.");
        } else if (phase == 3 && now - started >= 8800) {
            require(stat(phantom, 0x07565041U) == parry && stat(phantom, 0x08565041U) == resist &&
                        stat(phantom, 0x05565041U) == attack &&
                        stat(phantom, 0x06565041U) == ranged,
                    "native Valor and Countermelody expiry restores original attributes");
            phase = 4;
            host->log(host, "Mechanics control: actual native Valor and Countermelody expiry "
                            "restored original stats.");
        } else if (phase == 4) {
            for (const auto symbol : {"MM_KR_Gold", "MM_KR_XP"}) {
                require(mechanicsGpl(symbol, {{phantom}, {100, true}}, true) == 115,
                        "completed original Chronicles yields its actual fifteen-percent award");
                require(mechanicsGpl(symbol, {{hall}, {100, true}}, true) == 100,
                        "Chronicles refuses non-hero award recipients");
            }
            const auto initial =
                mechanicsGpl("MM_Toggle_Bards_Hiring_Closed", {{hall}, {0xffffffffU, true}}, true);
            require(initial <= 1, "original hiring state query");
            require(mechanicsGpl("MM_Toggle_Bards_Hiring_Closed", {{hall}, {1, true}}, true) == 1 &&
                        mechanicsGpl("MM_Toggle_Bards_Hiring_Closed", {{hall}, {0xffffffffU, true}},
                                     true) == 1,
                    "original hiring close and read-back");
            require(mechanicsGpl("MM_Toggle_Bards_Hiring_Closed", {{hall}, {initial, true}},
                                 true) == initial,
                    "original hiring state restored");
            phase = 5;
            host->log(host,
                      "Mechanics control COMPLETE: Phantom/Bard modifiers, real expiry, Chronicles "
                      "awards and hiring state passed. Controlled fixture, not campaign progress.");
        }
        busy = false;
    }
};
