#pragma once
#include "StockControllerRegistry.h"
#include <cstdint>
#include <map>
#include <utility>
#include <vector>

namespace MajestyCommunity {
// Native AP99 owns these five-dword descriptors after insertion. Clone the
// authored stock template, changing only the declared level, price and
// completion attribute. Never replace an occupied stock/private identity.
class ResearchDescriptors {
    std::map<std::uint32_t, std::uint32_t> owned;

  public:
    template <class Ops>
    bool prepare(Ops &ops, const std::vector<MajestyStockControllers::ResearchRowRecord> &rows) {
        bool absent = true, registered = true;
        for (const auto &row : rows) {
            const auto existing = ops.lookup(row.actionControlId);
            const auto found = owned.find(row.actionControlId);
            absent = absent && !existing;
            registered =
                registered && existing && found != owned.end() && found->second == existing;
        }
        if (registered)
            return true;
        if (!absent)
            return false;
        std::map<std::uint32_t, std::uint32_t> pending;
        for (const auto &row : rows) {
            const auto source = ops.lookup(row.descriptorTemplateControlId);
            const auto completion = ops.lookup(row.completionTemplateControlId);
            if (!source || !completion || !ops.read(completion + 16)) {
                for (const auto &[key, descriptor] : pending)
                    ops.release(descriptor);
                return false;
            }
            const auto clone = ops.allocate(20);
            if (!clone) {
                for (const auto &[key, descriptor] : pending)
                    ops.release(descriptor);
                return false;
            }
            for (unsigned i = 0; i < 5; ++i)
                ops.write(clone + i * 4, ops.read(source + i * 4));
            ops.write(clone + 4, row.requiredLevel);
            ops.write(clone + 8, row.price);
            ops.write(clone + 16, ops.read(completion + 16));
            pending.emplace(row.actionControlId, clone);
        }
        for (const auto &[key, descriptor] : pending)
            if (!ops.insert(key, descriptor))
                return false;
        owned = std::move(pending);
        return true;
    }
};
} // namespace MajestyCommunity
