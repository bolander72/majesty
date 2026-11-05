#pragma once
#include "gpl_integer_helpers.h"

namespace MajestyCommunity {
enum class BaseTimingHelper { Action, Movement };

// Exact Old native layouts, proved by the original constructors/getters.
// Read base periods only: no attribute modifiers, rounding or order changes.
template <class Ops>
bool ExecuteBaseTimingHelper(Ops &ops, BaseTimingHelper helper, std::uint32_t context) {
    NativeIntegerArguments arguments;
    if (!arguments.read(ops, context))
        return false;
    const auto finish = [&](int value) {
        ops.write(arguments.integers[0], static_cast<std::uint32_t>(value));
        return true;
    };
    const auto value = arguments.values[1];
    if (!value || ops.read(value + 4) != (helper == BaseTimingHelper::Action ? 3U : 5U))
        return finish(MajestyNativeTiming::kInvalid);
    std::uint32_t description = 0;
    if (helper == BaseTimingHelper::Action) {
        description = ops.action(value);
        if (!description)
            return finish(MajestyNativeTiming::kInvalid);
    } else {
        const auto unit = ops.unit(value);
        if (!unit || !ops.valid(unit, 0x48))
            return finish(MajestyNativeTiming::kInvalid);
        const auto table = ops.read(unit);
        if (!ops.valid(table + 0x158, 4) || ops.read(table + 0x158) != 0x00430770U)
            return finish(MajestyNativeTiming::kUnsupported);
        description = ops.read(unit + 0x44);
    }
    if (!ops.valid(description, 0x18) || ops.read(description + 8) != 1)
        return finish(MajestyNativeTiming::kUnsupported);
    const auto engine = ops.read(description + 0x14);
    const auto offset = helper == BaseTimingHelper::Action ? 0x28U : 0x0cU;
    const auto expected = helper == BaseTimingHelper::Action ? 0x006898dcU : 0x0068b250U;
    if (!ops.valid(engine, offset + 4) || ops.read(engine) != expected)
        return finish(MajestyNativeTiming::kUnsupported);
    const auto period = ops.read(engine + offset);
    return finish(period > 0x7fffffffU ? MajestyNativeTiming::kUnsupported
                                       : static_cast<int>(period));
}
} // namespace MajestyCommunity
