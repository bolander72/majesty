#pragma once
#include <cstdint>
#include <map>

namespace MajestyCommunity {
struct PrivateDispatch {
    std::uint32_t original = 0, table = 0;
    std::uint64_t generation = 0;
};

// Only private AP69 instances receive these two ABI-compatible entry bridges.
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
        const auto table = ops.allocate(44);
        if (!table)
            return false;
        for (unsigned i = 0; i < 11; ++i)
            ops.write(table + i * 4, ops.read(original + i * 4));
        ops.write(table + 12, controlBridge);
        ops.write(table + 32, eventBridge);
        instances.emplace(controller, PrivateDispatch{original, table, generation});
        ops.write(controller, table);
        return true;
    }
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
