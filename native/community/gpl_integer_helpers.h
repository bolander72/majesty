#pragma once
#include "EarnedRewards.h"
#include "NativeTiming.h"
#include <array>
#include <cstdint>
#include <cstring>

namespace MajestyCommunity {
enum class IntegerHelper { SimulationTime, SimulationElapsed, CapAdd, AwardBonus };

inline int NativeSignedInteger(std::uint32_t bits) {
    static_assert(sizeof(int) == sizeof(bits));
    int result;
    std::memcpy(&result, &bits, sizeof(result));
    return result;
}

// Old external-function argument vectors contain references, including the
// typed result at index zero. Keep mutable carry storage in the original VM.
struct NativeIntegerArguments {
    std::array<std::uint32_t, 4> values{};
    std::array<std::uint32_t, 4> integers{};
    unsigned count = 0;
    template <class Ops> bool read(Ops &ops, std::uint32_t context) {
        if (!ops.valid(context, 12))
            return false;
        const auto begin = ops.read(context + 4), end = ops.read(context + 8);
        if (!begin || (begin & 3) || end < begin || (end - begin) % 4 || end - begin < 4 ||
            end - begin > 16 || !ops.valid(begin, end - begin))
            return false;
        count = (end - begin) / 4;
        for (unsigned i = 0; i < count; ++i) {
            const auto reference = ops.read(begin + i * 4);
            if (!ops.valid(reference, 4))
                return false;
            const auto value = ops.read(reference);
            if (!ops.valid(value, 8))
                return false;
            values[i] = value;
            if (ops.read(value + 4) == 1) {
                integers[i] = ops.integer(value);
                if (integers[i] && !ops.valid(integers[i], 4))
                    return false;
            }
        }
        return integers[0] != 0;
    }
};

template <class Ops>
bool ExecuteIntegerHelper(Ops &ops, IntegerHelper helper, std::uint32_t context) {
    NativeIntegerArguments arguments;
    if (!arguments.read(ops, context))
        return false;
    const auto result = arguments.integers[0];
    const auto input = [&](unsigned index) {
        return arguments.integers[index] ? NativeSignedInteger(ops.read(arguments.integers[index]))
                                         : 0;
    };
    // Consume inputs before writing an aliased result, as in the creator's
    // original native helpers. No GPL Q22.10 arithmetic touches these values.
    switch (helper) {
    case IntegerHelper::SimulationTime:
        ops.write(result, ops.now());
        return true;
    case IntegerHelper::SimulationElapsed: {
        const auto started = input(1);
        const auto elapsed =
            arguments.integers[1]
                ? MajestyNativeTiming::Elapsed(ops.now(), static_cast<std::uint32_t>(started))
                : MajestyNativeTiming::kInvalid;
        ops.write(result, static_cast<std::uint32_t>(elapsed));
        return true;
    }
    case IntegerHelper::CapAdd: {
        const auto base = input(1), bonus = input(2);
        ops.write(result, static_cast<std::uint32_t>(MajestyEarnedRewards::CapAdd(base, bonus)));
        return true;
    }
    case IntegerHelper::AwardBonus: {
        const auto base = input(1), percent = input(2);
        const auto carry = arguments.integers[3];
        if (!arguments.integers[1] || !arguments.integers[2] || !carry || result == carry) {
            ops.write(result, 0);
            return true;
        }
        int remainder = input(3);
        const auto bonus = MajestyEarnedRewards::Bonus(base, percent, remainder);
        ops.write(carry, static_cast<std::uint32_t>(remainder));
        ops.write(result, static_cast<std::uint32_t>(bonus));
        return true;
    }
    }
    return false;
}
} // namespace MajestyCommunity
