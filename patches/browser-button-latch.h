// Keep a browser button down across guest presents; release after a bounded wait.
#pragma once
#include <array>
#include <cstdint>

class ButtonLatch {
    struct State { bool down = false; uint32_t frame = 0; uint64_t time = 0; };
    std::array<State, 8> buttons_{};
public:
    void press(unsigned button, uint32_t frame, uint64_t now) {
        if (button < buttons_.size()) buttons_[button] = {true, frame, now};
    }
    bool ready(unsigned button, uint32_t frame, uint64_t now) const {
        if (button >= buttons_.size()) return true;
        const auto &state = buttons_[button];
        return !state.down || uint32_t(frame - state.frame) >= 2 ||
               (now >= state.time && now - state.time >= 250000000);
    }
    void release(unsigned button) {
        if (button < buttons_.size()) buttons_[button] = {};
    }
    void reset() { buttons_ = {}; }
};
