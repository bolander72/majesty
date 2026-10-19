#pragma once
#include <array>
#include <cstdint>

namespace MajestyCommunity {

// The composed scripts query these Northern-only markers in original quests.
// An absent definition cannot affect an actor. All defined markers, unrelated
// names and malformed calls retain the original CheckEffector implementation.
class OptionalExpansionEffectors {
    struct Marker {
        const char *name;
        bool checked = false, present = false;
    };
    std::array<Marker, 5> markers_{{{"Champion_Icon"},
                                    {"Champions_Vigor_Icon"},
                                    {"Speed_Tonic_Icon"},
                                    {"Strength_Potion_Icon"},
                                    {"Shapeshift_Potion_Icon"}}};
    std::uint32_t catalog_ = 0;
    static unsigned lower(unsigned ch) {
        return ch >= 'A' && ch <= 'Z' ? ch + ('a' - 'A') : ch;
    }

  public:
    void reset() {
        catalog_ = 0;
        for (auto &marker : markers_)
            marker.checked = marker.present = false;
    }
    template <class Ops> bool absent(Ops &ops, std::uint32_t context) {
        if (!ops.valid(context, 12))
            return false;
        const auto begin = ops.read(context + 4), end = ops.read(context + 8);
        if (!begin || (begin & 3) || end < begin || end - begin != 12 || !ops.valid(begin, 12))
            return false;
        std::array<std::uint32_t, 3> values{};
        for (unsigned i = 0; i < values.size(); ++i) {
            const auto reference = ops.read(begin + 4 * i);
            if (!ops.valid(reference, 4))
                return false;
            values[i] = ops.read(reference);
            if (!ops.valid(values[i], 12))
                return false;
        }
        if (ops.read(values[0] + 4) != 6 || ops.read(values[1] + 4) != 5 ||
            ops.read(values[2] + 4) != 3)
            return false;
        const auto name = ops.reference(values[2], 0x30);
        if (!ops.valid(name, 12))
            return false;
        const auto chars = ops.read(name), length = ops.read(name + 8);
        if (length < 13 || length > 22 || !ops.valid(chars, length))
            return false;
        Marker *matched = nullptr;
        for (auto &marker : markers_) {
            unsigned size = 0;
            while (marker.name[size])
                ++size;
            if (size != length)
                continue;
            bool same = true;
            for (unsigned i = 0; i < size; ++i)
                if (lower(ops.byte(chars + i)) != lower(marker.name[i])) {
                    same = false;
                    break;
                }
            if (same) {
                matched = &marker;
                break;
            }
        }
        if (!matched)
            return false;
        const auto catalog = ops.catalog();
        if (!catalog)
            return false;
        // Definitions are immutable within a world. Registration/teardown
        // also resets the cache when a new catalog reuses the same address.
        if (catalog != catalog_) {
            reset();
            catalog_ = catalog;
        }
        if (!matched->checked) {
            matched->present = ops.find(catalog, chars) != 0;
            matched->checked = true;
        }
        if (matched->present)
            return false;
        ops.resetBoolean(values[0]);
        return true;
    }
};
} // namespace MajestyCommunity
