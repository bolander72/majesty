#pragma once
#include <cstdint>
#include <vector>

namespace MajestyCommunity {
// The legacy map picker treats every second-byte L actor as an unselectable
// effect. Only ALC1 needs this transient predicate identity. No descriptor,
// script type, profile or saved actor is renamed.
class MapSelectionIdentity {
    struct Entry {
        std::uint32_t unit, identity;
    };
    std::vector<Entry> entries;
    unsigned depth = 0;

  public:
    void enter() {
        ++depth;
    }
    template <class Ops> void character(Ops &ops, std::uint32_t unit, std::uint32_t returnPc) {
        if (!depth ||
            (returnPc != 0x0043e0e7U && returnPc != 0x0043e18cU && returnPc != 0x0043e3e3U &&
             returnPc != 0x0043eecdU && returnPc != 0x0043dde4U && returnPc != 0x0043de62U &&
             returnPc != 0x0043dee6U) ||
            ops.read(unit + 0x5c) != 1 || ops.read(unit + 0x6c) != 0x31434c41U ||
            ops.read(ops.read(unit + 0x80) + 4) != 0x31434c41U)
            return;
        entries.push_back({unit, ops.read(unit + 0x60)});
        ops.write(unit + 0x6c, 0x31435641U);
    }
    template <class Ops> bool restore(Ops &ops) {
        for (const auto &entry : entries) {
            if (ops.read(entry.unit + 0x60) != entry.identity ||
                ops.read(entry.unit + 0x6c) != 0x31435641U)
                return false;
            ops.write(entry.unit + 0x6c, 0x31434c41U);
        }
        entries.clear();
        return true;
    }
    template <class Ops> bool leave(Ops &ops) {
        return depth && (--depth || restore(ops));
    }
};
} // namespace MajestyCommunity
