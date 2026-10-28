#include "gpl_world_queries.h"
#include <cassert>
#include <iostream>
#include <map>
#include <vector>

#ifdef NDEBUG
#error "Native world-query acceptance requires active assertions"
#endif

namespace {
struct Ops {
    std::map<std::uint32_t, std::uint32_t> memory;
    std::vector<std::pair<std::uint32_t, std::uint32_t>> ranges;
    unsigned maskReads = 0, intervalCalls = 0;
    int modifier = -50, effectiveInterval = 100, percent = 100;
    std::uint32_t liveUnit = 0x10000, type = 0x20000;
    void region(std::uint32_t at, unsigned size) {
        ranges.emplace_back(at, size);
        for (unsigned i = 0; i < size; i += 4)
            memory[at + i] = 0;
    }
    bool valid(std::uint32_t at, unsigned size) {
        if (!at || size < 4 || at > UINT32_MAX - size)
            return false;
        for (auto [start, bytes] : ranges)
            if (at >= start && size <= bytes && at - start <= bytes - size)
                return true;
        return size == 4 && memory.count(at);
    }
    std::uint32_t read(std::uint32_t at) {
        assert(valid(at, 4));
        if (at >= 0x50000 && at < 0x50000 + 5 * 5 * 24 && (at - 0x50000) % 24 == 4)
            ++maskReads;
        return memory.at(at);
    }
    void write(std::uint32_t at, std::uint32_t value) {
        assert(valid(at, 4));
        memory[at] = value;
    }
    std::uint32_t integer(std::uint32_t value) {
        return value + 8;
    }
    std::uint32_t point(std::uint32_t value) {
        return value + 8;
    }
    std::uint32_t unit(std::uint32_t) {
        return liveUnit;
    }
    std::uint32_t unitType(std::uint32_t) {
        return type;
    }
    int attribute(std::uint32_t unit, std::uint32_t id) {
        assert(unit == liveUnit && id == 0x22565041);
        return modifier;
    }
    int interval(std::uint32_t unit) {
        assert(unit == liveUnit);
        ++intervalCalls;
        return effectiveInterval;
    }
    int distance(std::uint32_t unit, int base) {
        assert(unit == liveUnit);
        return base * percent / 100;
    }
    void frame(std::initializer_list<unsigned> tags) {
        region(0x1000, 12);
        region(0x2000, 4 * tags.size());
        region(0x3000, 4 * tags.size());
        region(0x4000, 16 * tags.size());
        memory[0x1004] = 0x2000;
        memory[0x1008] = 0x2000 + 4 * tags.size();
        unsigned i = 0;
        for (auto tag : tags) {
            memory[0x2000 + i * 4] = 0x3000 + i * 4;
            memory[0x3000 + i * 4] = 0x4000 + i * 16;
            memory[0x4004 + i * 16] = tag;
            ++i;
        }
    }
    void input(unsigned index, int value) {
        memory[0x4008 + index * 16] = static_cast<unsigned>(value);
    }
    int output(unsigned index = 0) {
        return MajestyCommunity::NativeSignedInteger(memory.at(0x4008 + index * 16));
    }
    void map() {
        memory[0x0071c68c] = 0x6000;
        region(0x6000, 0x14);
        region(0x7000, 0x84);
        region(0x8000, 0x50);
        memory[0x6010] = 0x7000;
        memory[0x7080] = 0x8000;
        memory[0x8030] = 4;
        memory[0x8034] = 4;
        memory[0x8038] = 5;
        memory[0x803c] = 5;
        memory[0x804c] = 0x50000;
        region(0x50000, 5 * 5 * 24);
    }
    void movement() {
        memory[0x0071c634] = 0x30000;
        region(0x30000, 0x24);
        memory[0x30020] = 50;
        region(0x10000, 0x48);
        region(0x11000, 0x15c);
        memory[0x10000] = 0x11000;
        memory[0x11158] = 0x00430770;
        region(0x12000, 0x18);
        region(0x13000, 0x14);
        memory[0x10044] = 0x12000;
        memory[0x12008] = 1;
        memory[0x12014] = 0x13000;
        memory[0x13000] = 0x0068b250;
        memory[0x1300c] = 150;
        memory[0x13010] = 32;
        region(0x20000, 0x18);
        region(0x21000, 0xb8 + 8 * 12);
        memory[0x20008] = 3;
        memory[0x20014] = 0x21000;
        memory[0x210b8] = 1;
        memory[0x210c0] = 0x12000;
    }
};
} // namespace

int main() {
    using Q = MajestyCommunity::WorldQuery;
    auto run = [](Ops &ops, Q query) {
        return MajestyCommunity::ExecuteWorldQuery(ops, query, 0x1000);
    };
    Ops fog;
    fog.frame({1, 1, 7});
    fog.map();
    fog.input(1, 7);
    fog.input(2, 16);
    fog.memory[0x402c] = 16;
    assert(run(fog, Q::Fog) && fog.output() == 0);
    fog.memory[0x50004] = 1U << 7;
    assert(run(fog, Q::Fog) && fog.output() == 1);
    fog.input(1, 6);
    assert(run(fog, Q::Fog) && fog.output() == 0);
    fog.input(1, 32);
    fog.maskReads = 0;
    assert(run(fog, Q::Fog) && fog.output() == -1 && fog.maskReads == 0);
    fog.input(1, 7);
    fog.input(2, 128);
    assert(run(fog, Q::Fog) && fog.output() == -1);
    fog.input(2, -1);
    assert(run(fog, Q::Fog) && fog.output() == -1);
    fog.input(2, 16);
    fog.memory[0x3000] = 0x4010; // result aliases player
    assert(run(fog, Q::Fog) && fog.output(1) == 1);
    fog.memory[0x3000] = 0x4000;
    fog.input(1, 7);
    fog.memory[0x8038] = UINT32_MAX;
    fog.memory[0x803c] = UINT32_MAX;
    assert(run(fog, Q::Fog) && fog.output() == -1);

    Ops frontier;
    frontier.frame({1, 1, 7, 1, 1, 7});
    frontier.map();
    frontier.input(1, 7);
    frontier.input(2, 16);
    frontier.memory[0x402c] = 16;
    frontier.input(3, 0);
    frontier.input(4, 1);
    frontier.memory[0x50004] = 1U << 7;
    assert(run(frontier, Q::Frontier) && frontier.output() == 0 && frontier.output(3) == 1);
    frontier.maskReads = 0;
    assert(run(frontier, Q::Frontier) && frontier.output() == 1 && frontier.output(3) == 2);
    assert(frontier.output(5) == 48 && frontier.memory[0x405c] == 16 && frontier.maskReads <= 5);
    frontier.input(4, 0);
    const auto saved = frontier.output(3);
    assert(run(frontier, Q::Frontier) && frontier.output() == -1 && frontier.output(3) == saved);
    frontier.input(4, 257);
    assert(run(frontier, Q::Frontier) && frontier.output() == -1);
    frontier.input(4, 256);
    frontier.input(3, 16);
    assert(run(frontier, Q::Frontier) && frontier.output() == 2 && frontier.output(3) == 16);
    frontier.input(3, -1);
    assert(run(frontier, Q::Frontier) && frontier.output() == -1);
    frontier.input(3, 1);
    frontier.input(4, 1);
    frontier.memory[0x3014] = 0x4020; // output aliases origin
    assert(run(frontier, Q::Frontier) && frontier.output() == 1 && frontier.output(2) == 48);
    frontier.memory[0x4004] = 6;
    assert(!run(frontier, Q::Frontier));

    Ops move;
    move.frame({1, 5, 1});
    move.movement();
    assert(run(move, Q::UnitMovement) && move.output() == 436 && move.intervalCalls == 0);
    move.input(2, 1);
    assert(run(move, Q::UnitMovement) && move.output() == 655 && move.intervalCalls == 1);
    move.percent = 120;
    assert(run(move, Q::UnitMovement) && move.output() == 786);
    move.input(2, 2);
    assert(run(move, Q::UnitMovement) && move.output() == -1);
    move.input(2, 0);
    move.memory[0x11158] = 0;
    assert(run(move, Q::UnitMovement) && move.output() == -2);
    move.memory[0x11158] = 0x00430770;
    move.memory[0x13000] = 0;
    assert(run(move, Q::UnitMovement) && move.output() == -2);
    move.memory[0x13000] = 0x0068b250;
    move.memory[0x30020] = 0;
    assert(run(move, Q::UnitMovement) && move.output() == -3);
    move.memory[0x30020] = 50;
    move.memory[0x13010] = 32768;
    assert(run(move, Q::UnitMovement) && move.output() == -3);

    Ops type;
    type.frame({1, 3});
    type.movement();
    assert(run(type, Q::TypeMovement) && type.output() == 436);
    type.type = 0;
    assert(run(type, Q::TypeMovement) && type.output() == -1);
    type.type = 0x20000;
    type.memory[0x210b8] = 0;
    assert(run(type, Q::TypeMovement) && type.output() == -2);
    type.memory[0x1008] = 0x2000 + 7 * 4;
    assert(!run(type, Q::TypeMovement));
    std::cout << "Native world-query ABI, map boundaries, bounded frontier and movement controls "
                 "passed\n";
}
