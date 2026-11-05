#include "movement_scale.h"
#include <cassert>
#include <map>
#include <set>
#include <vector>

struct Record {
    unsigned overlayId, percent;
};
struct Ops {
    std::map<std::uint32_t, std::uint32_t> memory{
        {0x1044, 0x2000}, {0x1094, 0x4000}, {0x2014, 0x3000}, {0x3000, 0x0068b250}};
    std::set<unsigned> overlays;
    bool valid(std::uint32_t address, unsigned bytes) {
        return address >= 0x1000 && address <= 0x5000 - bytes;
    }
    unsigned read(unsigned address) {
        return memory.at(address);
    }
    bool hasEffector(unsigned unit, unsigned id) {
        assert(unit == 0x1000);
        return overlays.count(id) != 0;
    }
};

int main() {
    Ops ops;
    const auto before = ops.memory;
    const std::vector<Record> records{{1, 115}, {2, 120}, {3, 1}, {4, 1}};
    const auto step = [&](int base, unsigned flags = 0) {
        return MajestyCommunity::CurrentMovementStep(ops, 0x1000, base, flags, records);
    };
    assert(step(1000) == 1000);
    ops.overlays = {1};
    assert(step(1000) == 1150);
    // Repeated updates use the same base; expiry immediately removes the bonus.
    assert(step(1000) == 1150);
    ops.overlays = {};
    assert(step(1000) == 1000);
    ops.overlays = {1, 2};
    assert(step(1000) == 1350);
    assert(step(30000, 0x4000) == 30720);
    assert(step(0x7fffffff) == 0x7fffffff);
    assert(step(-1) == -1 && step(0) == 0);
    ops.overlays = {3, 4};
    assert(step(1) == 1 && step(1000) == 10);
    assert(ops.memory == before); // No native descriptor/cache/attribute writes.
    ops.memory[0x3000] = 0x006898dc;
    assert(step(1000) == 1000); // Unsupported engine remains stock.
    ops.memory[0x3000] = 0x0068b250;
    ops.memory[0x1094] = 0;
    assert(step(1000) == 1000);
    assert(MajestyCommunity::CurrentMovementStep(ops, 0, 1000, 0, records) == 1000);
}
