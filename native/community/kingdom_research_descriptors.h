#pragma once
#include "RuntimeFeatureRegistry.h"
#include <cstdint>
#include <map>
#include <set>
#include <vector>

namespace MajestyCommunity {
// Original AP99's five-word descriptor owns stock timing/notification fields.
// Kingdom research supplies its own completion mirror, unlike ordinary mod
// research rows that borrow a stock completion attribute.
class KingdomResearchDescriptors {
    std::map<std::uint32_t, std::uint32_t> owned_;

  public:
    template <class Ops>
    bool prepare(Ops &ops,
                 const std::vector<MajestyRuntimeFeatures::KingdomResearchRecord> &records) {
        std::set<std::uint32_t> commands;
        for (const auto &r : records) {
            if (!r.actionControlId || !r.descriptorTemplateControlId || !r.completionAttribute ||
                r.actionControlId == r.descriptorTemplateControlId || r.requiredLevel < 1 ||
                r.requiredLevel > 3 || !commands.insert(r.actionControlId).second)
                return false;
            const auto current = ops.lookup(r.actionControlId);
            const auto found = owned_.find(r.actionControlId);
            if (current) {
                if (found == owned_.end() || current != found->second ||
                    ops.read(current + 4) != r.requiredLevel || ops.read(current + 8) != r.price ||
                    ops.read(current + 16) != r.completionAttribute)
                    return false;
            } else if (found != owned_.end() || !ops.lookup(r.descriptorTemplateControlId)) {
                return false;
            }
        }
        std::map<std::uint32_t, std::uint32_t> pending;
        const auto discard = [&] {
            for (const auto &entry : pending)
                ops.release(entry.second);
        };
        for (const auto &r : records) {
            if (owned_.count(r.actionControlId))
                continue;
            const auto source = ops.lookup(r.descriptorTemplateControlId);
            const auto clone = ops.allocate(20);
            if (!clone) {
                discard();
                return false;
            }
            for (unsigned i = 0; i < 5; ++i)
                ops.write(clone + i * 4, ops.read(source + i * 4));
            ops.write(clone + 4, r.requiredLevel);
            ops.write(clone + 8, r.price);
            ops.write(clone + 16, r.completionAttribute);
            pending.emplace(r.actionControlId, clone);
        }
        for (auto at = pending.begin(); at != pending.end();) {
            const auto command = at->first, descriptor = at->second;
            if (!ops.insert(command, descriptor)) {
                discard();
                return false;
            }
            owned_.emplace(command, descriptor);
            at = pending.erase(at); // Native map now owns the published allocation.
        }
        return true;
    }
};
} // namespace MajestyCommunity
