#pragma once
#include "StockControllerRegistry.h"
#include <cstdint>
#include <string>

namespace MajestyCommunity {
// The creator's tier prerequisite adds one completion condition to the stock
// upgrade presenter/command. Native level, gold, health and upgrade mechanics
// retain authority after the research requirement has been satisfied.
template <class Ops>
bool UpgradeResearchComplete(Ops &ops, const MajestyStockControllers::Registry &registry,
                             const std::string &panel, std::uint32_t level, std::uint32_t unit) {
    for (const auto &gate : registry.upgradeGates) {
        if (gate.panelKey != panel)
            continue;
        if (!unit)
            return false;
        for (const auto &requirement : gate.requirements) {
            if (requirement.buildingLevel != level)
                continue;
            for (const auto &row : registry.researchRows) {
                if (row.panelKey != panel || row.recipeKey != requirement.recipeKey)
                    continue;
                const auto attribute =
                    ops.completionAttribute(row.actionControlId, row.completionTemplateControlId);
                return attribute && ops.complete(unit, attribute);
            }
            return false; // An unresolved declared recipe cannot allow a tier jump.
        }
    }
    return true;
}
} // namespace MajestyCommunity
