#pragma once
#include "StockControllerRegistry.h"
#include <array>
#include <cstdint>
#include <limits>
#include <map>
#include <vector>

namespace MajestyCommunity {
constexpr std::uint32_t NativeFourCC(const char (&text)[5]) {
    return static_cast<unsigned char>(text[0]) | (static_cast<unsigned char>(text[1]) << 8U) |
           (static_cast<unsigned char>(text[2]) << 16U) |
           (static_cast<unsigned char>(text[3]) << 24U);
}
struct ExpansionControllerProfile {
    std::uint32_t selector, vtable, entries;
    std::array<std::uint32_t, 15> methods;
};
// Complete Old 1.5.1.2 tables, independently traced from its factory and
// constructors. AP08 is 0046b340/006816b4; AP80 is a different stock class.
inline constexpr std::array<ExpansionControllerProfile, 4> expansionControllerProfiles{{
    {NativeFourCC("AP08"),
     0x006816b4U,
     13,
     {0x0046b360U, 0x0046b610U, 0x00466c80U, 0x0046b640U, 0x004641f0U, 0x00464200U, 0x0047c7b0U,
      0x0047c480U, 0x0046b880U, 0x0047c060U, 0x0047c4e0U, 0x00464630U, 0x004646e0U}},
    {NativeFourCC("MX09"),
     0x006828f8U,
     13,
     {0x004904d0U, 0x00490500U, 0x00464ab0U, 0x00490510U, 0x004641f0U, 0x00464200U, 0x0047c7b0U,
      0x00490540U, 0x00490520U, 0x0047c060U, 0x0047c4e0U, 0x00464630U, 0x004646e0U}},
    {NativeFourCC("AP41"),
     0x00681cf8U,
     11,
     {0x004763b0U, 0x004763e0U, 0x00481e20U, 0x00476510U, 0x004641f0U, 0x00464200U, 0x0047c7b0U,
      0x0047c480U, 0x00476700U, 0x0047c060U, 0x0047c4e0U}},
    {NativeFourCC("MX05"),
     0x006827e0U,
     15,
     {0x0048ece0U, 0x0048ef90U, 0x00468110U, 0x0048ef00U, 0x004641f0U, 0x00464200U, 0x0047c7b0U,
      0x0048ed10U, 0x0048ed30U, 0x0047c060U, 0x0047c4e0U, 0x0048f090U, 0x004670e0U, 0x004670f0U,
      0x0048f070U}},
}};
enum class ExpansionPanelKind { None, Guild, Zoo, Rewards, Occupants, QuestRecords };
struct ExpansionPanelPlan {
    ExpansionPanelKind kind = ExpansionPanelKind::None;
    const ExpansionControllerProfile *profile = nullptr;
    std::uint32_t parentDialog = 0, family = 0;
    bool child() const {
        return kind == ExpansionPanelKind::Rewards || kind == ExpansionPanelKind::Occupants ||
               kind == ExpansionPanelKind::QuestRecords;
    }
};
struct ExpansionPanelSession {
    ExpansionPanelPlan plan;
    std::uint32_t controller = 0, dialog = 0, window = 0, context = 0;
    std::uint32_t unit = 0, identity = 0, original = 0, table = 0;
    std::uint64_t generation = 0;
};
enum class ExpansionPanelEntry : unsigned { Destroy, Setup, Control, Event, Refresh };
constexpr unsigned expansionPanelEntryCount = 5;

// UI ownership only. Original actors, GPL ledgers and queued commands remain
// authoritative. A child keeps its own native parent-unit handle; no global
// "currently selected building" survives an intervening panel transition.
class ExpansionPanelOwner {
    const MajestyStockControllers::Registry &registry;
    std::map<std::uint32_t, ExpansionPanelSession> sessions;
    std::uint64_t generation = 0;

  public:
    explicit ExpansionPanelOwner(const MajestyStockControllers::Registry &value)
        : registry(value) {}
    ExpansionPanelPlan plan(std::uint32_t dialog) const {
        constexpr auto guild = NativeFourCC("CGAG"), zoo = NativeFourCC("CGZM");
        constexpr auto guildFamily = NativeFourCC("ABv1") & 0xffffffU;
        constexpr auto zooFamily = NativeFourCC("ABw1") & 0xffffffU;
        if (const auto *row = registry.FindLiveAgentListByParent(dialog))
            if (dialog == guild && row->parentControllerBase == NativeFourCC("AP08") &&
                row->dataRecordRows && row->actionUsesParent)
                return {ExpansionPanelKind::Guild, &expansionControllerProfiles[0], guild,
                        guildFamily};
        if (dialog == zoo && registry.FindRewardPanelByParentDialog(dialog))
            if (const auto *row = registry.FindOccupantPanelByParent(dialog))
                if (row->parentControllerBase == NativeFourCC("MX09"))
                    return {ExpansionPanelKind::Zoo, &expansionControllerProfiles[1], zoo,
                            zooFamily};
        if (const auto *row = registry.FindRewardPanelByChildDialog(dialog))
            if (row->parentDialogId == zoo)
                return {ExpansionPanelKind::Rewards, &expansionControllerProfiles[2], zoo,
                        zooFamily};
        if (const auto *row = registry.FindOccupantPanelByChild(dialog))
            if (row->parentDialogId == zoo && row->parentControllerBase == NativeFourCC("MX09"))
                return {ExpansionPanelKind::Occupants, &expansionControllerProfiles[3], zoo,
                        zooFamily};
        if (const auto *row = registry.FindLiveAgentListByChild(dialog))
            if (row->parentDialogId == guild && row->parentControllerBase == NativeFourCC("AP08") &&
                row->dataRecordRows && row->actionUsesParent && row->stayOnPanelAfterAction &&
                !row->focusSelectedRowOnClick)
                return {ExpansionPanelKind::QuestRecords, &expansionControllerProfiles[3], guild,
                        guildFamily};
        return {};
    }
    std::uint32_t selector(std::uint32_t requested) const {
        const auto selected = plan(requested);
        return selected.profile ? selected.profile->selector : requested;
    }
    ExpansionPanelSession find(std::uint32_t controller) const {
        const auto found = sessions.find(controller);
        return found == sessions.end() ? ExpansionPanelSession{} : found->second;
    }
    std::vector<ExpansionPanelSession> forUnit(std::uint32_t unit) const {
        std::vector<ExpansionPanelSession> result;
        for (const auto &entry : sessions)
            if (entry.second.unit == unit)
                result.push_back(entry.second);
        return result;
    }
    template <class Ops> bool alive(Ops &ops, const ExpansionPanelSession &s) const {
        if (!s.plan.profile || find(s.controller).generation != s.generation ||
            !ops.valid(s.controller, 36) || ops.read(s.controller) != s.table ||
            ops.read(s.controller + 0x14) != s.window ||
            ops.read(s.controller + 0x18) != s.context ||
            ops.read(s.controller + 0x1c) != s.identity || ops.unit(s.controller) != s.unit ||
            !ops.valid(s.unit, 0x84) || ops.read(s.unit + 0x60) != s.identity ||
            (ops.read(s.unit + 0x6c) & 0xffffffU) != s.plan.family)
            return false;
        const auto descriptor = ops.read(s.unit + 0x80);
        return ops.valid(descriptor, 8) && (ops.read(descriptor + 4) & 0xffffffU) == s.plan.family;
    }
    template <class Ops>
    bool attach(Ops &ops, std::uint32_t controller, std::uint32_t dialog, std::uint32_t window,
                std::uint32_t expectedUnit,
                const std::array<std::uint32_t, expansionPanelEntryCount> &bridges,
                std::uint32_t recordPopulate = 0) {
        const auto selected = plan(dialog);
        if (!selected.profile ||
            (selected.kind == ExpansionPanelKind::QuestRecords && !recordPopulate) || !controller ||
            !window || !expectedUnit || sessions.count(controller) || sessions.size() >= 16 ||
            generation == std::numeric_limits<std::uint64_t>::max() || !ops.valid(controller, 36) ||
            ops.read(controller + 0x14) != window)
            return false;
        for (const auto address : bridges)
            if (!address)
                return false;
        const auto original = ops.read(controller), unit = ops.unit(controller);
        const auto &profile = *selected.profile;
        if (original != profile.vtable || !ops.valid(original, profile.entries * 4) ||
            unit != expectedUnit || !ops.valid(unit, 0x84) || !ops.read(unit + 0x60) ||
            ops.read(controller + 0x1c) != ops.read(unit + 0x60) ||
            (ops.read(unit + 0x6c) & 0xffffffU) != selected.family)
            return false;
        for (unsigned i = 0; i < profile.entries; ++i)
            if (ops.read(original + i * 4) != profile.methods[i])
                return false;
        const auto descriptor = ops.read(unit + 0x80);
        if (!ops.valid(descriptor, 8) || (ops.read(descriptor + 4) & 0xffffffU) != selected.family)
            return false;
        const auto table = ops.allocate(profile.entries * 4);
        if (!table)
            return false;
        for (unsigned i = 0; i < profile.entries; ++i)
            ops.write(table + i * 4, profile.methods[i]);
        constexpr unsigned slots[] = {0, 1, 3, 8, 14};
        for (unsigned i = 0; i < expansionPanelEntryCount; ++i)
            if (slots[i] < profile.entries)
                ops.write(table + slots[i] * 4, bridges[i]);
        if (selected.kind == ExpansionPanelKind::QuestRecords)
            ops.write(table + 11 * 4, recordPopulate);
        sessions.emplace(controller, ExpansionPanelSession{selected, controller, dialog, window,
                                                           ops.read(controller + 0x18), unit,
                                                           ops.read(unit + 0x60), original, table,
                                                           ++generation});
        ops.write(controller, table);
        return true;
    }
    std::uint32_t child(const ExpansionPanelSession &s, std::uint32_t command) const {
        if (s.plan.child() || !s.plan.profile)
            return 0;
        if (const auto *row = registry.FindRewardPanelByParentDialog(s.dialog))
            if (row->openCommandId == command)
                return row->childDialogId;
        if (const auto *row = registry.FindOccupantPanelByParent(s.dialog))
            if (row->openCommandId == command)
                return row->childDialogId;
        if (const auto *row = registry.FindLiveAgentListByParent(s.dialog))
            if (row->openCommandId == command)
                return row->childDialogId;
        return 0;
    }
    template <class Ops>
    bool detach(Ops &ops, std::uint32_t controller, std::uint64_t expectedGeneration) {
        const auto found = sessions.find(controller);
        if (found == sessions.end() || found->second.generation != expectedGeneration)
            return false;
        const auto previous = found->second;
        sessions.erase(found); // Original destruction may reenter and create a successor.
        if (ops.valid(controller, 4) && ops.read(controller) == previous.table)
            ops.write(controller, previous.original);
        ops.release(previous.table);
        return true;
    }
    template <class Ops> void clear(Ops &ops) {
        while (!sessions.empty()) {
            const auto s = sessions.begin()->second;
            detach(ops, s.controller, s.generation);
        }
    }
};
} // namespace MajestyCommunity
