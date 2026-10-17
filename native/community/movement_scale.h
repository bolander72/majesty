#pragma once
#include <cstdint>
#include <limits>

namespace MajestyCommunity {
// Old's +20 scalar is reused by position assembly at005b771c. The +18
// temporary is dead after the step-load site through every return path.
constexpr std::uint32_t kMovementScalarTemporary = 0x18;
// Match the creator's distance adapter: read the live overlay list for each
// update, add distinct percentages, and leave the cached native step alone.
template <class Ops, class Records>
int CurrentMovementStep(Ops &ops, std::uint32_t unit, int base, unsigned flags,
                        const Records &records) {
    if (!unit || base <= 0 || records.empty() || !ops.valid(unit, 0x98))
        return base;
    const auto descriptor = ops.read(unit + 0x44);
    if (!ops.valid(descriptor, 0x18) || !ops.read(unit + 0x94))
        return base;
    const auto engine = ops.read(descriptor + 0x14);
    if (!ops.valid(engine, 4) || ops.read(engine) != 0x0068b250U)
        return base;
    std::int64_t percent = 100;
    for (const auto &r : records)
        if (r.percent != 100 && ops.hasEffector(unit, r.overlayId))
            percent += static_cast<int>(r.percent) - 100;
    if (percent == 100)
        return base;
    const auto value = static_cast<std::int64_t>(base) * (percent > 0 ? percent : 1) / 100;
    const auto maximum = flags & 0x4000 ? 30720 : (std::numeric_limits<int>::max)();
    return value < 1 ? 1 : value > maximum ? maximum : static_cast<int>(value);
}
} // namespace MajestyCommunity
