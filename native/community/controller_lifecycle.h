#pragma once
#include "StockControllerRegistry.h"
#include <cstdint>
#include <map>

namespace MajestyCommunity {
struct PanelSession {
    const MajestyStockControllers::SecondaryPanelRecord *recipe = nullptr;
    std::uint32_t dialog = 0, window = 0, context = 0;
    std::uint64_t generation = 0;
    bool parent = false;
};

// Transient UI ownership only. Original game objects, attributes and saves
// remain the owners of all gameplay state; no modern controller layout is used.
class PanelLifecycle {
    const MajestyStockControllers::Registry &recipes;
    std::map<std::uint32_t, PanelSession> sessions;
    std::uint64_t generation = 0;

  public:
    explicit PanelLifecycle(const MajestyStockControllers::Registry &registry)
        : recipes(registry) {}
    std::uint32_t selector(std::uint32_t requested) const {
        if (recipes.FindPanelByParentDialog(requested))
            return 0x30315041U; // original AP10 factory class, private window preserved
        if (recipes.FindPanelByChildDialog(requested))
            return 0x39365041U; // original AP69 factory class, private window preserved
        return requested;
    }
    bool capture(std::uint32_t controller, std::uint32_t dialog, std::uint32_t window,
                 std::uint32_t context) {
        const auto *record = recipes.FindPanelByParentDialog(dialog);
        const bool parent = record != nullptr;
        if (!record)
            record = recipes.FindPanelByChildDialog(dialog);
        if (!record || !controller || !window || !context)
            return false;
        sessions[controller] = {record, dialog, window, context, ++generation, parent};
        return true;
    }
    PanelSession find(std::uint32_t controller) const {
        const auto found = sessions.find(controller);
        return found == sessions.end() ? PanelSession{} : found->second;
    }
    void destroyed(std::uint32_t controller, std::uint64_t expectedGeneration) {
        const auto found = sessions.find(controller);
        if (found != sessions.end() && found->second.generation == expectedGeneration)
            sessions.erase(found);
    }
    std::uint32_t child(std::uint32_t controller, std::uint32_t command,
                        std::uint32_t buildingFamily) const {
        const auto session = find(controller);
        if (!session.parent || !session.recipe || session.recipe->openCommandId != command ||
            session.recipe->buildingFamilyId != buildingFamily)
            return 0;
        return session.recipe->childDialogId;
    }
};
} // namespace MajestyCommunity
