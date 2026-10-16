#pragma once
#include "controller_dispatch.h"
#include "private_template_bank.h"
#include "recruitment_commands.h"
#include <array>
#include <cstdint>
#include <limits>
#include <map>
#include <vector>

namespace MajestyCommunity {
enum class RecruitmentPanelEntry : unsigned {
    Destroy,
    Setup,
    Tooltip,
    Control,
    Event,
    Refresh,
    Counts
};
constexpr unsigned recruitmentPanelEntryCount = 7;

struct RecruitmentPanelSession {
    const MajestyStockControllers::PrivateRecruitmentRecord *recipe = nullptr;
    std::uint32_t controller = 0, dialog = 0, window = 0, context = 0;
    std::uint32_t unit = 0, identity = 0, family = 0, original = 0, table = 0;
    std::uint64_t generation = 0;
    bool child = false;
};

// Instance ownership for the creator's three-choice AP52 class. Ops implements
// the Old engine calls and the separately authored research/hiring features;
// no gameplay ledger, queue, gold, duration or hero state is stored here.
// Registry storage and the process-lifetime guest bridges outlive this owner.
class RecruitmentPanelOwner {
    const MajestyStockControllers::Registry &registry;
    std::map<std::uint32_t, RecruitmentPanelSession> sessions;
    std::uint64_t generation = 0;

  public:
    explicit RecruitmentPanelOwner(const MajestyStockControllers::Registry &value)
        : registry(value) {}
    std::uint32_t selector(std::uint32_t requested) const {
        return registry.FindPrivateRecruitmentByParent(requested) ||
                       registry.FindPrivateRecruitmentByChild(requested)
                   ? 0x32355041U // AP52 on both sides, including all 17 slots
                   : requested;
    }
    RecruitmentPanelSession find(std::uint32_t controller) const {
        const auto found = sessions.find(controller);
        return found == sessions.end() ? RecruitmentPanelSession{} : found->second;
    }
    std::vector<RecruitmentPanelSession> forUnit(std::uint32_t unit) const {
        std::vector<RecruitmentPanelSession> result;
        for (const auto &entry : sessions)
            if (entry.second.unit == unit)
                result.push_back(entry.second);
        return result;
    }
    template <class Ops> bool alive(Ops &ops, const RecruitmentPanelSession &s) const {
        const auto current = find(s.controller);
        if (!s.recipe || current.generation != s.generation || !ops.valid(s.controller, 36) ||
            ops.read(s.controller) != s.table || ops.read(s.controller + 0x14) != s.window ||
            ops.read(s.controller + 0x18) != s.context)
            return false;
        const auto unit = ops.unit(s.controller);
        if (unit != s.unit || !ops.valid(unit, 0x84) || ops.read(unit + 0x60) != s.identity)
            return false;
        const auto descriptor = ops.read(unit + 0x80);
        return descriptor && ops.valid(descriptor, 8) &&
               (ops.read(descriptor + 4) & 0xffffffU) == s.family;
    }
    template <class Ops>
    bool attach(Ops &ops, std::uint32_t controller, std::uint32_t dialog, std::uint32_t window,
                std::uint32_t context, std::uint32_t expectedFamily,
                const std::array<std::uint32_t, recruitmentPanelEntryCount> &bridges) {
        const auto *recipe = registry.FindPrivateRecruitmentByParent(dialog);
        const bool child = recipe == nullptr;
        if (!recipe)
            recipe = registry.FindPrivateRecruitmentByChild(dialog);
        // These literal presenters were translated with the acquired Bards
        // third-price binding. Refuse a new recipe until separately prepared.
        if (!recipe || recipe->thirdPriceControlId != 29441 || !controller || !window || !context ||
            !expectedFamily || expectedFamily > 0xffffffU ||
            generation == std::numeric_limits<std::uint64_t>::max() || sessions.count(controller) ||
            !ops.valid(controller, 36))
            return false;
        for (auto address : bridges)
            if (!address)
                return false;
        const auto original = ops.read(controller);
        if (!original || !ops.valid(original, 68) || ops.read(controller + 0x14) != window ||
            ops.read(controller + 0x18) != context)
            return false;
        for (unsigned i = 0; i < PrivateControllerDispatch::recruitmentVtable.size(); ++i)
            if (ops.read(original + i * 4) != PrivateControllerDispatch::recruitmentVtable[i])
                return false;
        const auto unit = ops.unit(controller);
        if (!unit || !ops.valid(unit, 0x84) || !ops.read(unit + 0x60))
            return false;
        const auto descriptor = ops.read(unit + 0x80);
        if (!descriptor || !ops.valid(descriptor, 8) ||
            (ops.read(descriptor + 4) & 0xffffffU) != expectedFamily)
            return false;
        const auto table = ops.allocate(68);
        if (!table)
            return false;
        for (unsigned i = 0; i < 17; ++i)
            ops.write(table + i * 4, ops.read(original + i * 4));
        constexpr unsigned slots[] = {0, 1, 2, 3, 8, 13, 16};
        for (unsigned i = 0; i < recruitmentPanelEntryCount; ++i)
            ops.write(table + slots[i] * 4, bridges[i]);
        sessions.emplace(controller,
                         RecruitmentPanelSession{recipe, controller, dialog, window, context, unit,
                                                 ops.read(unit + 0x60), expectedFamily, original,
                                                 table, ++generation, child});
        ops.write(controller, table);
        return true;
    }
    template <class Ops> void refresh(Ops &ops, std::uint32_t controller) {
        const auto s = find(controller);
        if (!alive(ops, s))
            return;
        if (!s.child && s.recipe->childDialogId) {
            for (auto id : {0x1f48U, 0x1389U, 0x1388U, 0x1752U, 0x1f51U, 0x1f56U, 0x1f57U,
                            s.recipe->thirdPriceControlId})
                ops.visible(s, id, false);
            return;
        }
        if (ops.researchBusy(s.unit)) {
            for (auto id : {0x1f48U, 0x1389U, 0x1388U})
                ops.disable(s, id);
            for (auto id : {0x1752U, 0x1f51U, s.recipe->thirdPriceControlId, 0x1f56U, 0x1f57U})
                ops.visible(s, id, false);
            return;
        }
        ops.present(s, PrivateTemplateBridge::RefreshAll);
    }
    template <class Ops> void counts(Ops &ops, std::uint32_t controller) {
        const auto s = find(controller);
        if (alive(ops, s) && !s.child)
            ops.present(s, PrivateTemplateBridge::Counts);
    }
    template <class Ops> void setup(Ops &ops, std::uint32_t controller) {
        const auto s = find(controller);
        if (!alive(ops, s))
            return;
        if (s.child)
            ops.write(controller + 0x20, 1); // Old AP69 classification, not modern +0x30
        ops.present(s, PrivateTemplateBridge::Setup);
        if (alive(ops, s))
            ops.extras(s);
    }
    template <class Ops>
    std::uint32_t control(Ops &ops, std::uint32_t controller, std::uint32_t command) {
        const auto s = find(controller);
        if (!alive(ops, s))
            return 0;
        const auto route = RouteRecruitmentCommand(registry, *s.recipe, s.dialog, command,
                                                   ops.researchBusy(s.unit));
        switch (route) {
        case RecruitmentCommand::Blocked:
            return 0;
        case RecruitmentCommand::OpenChild:
            return ops.openChild(s);
        case RecruitmentCommand::ReturnParent:
            return ops.returnParent(s);
        case RecruitmentCommand::Toggle:
            return ops.toggle(s, command);
        case RecruitmentCommand::Stock:
            break;
        }
        if (!s.child && ops.researchCommand(s, command))
            return 0;
        const auto result = ops.stockControl(s, command);
        if (alive(ops, s))
            ops.extras(s);
        return result;
    }
    template <class Ops>
    std::uint32_t tooltip(Ops &ops, std::uint32_t controller, std::uint32_t command,
                          std::uint32_t argument, std::uint32_t text) {
        const auto s = find(controller);
        if (!alive(ops, s))
            return 0;
        const bool busy = ops.researchBusy(s.unit);
        const auto route = RouteRecruitmentCommand(registry, *s.recipe, s.dialog, command, busy);
        if (route == RecruitmentCommand::Blocked)
            return 0;
        const auto index = RecruitmentIndex(command);
        return index < 3 ? ops.describe(s, index, command, argument, text)
                         : ops.stockTooltip(s, command, argument, text);
    }
    template <class Ops>
    void event(Ops &ops, std::uint32_t controller, const std::array<std::uint32_t, 4> &args) {
        const auto s = find(controller);
        if (!alive(ops, s))
            return;
        ops.nativeEvent(s, args);
        // Original notifications can delete a parent or replace its context.
        if (!alive(ops, s))
            return;
        if (args[2] == 0x00425041U) { // author's MaxGuildMembers correction
            refresh(ops, controller);
            if (!alive(ops, s))
                return;
            counts(ops, controller);
        }
        if (alive(ops, s))
            ops.extras(s);
    }
    template <class Ops>
    std::uint32_t destroy(Ops &ops, std::uint32_t controller, std::uint32_t flags) {
        const auto s = find(controller);
        if (!s.recipe || !ops.valid(controller, 36) || ops.read(controller) != s.table)
            return 0;
        // Retire ownership before the original scalar destructor can free and
        // recycle its address. The stock destructor sees its complete table.
        ops.write(controller, s.original);
        sessions.erase(controller);
        const auto result = ops.stockDestroy(s, flags);
        ops.release(s.table);
        return result;
    }
    // The content adapter calls this before original world disposal, while
    // guest allocations still exist. Do not retain pointers into a new world.
    template <class Ops> void clear(Ops &ops) {
        for (const auto &[controller, s] : sessions) {
            if (ops.valid(controller, 36) && ops.read(controller) == s.table &&
                ops.read(controller + 0x14) == s.window && ops.read(controller + 0x18) == s.context)
                ops.write(controller, s.original);
            ops.release(s.table);
        }
        sessions.clear();
    }
};
} // namespace MajestyCommunity
