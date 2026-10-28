#pragma once
#include "BoundedMapQuery.h"
#include "MovementRate.h"
#include "gpl_integer_helpers.h"
#include <array>
#include <limits>

namespace MajestyCommunity {
enum class WorldQuery { Fog, Frontier, UnitMovement, TypeMovement };

// Old's argument collection is begin/end at+4/+8. Location is native tag7,
// whose coordinate reference owns two signed world-coordinate integers.
struct WorldQueryArguments {
    std::array<std::uint32_t, 6> values{}, integers{};
    unsigned count = 0;
    template <class Ops> bool read(Ops &ops, std::uint32_t context) {
        if (!ops.valid(context, 12))
            return false;
        const auto begin = ops.read(context + 4), end = ops.read(context + 8);
        if (!begin || (begin & 3) || end < begin || (end - begin) % 4 || end - begin < 4 ||
            end - begin > values.size() * 4 || !ops.valid(begin, end - begin))
            return false;
        count = (end - begin) / 4;
        for (unsigned i = 0; i < count; ++i) {
            const auto ref = ops.read(begin + i * 4);
            if (!ops.valid(ref, 4))
                return false;
            values[i] = ops.read(ref);
            if (!ops.valid(values[i], 8))
                return false;
            if (ops.read(values[i] + 4) == 1) {
                integers[i] = ops.integer(values[i]);
                if (!ops.valid(integers[i], 4))
                    return false;
            }
        }
        return integers[0] != 0;
    }
    template <class Ops> std::uint32_t point(Ops &ops, unsigned index) const {
        if (index >= count || ops.read(values[index] + 4) != 7)
            return 0;
        const auto ref = ops.point(values[index]);
        return ops.valid(ref, 8) ? ref : 0;
    }
};

// These offsets come from Old's GetNearestHiddenCoord and005b0fb0, rather
// than the newer Windows map layout. Cells are24bytes with explored mask+4.
template <class Ops> struct OldExploredMap {
    Ops &ops;
    std::uint32_t cells = 0, stride = 0;
    MajestyMapQuery::View view{};
    explicit OldExploredMap(Ops &input) : ops(input) {
        const auto root = ops.read(0x0071c68cU);
        if (!ops.valid(root, 0x14))
            return;
        const auto world = ops.read(root + 0x10);
        if (!ops.valid(world, 0x84))
            return;
        const auto map = ops.read(world + 0x80);
        if (!ops.valid(map, 0x50))
            return;
        const auto width = NativeSignedInteger(ops.read(map + 0x30));
        const auto height = NativeSignedInteger(ops.read(map + 0x34));
        stride = ops.read(map + 0x38);
        const auto rows = ops.read(map + 0x3c);
        cells = ops.read(map + 0x4c);
        if (width <= 0 || height <= 0 || stride < static_cast<unsigned>(width) ||
            rows < static_cast<unsigned>(height) || !rows || stride > UINT32_MAX / 24 / rows)
            return;
        const auto bytes = stride * rows * 24;
        if (!ops.valid(cells, static_cast<std::uint32_t>(bytes)))
            return;
        view = {this, mask, width, height};
        if (!MajestyMapQuery::Valid(view))
            view = {};
    }
    static std::uint32_t mask(const void *context, int x, int y) {
        const auto &self = *static_cast<const OldExploredMap *>(context);
        return self.ops.read(self.cells + (static_cast<unsigned>(y) * self.stride + x) * 24 + 4);
    }
};

template <class Ops>
int MovementDescriptorRate(Ops &ops, std::uint32_t descriptor, std::uint32_t unit = 0,
                           int mode = 0) {
    using namespace MajestyMovement;
    if (!ops.valid(descriptor, 0x18) || ops.read(descriptor + 8) != 1)
        return kUnsupported;
    const auto engine = ops.read(descriptor + 0x14);
    if (!ops.valid(engine, 0x14) || ops.read(engine) != 0x0068b250U)
        return kUnsupported;
    const auto clock = ops.read(0x0071c634U);
    if (!ops.valid(clock, 0x24))
        return kInvalidData;
    const auto quantum = NativeSignedInteger(ops.read(clock + 0x20));
    if (quantum <= 0 || quantum > 32767)
        return kInvalidData;
    const auto base = NativeSignedInteger(ops.read(engine + 0x0c));
    auto interval = NormalInterval(base, quantum);
    const auto distance = NativeSignedInteger(ops.read(engine + 0x10));
    if (mode == 1) {
        const auto modifier = ops.attribute(unit, 0x22565041U);
        const auto sum = std::int64_t(base) + modifier;
        if (sum < (std::numeric_limits<int>::min)() ||
            sum > (std::numeric_limits<int>::max)() - quantum / 2)
            return kInvalidData;
        interval = ops.interval(unit);
    }
    const auto rate = Rate(distance, interval);
    if (mode != 1 || rate < 0)
        return rate;
    return ops.distance(unit, distance << 11) / interval;
}

template <class Ops> bool ExecuteWorldQuery(Ops &ops, WorldQuery query, std::uint32_t context) {
    WorldQueryArguments args;
    if (!args.read(ops, context))
        return false;
    const auto finish = [&](int value) {
        ops.write(args.integers[0], static_cast<std::uint32_t>(value));
        return true;
    };
    const auto integer = [&](unsigned index) {
        return NativeSignedInteger(ops.read(args.integers[index]));
    };
    if (query == WorldQuery::Fog || query == WorldQuery::Frontier) {
        const bool frontier = query == WorldQuery::Frontier;
        if (args.count != (frontier ? 6U : 3U) || !args.integers[1])
            return finish(-1);
        const auto origin = args.point(ops, 2);
        if (!origin)
            return finish(-1);
        // Consume caller inputs before touching possibly aliased in/out slots.
        const auto player = integer(1);
        const MajestyMapQuery::Coordinate point{NativeSignedInteger(ops.read(origin)),
                                                NativeSignedInteger(ops.read(origin + 4))};
        OldExploredMap<Ops> map(ops);
        if (!frontier)
            return finish(MajestyMapQuery::FogAt(map.view, player, point));
        const auto output = args.point(ops, 5);
        if (!args.integers[3] || !args.integers[4] || !output)
            return finish(-1);
        auto cursor = integer(3);
        const auto budget = integer(4);
        MajestyMapQuery::Coordinate destination;
        const auto status =
            MajestyMapQuery::NextFrontier(map.view, player, point, cursor, budget, destination);
        if (status != MajestyMapQuery::SearchStatus::Invalid)
            ops.write(args.integers[3], static_cast<std::uint32_t>(cursor));
        if (status == MajestyMapQuery::SearchStatus::Found) {
            ops.write(output, static_cast<std::uint32_t>(destination.x));
            ops.write(output + 4, static_cast<std::uint32_t>(destination.y));
        }
        return finish(static_cast<int>(status));
    }
    if (query == WorldQuery::UnitMovement) {
        if (args.count != 3 || ops.read(args.values[1] + 4) != 5 || !args.integers[2])
            return finish(MajestyMovement::kInvalid);
        const auto mode = integer(2);
        if (mode != 0 && mode != 1)
            return finish(MajestyMovement::kInvalid);
        const auto unit = ops.unit(args.values[1]);
        if (!ops.valid(unit, 0x48))
            return finish(MajestyMovement::kInvalid);
        const auto table = ops.read(unit);
        if (!ops.valid(table + 0x158, 4) || ops.read(table + 0x158) != 0x00430770U)
            return finish(MajestyMovement::kUnsupported);
        return finish(MovementDescriptorRate(ops, ops.read(unit + 0x44), unit, mode));
    }
    if (args.count != 2 || ops.read(args.values[1] + 4) != 3)
        return finish(MajestyMovement::kInvalid);
    const auto descriptor = ops.unitType(args.values[1]);
    if (!ops.valid(descriptor, 0x18))
        return finish(MajestyMovement::kInvalid);
    const auto subtype = ops.read(descriptor + 8);
    if (subtype < 1 || subtype > 3)
        return finish(MajestyMovement::kUnsupported);
    const auto engine = ops.read(descriptor + 0x14);
    // Old005a1920 locates eight movement slots at engine+B8, stride12.
    if (!ops.valid(engine, 0xb8 + 8 * 12))
        return finish(MajestyMovement::kUnsupported);
    for (unsigned i = 0; i < 8; ++i)
        if (ops.read(engine + 0xb8 + i * 12) == 1)
            return finish(MovementDescriptorRate(ops, ops.read(engine + 0xb8 + i * 12 + 8)));
    return finish(MajestyMovement::kUnsupported);
}
} // namespace MajestyCommunity
