#include "gpl_integer_helpers.h"
#include "gpl_base_timing_helpers.h"
#include "gpl_spell_timing_helpers.h"
#include <cassert>
#include <climits>
#include <map>
#include <vector>

struct Ops {
    std::map<std::uint32_t, std::uint32_t> words;
    std::uint32_t clock = 0;
    unsigned writes = 0;
    std::uint32_t actionDescription = 0, liveUnit = 0, effect = 0, order = 0;
    int descriptionStatus = -1;
    std::vector<std::pair<std::uint32_t, std::uint32_t>> writeOrder;
    std::uint32_t call(std::uint32_t address, std::uint32_t self,
                       std::initializer_list<std::uint32_t> arguments) {
        assert(arguments.size() == (address == 0x005b4570U ? 1 : 2));
        assert(self == (address == 0x005b4570U ? liveUnit : effect));
        return address == 0x005b4570U ? effect : order;
    }
    std::uint32_t timingDescription(std::uint32_t, bool, int &status) {
        status = descriptionStatus;
        return actionDescription;
    }
    bool valid(std::uint32_t address, std::uint32_t bytes) {
        return address && bytes >= 4 && address <= UINT32_MAX - bytes && words.count(address) &&
               words.count(address + bytes - 4);
    }
    std::uint32_t read(std::uint32_t address) {
        return words.at(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        ++writes;
        writeOrder.emplace_back(address, value);
        words[address] = value;
    }
    std::uint32_t integer(std::uint32_t value) {
        return value + 8;
    }
    std::uint32_t now() {
        return clock;
    }
    std::uint32_t action(std::uint32_t) {
        return actionDescription;
    }
    std::uint32_t unit(std::uint32_t) {
        return liveUnit;
    }
    void frame(std::initializer_list<std::uint32_t> values) {
        words = {{0x1000, 0}, {0x1004, 0x2000}, {0x1008, 0x2000 + unsigned(values.size()) * 4}};
        unsigned index = 0;
        for (auto number : values) {
            const auto reference = 0x3000 + index * 4, value = 0x4000 + index * 16;
            words[0x2000 + index++ * 4] = reference;
            words[reference] = value;
            words[value] = 0x8000;
            words[value + 4] = 1;
            words[value + 8] = number;
        }
        writes = 0;
        writeOrder.clear();
    }
    std::uint32_t value(unsigned index) {
        return 0x4008 + index * 16;
    }
};

int main() {
    using Kind = MajestyCommunity::IntegerHelper;
    Ops ops;
    const auto execute = [&](Kind helper) {
        return MajestyCommunity::ExecuteIntegerHelper(ops, helper, 0x1000);
    };
    ops.frame({0});
    ops.clock = 0xffffffff;
    assert(execute(Kind::SimulationTime) && ops.read(ops.value(0)) == 0xffffffff);
    ops.frame({0, 0xfffffff0});
    ops.clock = 0x10;
    assert(execute(Kind::SimulationElapsed) && ops.read(ops.value(0)) == 32);
    ops.frame({0, 0});
    ops.clock = 0xffffffff;
    assert(execute(Kind::SimulationElapsed) && ops.read(ops.value(0)) == INT_MAX);
    ops.frame({0});
    assert(execute(Kind::SimulationElapsed) && ops.read(ops.value(0)) == 0xffffffff);
    ops.frame({0, INT_MAX - 1, 500});
    assert(execute(Kind::CapAdd) && ops.read(ops.value(0)) == INT_MAX);
    ops.frame({0, 17, 0xffffffff});
    assert(execute(Kind::CapAdd) && ops.read(ops.value(0)) == 17);
    ops.frame({0, 7, 15, 95});
    assert(execute(Kind::AwardBonus) && ops.read(ops.value(0)) == 2 && ops.read(ops.value(3)) == 0);
    ops.frame({0, 7, 15, 0});
    assert(execute(Kind::AwardBonus) && ops.read(ops.value(0)) == 1 && ops.read(ops.value(3)) == 5);
    ops.frame({0, INT_MAX, 100, 99});
    assert(execute(Kind::AwardBonus) && ops.read(ops.value(0)) == INT_MAX &&
           ops.read(ops.value(3)) == 99);
    ops.frame({0, 7, 15, 100});
    assert(execute(Kind::AwardBonus) && ops.read(ops.value(0)) == 0 &&
           ops.read(ops.value(3)) == 100);
    ops.frame({0, 7, 15, 95});
    ops.words[0x3000] = ops.words[0x3004]; // Result aliases base; consume it first.
    assert(execute(Kind::AwardBonus) && ops.read(ops.value(1)) == 2 && ops.read(ops.value(3)) == 0);
    ops.frame({0, 7, 15, 95});
    ops.words[0x3000] = ops.words[0x300c]; // Author explicitly refuses result/carry alias.
    assert(execute(Kind::AwardBonus) && ops.read(ops.value(3)) == 0);
    ops.frame({0});
    ops.words[0x1008] = 0x2003;
    assert(!execute(Kind::SimulationTime) && !ops.writes);
    ops.frame({0});
    ops.words[0x1008] = 0x2014;
    assert(!execute(Kind::SimulationTime) && !ops.writes);
    ops.frame({0});
    ops.words[0x4004] = 10;
    assert(!execute(Kind::SimulationTime) && !ops.writes);
    ops.frame({0, 7, 15, 95});
    ops.words[0x4014] = 3;
    assert(execute(Kind::AwardBonus) && ops.read(ops.value(0)) == 0 &&
           ops.read(ops.value(3)) == 95);
    using Timing = MajestyCommunity::BaseTimingHelper;
    const auto timing = [&](Timing helper) {
        return MajestyCommunity::ExecuteBaseTimingHelper(ops, helper, 0x1000);
    };
    const auto action = [&] {
        ops.frame({0, 0});
        ops.words[0x4014] = 3;
        ops.actionDescription = 0x6000;
        ops.words.insert({{0x6000, 0x9000},
                          {0x6008, 1},
                          {0x6014, 0x5000},
                          {0x5000, 0x006898dc},
                          {0x5028, 1100}});
    };
    action();
    assert(timing(Timing::Action) && ops.read(ops.value(0)) == 1100);
    action();
    ops.words[0x5000] = 0x0068b250;
    assert(timing(Timing::Action) && ops.read(ops.value(0)) == 0xfffffffd);
    action();
    ops.words[0x5028] = 0xffffffff;
    assert(timing(Timing::Action) && ops.read(ops.value(0)) == 0xfffffffd);
    action();
    ops.actionDescription = 0;
    assert(timing(Timing::Action) && ops.read(ops.value(0)) == 0xffffffff);
    const auto movement = [&] {
        ops.frame({0, 0});
        ops.words[0x4014] = 5;
        ops.liveUnit = 0x7000;
        ops.words.insert({{0x7000, 0x80000},
                          {0x7044, 0x6000},
                          {0x80158, 0x00430770},
                          {0x6000, 0x9000},
                          {0x6008, 1},
                          {0x6014, 0x5000},
                          {0x5000, 0x0068b250},
                          {0x500c, 133}});
    };
    movement();
    assert(timing(Timing::Movement) && ops.read(ops.value(0)) == 133);
    movement();
    ops.words[0x80158] = 0x005a1a30;
    assert(timing(Timing::Movement) && ops.read(ops.value(0)) == 0xfffffffd);
    movement();
    ops.words[0x6008] = 2;
    assert(timing(Timing::Movement) && ops.read(ops.value(0)) == 0xfffffffd);
    movement();
    ops.liveUnit = 0;
    assert(timing(Timing::Movement) && ops.read(ops.value(0)) == 0xffffffff);

    using Spell = MajestyCommunity::SpellTimingHelper;
    const auto spell = [&](Spell helper) {
        return MajestyCommunity::ExecuteSpellTimingHelper(ops, helper, 0x1000);
    };
    const auto learned = [&] {
        ops.frame({0, 0, 0});
        ops.words[0x4014] = 5;
        ops.words[0x4024] = 3;
        ops.liveUnit = 0x7000;
        ops.actionDescription = 0x6000;
        ops.words.insert({{0x7000, 0x0068098c},
                          {0x7150, 0x9000},
                          {0x7154, 0x7150},
                          {0x7158, 0x9000},
                          {0x715c, 1},
                          {0x9000, 0},
                          {0x9004, 123},
                          {0x9008, 2},
                          {0x900c, 3},
                          {0x9010, 1}, // Availability byte is outside the edited fields.
                          {0x6000, 0},
                          {0x6004, 123},
                          {0x6018, 0x5000},
                          {0x5000, 0},
                          {0x500c, 777}});
        ops.clock = 0xfffffff0;
    };
    learned();
    assert(spell(Spell::Commit) && ops.read(ops.value(0)) == 1);
    assert(ops.read(0x900c) == 777 && ops.read(0x9008) == 0xfffffff0 && ops.read(0x9004) == 123 &&
           ops.read(0x9010) == 1);
    assert(ops.writeOrder[0].first == 0x900c && ops.writeOrder[1].first == 0x9008);
    learned();
    ops.words[0x9004] = 124;
    assert(spell(Spell::Commit) && ops.read(ops.value(0)) == 0 && ops.writes == 1);
    learned();
    ops.words[0x7000] = 0x006801e4;
    assert(spell(Spell::Commit) && ops.read(ops.value(0)) == 0xfffffffd && ops.writes == 1);
    learned();
    ops.words[0x500c] = 0x80000000;
    assert(spell(Spell::Commit) && ops.read(ops.value(0)) == 0xfffffffd && ops.writes == 1);
    learned();
    ops.words[0x715c] = 65537;
    assert(spell(Spell::Commit) && ops.read(ops.value(0)) == 0xfffffffd && ops.writes == 1);
    learned();
    ops.actionDescription = 0;
    ops.descriptionStatus = -4;
    assert(spell(Spell::Commit) && ops.read(ops.value(0)) == 0xfffffffc && ops.writes == 1);
    learned();
    ops.liveUnit = 0;
    assert(spell(Spell::Commit) && ops.read(ops.value(0)) == 0xffffffff);
    const auto timedEffect = [&] {
        learned();
        ops.words[0x7000] = 0x80000;
        ops.words[0x80140] = 0x005b4570;
        ops.effect = 0xa000;
        ops.words[0xa000] = 0xb000;
        ops.words[0xb180] = 0x005b2e10;
        ops.order = 0xc000;
        ops.words.insert({{0xc000, 0},
                          {0xc008, 0xfffffff0},
                          {0xc00c, 100},
                          {0xc010, 9},
                          {0xc018, 0},
                          {0xc02c, 0x100d}});
        ops.clock = 0x10;
    };
    timedEffect();
    assert(spell(Spell::Remaining) && ops.read(ops.value(0)) == 68 && ops.writes == 1);
    timedEffect();
    ops.clock = 0x100;
    assert(spell(Spell::Remaining) && ops.read(ops.value(0)) == 0);
    timedEffect();
    ops.words[0xc018] = 1;
    assert(spell(Spell::Remaining) && ops.read(ops.value(0)) == 0xfffffffe);
    timedEffect();
    ops.order = 0;
    assert(spell(Spell::Remaining) && ops.read(ops.value(0)) == 0xfffffffe);
    timedEffect();
    ops.effect = 0;
    assert(spell(Spell::Remaining) && ops.read(ops.value(0)) == 0);
    timedEffect();
    ops.words[0xc02c] = 0x100c;
    assert(spell(Spell::Remaining) && ops.read(ops.value(0)) == 0xfffffffd);
    timedEffect();
    ops.words[0x80140] = 0;
    assert(spell(Spell::Remaining) && ops.read(ops.value(0)) == 0xfffffffd);
}
