#pragma once
#include <array>
#include <cstdint>
#include <map>

namespace MajestyCommunity {
struct PrivateDispatch {
    std::uint32_t original = 0, table = 0;
    std::uint64_t generation = 0;
    unsigned entries = 0;
};

// Only private instances receive these two ABI-compatible entry bridges.
// The original methods still implement commands/events; no global stock table
// or generated hook-eligibility metadata is changed.
class PrivateControllerDispatch {
    std::map<std::uint32_t, PrivateDispatch> instances;

  public:
    static constexpr std::uint32_t controlBridge = 0x00465f00U; // original RET4 entry
    static constexpr std::uint32_t eventBridge = 0x00466110U;   // original RET16 entry
    template <class Ops>
    bool install(Ops &ops, std::uint32_t controller, std::uint64_t generation) {
        if (!controller || !generation || instances.count(controller))
            return false;
        const auto original = ops.read(controller);
        if (!original || ops.read(original) != 0x0047a360U ||
            ops.read(original + 4) != 0x0047a760U || ops.read(original + 12) != 0x0047a790U ||
            ops.read(original + 32) != 0x0047aae0U)
            return false;
        return clone(ops, controller, generation, original, 11);
    }
    // The pinned DirectDraw AP52 has 17 slots, not AP69's 11. Retain every
    // native presenter/destructor; only command/event entry ownership changes.
    // Verified against Old.exe SHA654365fd at vtable 00682050 (68 bytes).
    // This primitive does not qualify the three-choice presenters or enable
    // their runtime hooks. Callers must provide those before using this class.
    static constexpr std::array<std::uint32_t, 17> recruitmentVtable = {
        0x0047e650U, 0x0047f1b0U, 0x0047f270U, 0x0047f3e0U, 0x004641f0U, 0x00464200U,
        0x0047c7b0U, 0x0047c480U, 0x0047f530U, 0x0047c060U, 0x0047c4e0U, 0x00464630U,
        0x004646e0U, 0x0047e9c0U, 0x0047f640U, 0x004654e0U, 0x0047e680U};
    template <class Ops>
    bool installRecruitment(Ops &ops, std::uint32_t controller, std::uint64_t generation) {
        if (!controller || !generation || instances.count(controller))
            return false;
        const auto original = ops.read(controller);
        if (!original)
            return false;
        for (unsigned i = 0; i < recruitmentVtable.size(); ++i)
            if (ops.read(original + i * 4) != recruitmentVtable[i])
                return false;
        return clone(ops, controller, generation, original, recruitmentVtable.size());
    }

  private:
    template <class Ops>
    bool clone(Ops &ops, std::uint32_t controller, std::uint64_t generation, std::uint32_t original,
               unsigned entries) {
        const auto table = ops.allocate(entries * 4);
        if (!table)
            return false;
        for (unsigned i = 0; i < entries; ++i)
            ops.write(table + i * 4, ops.read(original + i * 4));
        ops.write(table + 12, controlBridge);
        ops.write(table + 32, eventBridge);
        instances.emplace(controller, PrivateDispatch{original, table, generation, entries});
        ops.write(controller, table);
        return true;
    }

  public:
    PrivateDispatch find(std::uint32_t controller) const {
        const auto found = instances.find(controller);
        return found == instances.end() ? PrivateDispatch{} : found->second;
    }
    template <class Ops>
    void destroyed(Ops &ops, std::uint32_t controller, std::uint64_t generation) {
        const auto found = instances.find(controller);
        if (found == instances.end() || found->second.generation != generation)
            return;
        ops.release(found->second.table);
        instances.erase(found);
    }
    template <class Ops> void clear(Ops &ops) {
        for (const auto &[controller, entry] : instances) {
            if (ops.read(controller) == entry.table)
                ops.write(controller, entry.original);
            ops.release(entry.table);
        }
        instances.clear();
    }
};
} // namespace MajestyCommunity
