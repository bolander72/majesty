#pragma once
#include <cstdint>
#include <string>
#include <utility>

namespace MajestyCommunity {
// The stock command packet identifies one exact building. A scoped callback
// substitution must never leak into a nested stock Rage or a replacement world.
class RageDispatch {
    std::uint32_t unit_ = 0, identity_ = 0;
    std::uint64_t epoch_ = 0;
    std::string pending_, active_;

  public:
    bool begin(std::uint32_t unit, std::uint32_t identity, const std::string &callback) {
        if (!unit || !identity || callback.empty() || callback.size() >= 120 || unit_)
            return false;
        unit_ = unit;
        identity_ = identity;
        pending_ = callback;
        return true;
    }
    bool pending() const {
        return unit_ != 0;
    }
    bool matches(std::uint32_t unit, std::uint32_t identity) const {
        return unit_ && unit_ == unit && identity_ == identity;
    }
    const std::string &callback() const {
        return active_;
    }
    void reset() {
        ++epoch_;
        unit_ = identity_ = 0;
        pending_.clear();
        active_.clear();
    }
    class Scope {
        RageDispatch &owner_;
        std::uint64_t epoch_;
        std::string previous_;

      public:
        Scope(RageDispatch &owner, std::uint32_t unit, std::uint32_t identity)
            : owner_(owner), epoch_(owner.epoch_), previous_(owner.active_) {
            owner.active_ = owner.matches(unit, identity) ? owner.pending_ : std::string{};
        }
        ~Scope() {
            if (owner_.epoch_ == epoch_)
                owner_.active_ = std::move(previous_);
        }
        Scope(const Scope &) = delete;
        Scope &operator=(const Scope &) = delete;
    };
};
} // namespace MajestyCommunity
