#pragma once
// Explicitly opted-in component trials only. Original GPL owns every effect,
// timer and award calculation. These actors come from the pinned owned test
// save; a controlled trial must never be used as ordinary campaign progress.
struct MechanicsArgument {
    std::uint32_t value;
    bool integer = false;
    const char *text = nullptr;
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
    // These two original builtin bindings were independently checked at their
    // Old executable registration sites425274 and5aae78. All other calls must
    // remain interpreted creator bodies, not a permissive native-call path.
    const auto expected = !std::strcmp(symbol, "TeleportToUnit")  ? 0x00424460U
                          : !std::strcmp(symbol, "CheckEffector") ? 0x005a9800U
                                                                  : 0x0061e4c0U;
    require(binding && read(binding + 20) == expected, "mechanics original source binding");
    std::fprintf(stderr, "[mechanics-call] begin=%s\n", symbol);
    call(0x00629bf0U, evaluator);
    const bool agentResult = !std::strcmp(symbol, "MM_Expansion_Probe_Spawn") ||
                             !std::strcmp(symbol, "MM_Expansion_Probe_FirstCaptive");
    const bool booleanResult =
        !std::strcmp(symbol, "Bards_Flourish_Hit") ||
        !std::strcmp(symbol, "Bards_Consume_Flourish") ||
        !std::strcmp(symbol, "Bards_Deflect_Projectile") ||
        !std::strcmp(symbol, "Bards_Deflect_Ready") ||
        !std::strcmp(symbol, "Bards_Hostile_Target") ||
        !std::strcmp(symbol, "Bards_Dancer_Level") || !std::strcmp(symbol, "CheckEffector") ||
        !std::strcmp(symbol, "Phantom_Icy_Touch_In_Range") || !std::strcmp(symbol, "MM_KR_Live");
    if (booleanResult || agentResult) {
        //629BF0 installs an integer return slot. GPL booleans are a distinct
        // native type6; assigning one to that integer throws. Use the same
        // original drain/append/rebuild protocol as agent-valued callbacks.
        call(0x00637780U, evaluator + 8);
        const auto pool = read(read(read(0x007218b4U) + 0x10) + 0x1c);
        const auto resultTag = agentResult ? 5U : 6U;
        const auto value = call(0x0062a810U, pool, {resultTag});
        require(value && read(value + 4) == resultTag, "original typed mechanics return storage");
        call(read(read(value) + 0x10), value);
        call(0x00636bf0U, evaluator + 8, {value});
        call(0x00637e10U, evaluator + 0x1c, {evaluator + 8});
    }
    for (const auto &arg : args) {
        if (!arg.text) {
            call(arg.integer ? 0x00629a40U : 0x00629a20U, evaluator, {arg.value});
            continue;
        }
        const auto size = std::strlen(arg.text);
        require(size < 120, "bounded mechanics string");
        for (unsigned i = 0; i <= size; ++i)
            require(host->guest_write_u8(host, memory + 128 + i, arg.text[i]) == POP_OK,
                    "mechanics string bytes");
        const auto pool = read(read(read(0x007218b4U) + 0x10) + 0x1c);
        const auto value = call(0x0062a810U, pool, {3});
        require(value && read(value + 4) == 3, "original owned mechanics string value");
        call(0x004e3520U, memory, {memory + 128});
        call(0x004e4180U, valueRef(value, 0x30), {memory});
        call(0x004e3820U, memory);
        call(0x00636bf0U, evaluator + 8, {value});
    }
    call(0x00637e10U, evaluator + 0x1c, {evaluator + 8});
    call(0x00629c40U, evaluator);
    std::uint32_t result = 0;
    if (scalar) {
        const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
        require(begin && end - begin == (args.size() + 1) * 4 && read(read(begin)) &&
                    (read(read(read(begin)) + 4) == 1 || read(read(read(begin)) + 4) == 6 ||
                     (agentResult && read(read(read(begin)) + 4) == 5)),
                "mechanics original typed scalar return and argument references");
        if (agentResult) {
            BaseTimingOps ops;
            result = ops.unit(read(read(begin)));
        } else if (booleanResult) {
            const auto value = read(read(begin));
            require(read(value + 4) == 6 && read(read(value) + 0x2c) == 0x00643940U,
                    "pinned Old GplBoolean getter, not integer conversion");
            std::uint8_t boolean = 0;
            require(host->guest_read_u8(host, valueRef(value, 0x2c), &boolean) == POP_OK &&
                        boolean <= 1,
                    "original boolean result value");
            result = boolean;
        } else {
            result = call(0x00629c10U, evaluator);
        }
    }
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "mechanics GPL release");
    std::fprintf(stderr, "[mechanics-call] end=%s result=%u\n", symbol, result);
    return result;
}
struct MechanicsProbe {
    unsigned variant = 1;
    std::uint32_t stormIdentity = 0, stormCaster = 0;
    unsigned phase = 0;
    std::uint32_t started = 0;
    bool busy = false;
    std::uint32_t dancer = 0, phantom = 0, troubadour = 0, hall = 0;
    std::uint32_t movement = 0, action = 0, strength = 0, dancerParry = 0, dancerResist = 0;
    std::uint32_t maxHp = 0, parry = 0, resist = 0, attack = 0, ranged = 0;
    std::uint32_t singer = 0, enemy = 0, secondEnemy = 0, casts = 0, lastCast = 0;
    std::uint32_t stat(std::uint32_t unit, std::uint32_t key) {
        return call(0x005a1c40U, unit, {key, 0});
    }
    std::uint32_t namedInteger(std::uint32_t unit, const char *name) {
        const auto agentId = stat(unit, 0x4541U);
        const auto agent = call(0x006236b0U, call(0x00623b20U, 0), {agentId});
        require(agent != 0, "mechanics actual native GPL agent");
        std::uint32_t memory = 0;
        const auto length = std::strlen(name);
        require(length < 120 && host->guest_alloc(host, 256, &memory) == POP_OK,
                "mechanics named value storage");
        for (unsigned i = 0; i <= length; ++i)
            require(host->guest_write_u8(host, memory + 128 + i, name[i]) == POP_OK,
                    "mechanics named value bytes");
        call(0x004e3520U, memory, {memory + 128});
        const auto value = call(0x006263d0U, agent, {memory});
        require(!value || read(value + 4) == 1, "mechanics named value is an original integer");
        const auto result = value ? read(valueRef(value, 0x28)) : 0;
        call(0x004e3820U, memory);
        require(host->guest_free(host, memory) == POP_OK, "mechanics named value release");
        return result;
    }
    std::uint32_t namedValue(std::uint32_t unit, const char *name, std::uint32_t memory) {
        const auto agent = call(0x006236b0U, call(0x00623b20U, 0), {stat(unit, 0x4541U)});
        require(agent && std::strlen(name) < 100, "existing named fixture task context");
        for (unsigned i = 0; i <= std::strlen(name); ++i)
            require(host->guest_write_u8(host, memory + 128 + i, name[i]) == POP_OK,
                    "fixture task name");
        call(0x004e3520U, memory, {memory + 128});
        const auto value = call(0x006263d0U, agent, {memory});
        call(0x004e3820U, memory);
        require(value, "fixture only assigns an existing creator task attribute");
        return value;
    }
    void assignAgent(std::uint32_t unit, const char *name, std::uint32_t target) {
        std::uint32_t memory = 0;
        require(host->guest_alloc(host, 256, &memory) == POP_OK, "fixture agent task storage");
        const auto destination = namedValue(unit, name, memory);
        const char symbol[] = "Bards_Flourish_Reset";
        for (unsigned i = 0; i < sizeof(symbol); ++i)
            require(host->guest_write_u8(host, memory + 128 + i, symbol[i]) == POP_OK,
                    "fixture boxing symbol");
        call(0x004e3520U, memory, {memory + 128});
        call(0x00629910U, memory + 32, {memory});
        call(0x004e3820U, memory);
        call(0x00629bf0U, memory + 32);
        call(0x00629a20U, memory + 32, {target});
        call(0x00637e10U, memory + 32 + 0x1c, {memory + 32 + 8});
        const auto begin = read(memory + 32 + 0x20);
        const auto source = read(read(begin + 4));
        require(read(destination + 4) == 5 && read(source + 4) == 5,
                "native agent task value types");
        call(read(read(destination) + 0x18), destination, {source});
        call(0x006299b0U, memory + 32);
        require(host->guest_free(host, memory) == POP_OK, "fixture agent task release");
    }
    void assignText(std::uint32_t unit, const char *name, const char *text) {
        std::uint32_t memory = 0;
        require(std::strlen(text) < 100 && host->guest_alloc(host, 256, &memory) == POP_OK,
                "fixture string task storage");
        const auto destination = namedValue(unit, name, memory);
        require(read(destination + 4) == 3, "native string task type");
        for (unsigned i = 0; i <= std::strlen(text); ++i)
            require(host->guest_write_u8(host, memory + 128 + i, text[i]) == POP_OK,
                    "fixture string task value");
        call(0x004e3520U, memory, {memory + 128});
        call(0x004e4180U, valueRef(destination, 0x30), {memory});
        call(0x004e3820U, memory);
        require(host->guest_free(host, memory) == POP_OK, "fixture string task release");
    }
    void combatTick() {
        if (phase >= 9 || busy)
            return;
        const auto world = read(0x0071c68cU), manager = world ? read(world + 4) : 0;
        if (!manager)
            return;
        if (!phase) {
            dancer = call(0x005a10d0U, manager, {585});
            phantom = call(0x005a10d0U, manager, {1412});
            singer = call(0x005a10d0U, manager, {603});
            hall = call(0x005a10d0U, manager, {561});
            enemy = call(0x005a10d0U, manager, {512});
            secondEnemy = call(0x005a10d0U, manager, {506});
            if (!dancer || !phantom || !singer || !hall || !enemy || !secondEnemy)
                return;
            require(read(phantom + 0x6c) == 0x31705641U && read(singer + 0x6c) == 0x31755641U &&
                        read(enemy + 0x6c) == 0x314e5642U &&
                        read(secondEnemy + 0x6c) == 0x314e5642U && read(enemy + 0x70) == 7 &&
                        read(secondEnemy + 0x70) == 7,
                    "combat fixture uses the original owned heroes and living Daemonwoods");
        }
        if (phase <= 6)
            require(call(0x005a10d0U, manager, {1412}) == phantom,
                    "active Phantom casts retain their exact living native identity");
        if (phase <= 2)
            require(call(0x005a10d0U, manager, {603}) == singer,
                    "Arcane Note launch retains its exact living native caster identity");
        // Once a spell has been launched, normal caster deaths remain legal;
        // the storm's own identity and native cleanup are the final witness.
        if (phase <= 3)
            require(call(0x005a10d0U, manager, {512}) == enemy &&
                        call(0x005a10d0U, manager, {506}) == secondEnemy,
                    "projectile phase retains its exact native target identities");
        busy = true;
        const auto now = read(0x0071c6a8U);
        if (!phase) {
            std::fprintf(
                stderr,
                "[mechanics-old-building] table=%08x setter=%08x owner20=%08x getter=%08x\n",
                read(hall), read(read(hall) + 0x124), read(read(hall) + 0x20),
                read(read(hall) + 0x120));
            const auto oldHp = stat(phantom, 0x00555041U), maximum = stat(phantom, 0x01555041U);
            const auto singerMax = stat(singer, 0x01555041U);
            require(oldHp > 0 && maximum > 5 && singerMax > 5, "living healing control subjects");
            call(read(read(phantom) + 0x124), phantom, {0x00555041U, maximum - 5});
            mechanicsGpl("Player_Heal", {{phantom}, {5, true}});
            mechanicsGpl("Heal", {{singer}, {phantom}, {5, true}});
            require(stat(phantom, 0x00555041U) == maximum - 5,
                    "Phantom refuses sovereign and non-Priestess healing");
            call(read(read(singer) + 0x124), singer, {0x00555041U, singerMax - 5});
            mechanicsGpl("Player_Heal", {{singer}, {5, true}});
            require(stat(singer, 0x00555041U) == singerMax,
                    "ordinary hero still accepts sovereign healing");
            call(read(read(phantom) + 0x124), phantom, {0x00555041U, oldHp});
            for (unsigned step = 0; step < 10 && stat(phantom, 0x0b565041U) < 7; ++step) {
                const auto level = stat(phantom, 0x0b565041U), needed = stat(phantom, 0x0a565041U);
                require(level && level < 20 && needed && needed < 1000000,
                        "bounded ordinary experience award preconditions");
                mechanicsGpl("give_exp", {{phantom}, {(needed + 10) * level, true}});
            }
            require(stat(phantom, 0x0b565041U) >= 7,
                    "original experience/level-up path reaches Phantom perks");
            mechanicsGpl("Bards_Flourish_Reset", {{dancer}});
            for (unsigned hit = 0; hit < 3; ++hit)
                require(mechanicsGpl("Bards_Flourish_Hit", {{dancer}, {secondEnemy}}, true) ==
                            (hit == 2),
                        "Dancer arms Flourish on exactly the third hostile hit");
            require(mechanicsGpl("Bards_Consume_Flourish", {{dancer}, {secondEnemy}}, true) == 1 &&
                        mechanicsGpl("Bards_Consume_Flourish", {{dancer}, {secondEnemy}}, true) ==
                            0 &&
                        mechanicsGpl("Bards_Flourish_Hit", {{dancer}, {phantom}}, true) == 0,
                    "Flourish consumes once and refuses an allied hero");
            require(!mechanicsGpl("CheckEffector", {{enemy}, {0, false, "ice_lance_chill_icon"}},
                                  true) &&
                        !mechanicsGpl("CheckEffector",
                                      {{enemy}, {0, false, "ice_lance_empowered_chill_icon"}},
                                      true),
                    "projectile target begins without Phantom Chill");
            movement = stat(enemy, 0x00555041U);
            mechanicsGpl("TeleportToUnit", {{phantom}, {50000, true}, {enemy}, {100, true}});
            mechanicsGpl("Ice_Lance_Cast", {{phantom}, {enemy}});
            casts = 1;
            lastCast = started = now;
            phase = 1;
            host->log(host, "Combat control: healing restrictions, original level-ups and Flourish "
                            "gates passed; real Ice Lance launched.");
        } else if (phase == 1) {
            if (mechanicsGpl("CheckEffector", {{enemy}, {0, false, "ice_lance_chill_icon"}},
                             true) ||
                mechanicsGpl("CheckEffector",
                             {{enemy}, {0, false, "ice_lance_empowered_chill_icon"}}, true)) {
                std::fprintf(stderr,
                             "[mechanics-projectile] IceLance enemy=512 hp-before=%u hp-after=%u "
                             "chill-tier=%u reborn=%u\n",
                             movement, stat(enemy, 0x00555041U),
                             namedInteger(enemy, "PhantomChillTier"),
                             namedInteger(phantom, "Reborn_Counter"));
                mechanicsGpl("TeleportToUnit",
                             {{singer}, {50000, true}, {secondEnemy}, {110, true}});
                mechanicsGpl(
                    "Cast",
                    {{singer}, {0, false, "Bards_Arcane_Note"}, {secondEnemy}, {0, false, ""}});
                casts = 1;
                lastCast = started = now;
                phase = 2;
                host->log(host, "Combat control: real Ice Lance projectile callback applied Chill; "
                                "native Arcane Note casting began.");
            } else if (now - lastCast >= 1500 && casts < 8) {
                mechanicsGpl("Ice_Lance_Cast", {{phantom}, {enemy}});
                ++casts;
                lastCast = now;
            }
            require(now - started < 30000, "real Ice Lance hit deadline");
        } else if (phase == 2) {
            if (mechanicsGpl("Bards_Resonance_Count", {{secondEnemy}}, true)) {
                require(mechanicsGpl("Bards_Deflect_Projectile", {{secondEnemy}, {dancer}}, true) ==
                                1 &&
                            mechanicsGpl("Bards_Deflect_Projectile", {{secondEnemy}, {dancer}},
                                         true) == 0,
                        "Dancer projectile defense commits and enforces its cooldown");
                for (unsigned n = 0; n < 8; ++n)
                    mechanicsGpl("Bards_Resonance_Add", {{singer}, {secondEnemy}});
                require(mechanicsGpl("Bards_Resonance_Count", {{secondEnemy}}, true) == 6,
                        "actual Spellsinger Resonance saturates at six");
                mechanicsGpl("Bards_Crescendo", {{secondEnemy}});
                require(mechanicsGpl("Bards_Resonance_Count", {{secondEnemy}}, true) == 0 &&
                            mechanicsGpl("CheckEffector",
                                         {{secondEnemy}, {0, false, "Bards_Crescendo_Icon"}}, true),
                        "Crescendo consumes Resonance and owns the native timed stun overlay");
                started = now;
                phase = 3;
                host->log(host, "Combat control: real Arcane Note hit built Resonance; Deflect "
                                "cooldown and Crescendo consume/cap passed.");
            } else if (now - lastCast >= 1500 && casts < 8) {
                mechanicsGpl(
                    "Cast",
                    {{singer}, {0, false, "Bards_Arcane_Note"}, {secondEnemy}, {0, false, ""}});
                ++casts;
                lastCast = now;
            }
            require(now - started < 30000, "real Arcane Note hit deadline");
        } else if (phase == 3 && now - started >= 4000) {
            require(!mechanicsGpl("CheckEffector",
                                  {{secondEnemy}, {0, false, "Bards_Crescendo_Icon"}}, true),
                    "native Crescendo timed overlay expires");
            host->log(host, "Combat control: actual projectiles, healing restrictions, source "
                            "level-ups, Flourish, Deflect and Resonance/Crescendo passed.");
            const auto &research = researchBindings.front();
            const auto symbol = research.record.CallbackSymbol();
            require(mechanicsGpl(symbol.c_str(), {{hall}, {0, true}}, true) == 1 &&
                        mechanicsGpl("CheckEffector",
                                     {{hall}, {0, false, "Bards_Chronicles_Active"}}, true),
                    "saved Chronicles completion reconciles its original visual after reload");
            call(0x00431130U, hall, {0x02425041U, 0});
            started = now;
            phase = 4;
        } else if (phase == 4 && now - started >= 250) {
            // Native DeleteEffector runs the overlay exit animation before
            // retirement. Poll a bounded deadline rather than destroying it.
            if (mechanicsGpl("CheckEffector", {{hall}, {0, false, "Bards_Chronicles_Active"}},
                             true)) {
                require(now - started < 6000,
                        "native research overlay retires within its exit-animation deadline");
                busy = false;
                return;
            }
            call(0x00431130U, hall, {0x02425041U, 1});
            require(mechanicsGpl("CheckEffector", {{hall}, {0, false, "Bards_Chronicles_Active"}},
                                 true),
                    "completed Hall regains its saved research visual");
            require(read(hall + 0x70) == 0, "owned initial research kingdom");
            call(0x005a2670U, hall, {1});
            started = now;
            phase = 5;
        } else if (phase == 5 && now - started >= 250) {
            if (mechanicsGpl("CheckEffector", {{hall}, {0, false, "Bards_Chronicles_Active"}},
                             true)) {
                require(now - started < 6000,
                        "transferred research overlay retires within its exit-animation deadline");
                busy = false;
                return;
            }
            call(0x005a2670U, hall, {0});
            require(mechanicsGpl("CheckEffector", {{hall}, {0, false, "Bards_Chronicles_Active"}},
                                 true),
                    "return to the researched kingdom restores its visual");
            const auto wolf = call(0x005a10d0U, manager, {2294});
            require(wolf && stat(wolf, 0x00555041U) > 0,
                    "original living frost-freeze control wolf");
            mechanicsGpl("Frost_Armor_Freeze", {{wolf}});
            mechanicsGpl("Frost_Armor_Freeze", {{wolf}});
            require(mechanicsGpl("CheckEffector", {{wolf}, {0, false, "frost_armor_frozen_timer"}},
                                 true),
                    "Frost Armor native freeze timer refreshes");
            mechanicsGpl("Frost_Armor_Freeze", {{hall}});
            require(!mechanicsGpl("CheckEffector", {{hall}, {0, false, "frost_armor_frozen_timer"}},
                                  true),
                    "Frost Armor freeze refuses buildings");
            started = now;
            phase = 6;
            host->log(host,
                      "Combat control: saved research reload/stage/ownership lifecycle "
                      "passed; actual Frost Armor freeze refresh and building negative passed.");
        } else if (phase == 6 && now - started >= 3600) {
            const auto wolf = call(0x005a10d0U, manager, {2294});
            require(wolf && !mechanicsGpl("CheckEffector",
                                          {{wolf}, {0, false, "frost_armor_frozen_timer"}}, true),
                    "original Frost Armor freeze timer expires");
            if (variant == 3) {
                phase = 9;
                busy = false;
                host->log(host, "Research/freeze control COMPLETE: original reload/stage/ownership "
                                "and freeze expiry passed.");
                return;
            }
            const auto target = call(0x005a10d0U, manager, {510});
            require(target && stat(target, 0x00555041U) >= 100,
                    "untouched actual Icy Touch target");
            mechanicsGpl("TeleportToUnit", {{phantom}, {50000, true}, {target}, {10, true}});
            assignAgent(phantom, "Target", target);
            require(mechanicsGpl("Phantom_Icy_Touch_In_Range", {{phantom}, {target}}, true),
                    "Icy Touch original melee contact gate");
            const auto hp = stat(target, 0x00555041U);
            mechanicsGpl("Icy_Touch_Cast", {{phantom}, {target}});
            require(
                stat(target, 0x00555041U) < hp &&
                    mechanicsGpl("CheckEffector", {{target}, {0, false, "gravechill_icon"}}, true),
                "actual Icy Touch melee callback deals damage and applies Gravechill");
            const auto haunt = call(0x005a10d0U, manager, {1168});
            require(haunt && read(haunt + 0x70) == 0, "original recruiting Haunt remains friendly");
            assignAgent(phantom, "Target", phantom);
            assignText(phantom, "TaskName", "go_home");
            require(mechanicsGpl("Phantom_Call_To_Grave_Home_Check", {{phantom}}, true) == 1,
                    "Call to Grave accepts original distant own Haunt home task");
            mechanicsGpl("Call_To_Grave_DoMove", {{phantom}, {50000, true}});
            require(mechanicsGpl("Phantom_Call_To_Grave_Home_Check", {{phantom}}, true) == 0,
                    "Call to Grave original native teleport reaches its own home vicinity");
            mechanicsGpl("TeleportToUnit", {{phantom}, {50000, true}, {target}, {110, true}});
            mechanicsGpl("Endless_Winter_Hit", {{phantom}, {target}});
            require(stormIdentity && stormCaster == 1412,
                    "actual Endless Winter unit birth retains its original Phantom caster");
            started = now;
            phase = 7;
            host->log(host,
                      "Combat control: Frost freeze expired; real Icy Touch and Call to Grave "
                      "home teleport passed; actual Endless Winter created with correct caster.");
        } else if (phase == 7 && now - started >= 22500) {
            const auto storm = call(0x005a10d0U, manager, {stormIdentity});
            require(!storm || (read(storm + 0x64) & 4),
                    "Endless Winter original timeout/cleanup removes the storm");
            phase = 9;
            host->log(host, "Combat control COMPLETE: actual projectiles, healing restrictions, "
                            "source level-ups, Flourish, Deflect, Resonance/Crescendo, research "
                            "reload/stage/ownership, Frost freeze, Icy Touch, home teleport and "
                            "Endless Winter native cleanup passed. Controlled encounter, not "
                            "campaign progress.");
        }
        busy = false;
    }
    void tick() {
        if (variant == 2 || variant == 3) {
            if (variant == 3 && phase == 0) {
                const auto root = read(0x0071c68cU), manager = root ? read(root + 4) : 0;
                if (!manager)
                    return;
                hall = call(0x005a10d0U, manager, {561});
                phantom = call(0x005a10d0U, manager, {1412});
                singer = call(0x005a10d0U, manager, {603});
                enemy = call(0x005a10d0U, manager, {512});
                secondEnemy = call(0x005a10d0U, manager, {506});
                if (!hall || !phantom || !singer || !enemy || !secondEnemy)
                    return;
                phase = 3;
                started = read(0x0071c6a8U) - 4000;
            }
            combatTick();
            return;
        }
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
