#pragma once
#include <cstdint>

namespace MajestyCommunity {
// Original research commands (00495900) serialize the unit identity at+60.
// The separate+70 field is the player number; zero is a valid local player.
template <class Ops> bool ResearchUnitHasIdentity(Ops &ops, std::uint32_t unit) {
    return unit && ops.read(unit + 0x84) && ops.read(unit + 0x60);
}

// Literal Old AP99 CanSubmitResearch (00474C10): use the game's original
// fixed-point helpers and live command-owner discount, then its current player
// gold. This routine is affordability only; row state/health/completion and
// queued-command validation remain separate native checks.
template <class Ops>
bool ResearchAffordable(Ops &ops, std::uint32_t controller, std::uint32_t descriptor) {
    const auto unit = ops.unit(controller);
    if (!unit || !descriptor)
        return false;
    const auto owner = ops.read(unit + 0x84);
    if (!owner)
        return false;
    const auto player = ops.call(ops.read(ops.read(owner) + 0x18), owner, {ops.read(unit + 0x70)});
    if (!player)
        return false;
    const auto discount = ops.call(0x0042cc50U, player, {0x00474241U, 0});
    const auto scale = ops.fixedScale();
    const auto discountFactor = ops.call(0x0051f2d0U, 0, {discount << 10, scale});
    const auto basePrice = ops.read(descriptor + 8) << 10;
    const auto reduction = ops.call(0x0051f2d0U, 0, {discountFactor, basePrice});
    const auto price = static_cast<std::int32_t>(basePrice - reduction) >> 10;
    const auto manager = ops.call(0x00415b40U, 0, {});
    const auto currentPlayer = ops.call(0x00416980U, manager, {});
    if (!currentPlayer)
        return false;
    const auto gold =
        ops.call(ops.read(ops.read(currentPlayer) + 0x20), currentPlayer, {0x00505041U});
    return static_cast<std::int32_t>(gold) >= price;
}

// AP10 recruitment and AP99 research share this original packed tuple.
// Keep research ownership separate, but let native submission and the literal
// completion callback supply its timing and completion; never predict a win
// from elapsed host time.
struct BuildingActivity {
    std::uint32_t command = 0, startedAt = 0, duration = 0;
};

class ResearchActivity {
  public:
    enum class Phase { Idle, Pending, Active };

  private:
    Phase phase_ = Phase::Idle;
    std::uint32_t unit_ = 0, command_ = 0;
    BuildingActivity submitted_;
    BuildingActivity pendingRecruitment_;

  public:
    Phase phase() const {
        return phase_;
    }
    std::uint32_t unit() const {
        return unit_;
    }
    std::uint32_t command() const {
        return command_;
    }
    const BuildingActivity &submitted() const {
        return submitted_;
    }
    bool begin(std::uint32_t unit, std::uint32_t command, BuildingActivity recruitment = {}) {
        if (phase_ != Phase::Idle || !unit || !command)
            return false;
        unit_ = unit;
        command_ = command;
        pendingRecruitment_ = recruitment;
        phase_ = Phase::Pending;
        return true;
    }
    template <class Ops> bool capture(Ops &ops, const BuildingActivity &recruitment) {
        if (phase_ != Phase::Pending)
            return false;
        const auto submitted = ops.capture(unit_);
        if (submitted.command != command_ || static_cast<std::int32_t>(submitted.duration) <= 0)
            return false;
        // The native command dispatcher can install research before the next
        // world-update hook. That tuple is not an AP10 recruitment order.
        ops.restore(unit_, recruitment.command == command_ ? pendingRecruitment_ : recruitment);
        submitted_ = submitted;
        phase_ = Phase::Active;
        return true;
    }
    template <class Ops, class NativeCompletion>
    bool complete(Ops &ops, std::uint32_t unit, std::uint32_t eventType,
                  NativeCompletion nativeCompletion) {
        if (phase_ != Phase::Active || unit != unit_ || eventType != 2)
            return false;
        const auto recruitment = ops.capture(unit_);
        ops.restore(unit_, submitted_);
        nativeCompletion();
        const bool retired = ops.capture(unit_).command != command_;
        ops.restore(unit_, recruitment);
        if (retired)
            *this = {};
        return true;
    }
};

// The stock AP99 event renderer refreshes rows on these notifications only.
// Repainting on every update resets the compound control's progress drawing.
inline bool ResearchRowsNeedRefresh(std::uint32_t argument2, std::uint32_t argument3) {
    return (argument3 >= 0x18000000U && argument3 <= 0x2b000000U) ||
           (argument2 == 0 && argument3 == 0x00505041U) ||
           (argument2 == 1 && (argument3 == 0x2c425041U || argument3 == 0x02425041U));
}
} // namespace MajestyCommunity
