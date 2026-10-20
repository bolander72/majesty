#pragma once
#include <array>
#include <cstdint>

namespace MajestyCommunity {

// The shared Healer AI queries Northern's Harm Undead spell in original
// campaigns too. A missing action cannot be available; a defined action must
// retain the native level/cooldown checks. Do not hide unrelated missing names.
class OptionalExpansionSpells {
    std::uint32_t catalog_ = 0;
    bool checked_ = false, present_ = false;

  public:
    void reset() {
        catalog_ = 0;
        checked_ = present_ = false;
    }
    template <class Ops> bool absent(Ops &ops, std::uint32_t context) {
        if (!ops.valid(context, 12))
            return false;
        const auto begin = ops.read(context + 4), end = ops.read(context + 8);
        if (!begin || (begin & 3) || end < begin || (end - begin != 12 && end - begin != 16) ||
            !ops.valid(begin, end - begin))
            return false;
        const unsigned count = (end - begin) / 4;
        std::array<std::uint32_t, 4> values{};
        for (unsigned i = 0; i < count; ++i) {
            const auto reference = ops.read(begin + 4 * i);
            if (!ops.valid(reference, 4))
                return false;
            values[i] = ops.read(reference);
            if (!ops.valid(values[i], 12))
                return false;
        }
        if (ops.read(values[0] + 4) != 6 || ops.read(values[1] + 4) != 5 ||
            ops.read(values[2] + 4) != 3 || (count == 4 && ops.read(values[3] + 4) != 1))
            return false;
        const auto name = ops.reference(values[2], 0x30);
        if (!ops.valid(name, 12))
            return false;
        const auto chars = ops.read(name), length = ops.read(name + 8);
        constexpr char expected[] = "turn_undead_healer";
        if (length != sizeof(expected) - 1 || !ops.valid(chars, length))
            return false;
        for (unsigned i = 0; i < length; ++i) {
            unsigned ch = ops.byte(chars + i);
            if (ch >= 'A' && ch <= 'Z')
                ch += 'a' - 'A';
            if (ch != static_cast<unsigned>(expected[i]))
                return false;
        }
        const auto catalog = ops.catalog();
        if (!catalog)
            return false;
        // The native description catalog is immutable within a world. Reset
        // at registration/teardown as well, since its address can be reused.
        if (catalog != catalog_) {
            reset();
            catalog_ = catalog;
        }
        if (!checked_) {
            present_ = ops.find(catalog, chars) != 0;
            checked_ = true;
        }
        if (present_)
            return false;
        ops.resetBoolean(values[0]);
        return true;
    }
};
} // namespace MajestyCommunity
