#pragma once
#include "gpl_research_helpers.h"
#include "recruitment_panel_owner.h"
#include <array>
#include <map>

namespace MajestyCommunity {
// Gameplay state stays in original native orders and saved GPL attributes.
// Only the creator's two transient UI toggle caches live in this presenter.
class GuildGameplayServices {
    const MajestyStockControllers::Registry &recipes_;
    const std::vector<ResearchBinding> &research_;
    struct ToggleCache {
        std::uint32_t controller = 0, window = 0, identity = 0;
        std::uint64_t generation = 0;
        std::map<std::string, std::uint32_t> values;
    };
    std::array<ToggleCache, 2> cache_{};

    template <class Ops>
    const ResearchBinding *research(Ops &ops, std::uint32_t unit, std::uint32_t command) const {
        if (!unit || !ops.valid(unit, 0x70))
            return nullptr;
        const auto kind = ops.read(unit + 0x6c) & 0xffffffU;
        for (const auto &r : research_)
            if (r.nativeFamily == kind && r.record.actionControlId == command)
                return &r;
        return nullptr;
    }
    ToggleCache &cache(const RecruitmentPanelSession &s) {
        auto &entry = cache_[s.child ? 1 : 0];
        if (entry.controller != s.controller || entry.window != s.window ||
            entry.identity != s.identity || entry.generation != s.generation)
            entry = {s.controller, s.window, s.identity, s.generation, {}};
        return entry;
    }
    template <class Function>
    void toggles(const RecruitmentPanelSession &s, Function function) const {
        for (const auto &t : recipes_.buildingOpenToggles)
            if (t.parentDialogId == s.recipe->parentDialogId &&
                (s.child ? t.panelDialogId == s.dialog : t.panelDialogId == 0))
                function(t);
    }
    template <class Ops> void refreshToggles(Ops &ops, const RecruitmentPanelSession &s) {
        auto &values = cache(s).values;
        toggles(s, [&](const auto &t) {
            // These independent source toggles must never submit Embassy order16.
            ops.require(!t.stateAttribute.empty() && !t.stateAccessorSymbol.empty(),
                        "source-backed private hiring accessor");
            auto found = values.find(t.toggleKey);
            if (found == values.end()) {
                const auto value = ops.scalar(t.stateAccessorSymbol, s.unit, -1);
                ops.require(value <= 1, "saved private hiring state");
                found = values.emplace(t.toggleKey, value).first;
            }
            const bool open = found->second != 0;
            ops.visible(s, t.openCommandId, !open);
            ops.visible(s, t.closeCommandId, open);
            ops.message(s, open ? t.closeCommandId : t.openCommandId, 0x0a, 0, 0);
        });
    }

  public:
    GuildGameplayServices(const MajestyStockControllers::Registry &recipes,
                          const std::vector<ResearchBinding> &research)
        : recipes_(recipes), research_(research) {}
    void reset() {
        cache_ = {};
    }
    template <class Ops> bool busy(Ops &ops, std::uint32_t unit) const {
        return unit && research(ops, unit, ops.attribute(unit, 0x2c425041U));
    }
    template <class Ops>
    bool command(Ops &ops, const RecruitmentPanelSession &s, std::uint32_t command) {
        const auto *r = research(ops, s.unit, command);
        if (!r || s.child)
            return false;
        const auto state = ops.scalar(r->record.CallbackSymbol(), s.unit, 0);
        ops.require(state <= 3, "saved kingdom research status");
        if (state != 0 || ops.attribute(s.unit, 0x0d425041U) != 0)
            return true;
        ops.prepareResearch();
        if (ops.affordable(s.controller, command))
            ops.submit(s.unit, command);
        return true;
    }
    template <class Ops>
    std::uint32_t toggle(Ops &ops, const RecruitmentPanelSession &s, std::uint32_t command) {
        toggles(s, [&](const auto &t) {
            if (command != t.openCommandId && command != t.closeCommandId)
                return;
            ops.require(!t.stateAttribute.empty() && !t.stateAccessorSymbol.empty(),
                        "source-backed hiring command");
            const auto value =
                ops.scalar(t.stateAccessorSymbol, s.unit, command == t.openCommandId ? 1 : 0);
            ops.require(value <= 1, "saved hiring command result");
            cache(s).values[t.toggleKey] = value;
        });
        refreshToggles(ops, s);
        return 0;
    }
    template <class Ops> void extras(Ops &ops, const RecruitmentPanelSession &s) {
        refreshToggles(ops, s);
        if (s.child)
            return;
        for (const auto &r : research_) {
            if (!ops.valid(s.unit, 0x70) || (ops.read(s.unit + 0x6c) & 0xffffffU) != r.nativeFamily)
                continue;
            ops.prepareResearch();
            const auto state = ops.scalar(r.record.CallbackSymbol(), s.unit, 0);
            ops.require(state <= 3, "kingdom research presenter status");
            const auto stage = ops.read(s.unit + 0x6c) >> 24;
            const bool offered = stage >= '0' + r.record.requiredLevel && stage <= '3' &&
                                 ops.attribute(s.unit, 0x01425041U) == 1 &&
                                 ops.attribute(s.unit, 0x02425041U) == 1;
            const auto duration = ops.attribute(s.unit, 0x0d425041U);
            const bool active = research(ops, s.unit, ops.attribute(s.unit, 0x2c425041U)) == &r &&
                                NativeSignedInteger(duration) > 0;
            ops.rawAttribute(s.unit, r.record.completionAttribute, state == 1 ? 1 : 0);
            ops.refreshResearch(s, r.record.actionControlId);
            ops.visible(s, r.record.actionControlId, offered && !active);
            ops.visible(s, r.record.actionControlId + 500, offered);
            ops.visible(s, r.record.actionControlId + 1000, offered && !active && state != 1);
            ops.visible(s, r.record.progressControlId, active);
            ops.visible(s, r.record.activeDisplayControlId, active);
            if (state != 0 || duration != 0)
                ops.message(s, r.record.actionControlId, 0x0a, 1, 0);
            if (active) {
                const auto started = ops.attribute(s.unit, 0x38425041U), now = ops.now();
                ops.progress(s, r.record.progressControlId, now > started ? now - started : 0,
                             duration);
            }
        }
    }
};
} // namespace MajestyCommunity
