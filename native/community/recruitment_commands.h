#pragma once
#include "StockControllerRegistry.h"
#include <cstdint>

namespace MajestyCommunity {
enum class RecruitmentCommand { Stock, Blocked, OpenChild, ReturnParent, Toggle };

// Preserve the creator's AP52 command/index contract and one native queue.
// Presentation and paid orders remain native; this policy only prevents hidden
// parent/child controls from taking input ownership. No live panel is enabled
// by this helper. The registry and referenced record must outlive the call.
inline unsigned RecruitmentIndex(std::uint32_t command) {
    return command == 0x1f48 ? 0U : command == 0x1389 ? 1U : command == 0x1388 ? 2U : 3U;
}

inline RecruitmentCommand
RouteRecruitmentCommand(const MajestyStockControllers::Registry &registry,
                        const MajestyStockControllers::PrivateRecruitmentRecord &recipe,
                        std::uint32_t dialog, std::uint32_t command, bool researchBusy) {
    const bool child = recipe.childDialogId && dialog == recipe.childDialogId;
    if (!child && dialog != recipe.parentDialogId)
        return RecruitmentCommand::Blocked;
    const bool recruit = RecruitmentIndex(command) < 3;
    if (recruit && (researchBusy || (!child && recipe.childDialogId)))
        return RecruitmentCommand::Blocked;
    if (child && command == 0x1f4d)
        return RecruitmentCommand::ReturnParent;
    if (!child && recipe.childDialogId && command == recipe.openCommandId)
        return RecruitmentCommand::OpenChild;
    for (const auto &toggle : registry.buildingOpenToggles)
        if (toggle.parentDialogId == recipe.parentDialogId &&
            (toggle.panelDialogId ? toggle.panelDialogId == dialog : !child) &&
            (command == toggle.openCommandId || command == toggle.closeCommandId))
            return RecruitmentCommand::Toggle;
    if (child)
        return recruit || command == 0x1f40 || command == 0x1f41 ? RecruitmentCommand::Stock
                                                                 : RecruitmentCommand::Blocked;
    // AP52 Call-to-Arms and alternate recruitment have no ownership in a
    // private three-choice guild, even if a hidden widget retains its hotkey.
    return command == 0x1f49 || command == 0x22ce ? RecruitmentCommand::Blocked
                                                  : RecruitmentCommand::Stock;
}
} // namespace MajestyCommunity
