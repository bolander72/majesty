#pragma once

#include <array>
#include <memory>

namespace presentation {

// The presenter keeps a shared lease until GPU completion and all consumers
// finish. Only a resource owned exclusively by this pool can be overwritten.
// A busy pool falls back to the original temporary allocation, without holding
// more cached resources or waiting on the browser's main thread.
template <class Resource, std::size_t Capacity> class CompositePool {
  public:
    template <class Matches, class Create>
    std::shared_ptr<Resource> acquire(Matches matches, Create create) {
        std::shared_ptr<Resource> *available = nullptr;
        for (auto &slot : slots_) {
            if (!slot) {
                if (!available)
                    available = &slot;
            } else if (slot.use_count() == 1) {
                if (matches(*slot))
                    return slot;
                if (!available)
                    available = &slot;
            }
        }
        auto resource = create();
        if (resource && available)
            *available = resource;
        return resource;
    }

  private:
    std::array<std::shared_ptr<Resource>, Capacity> slots_{};
};

} // namespace presentation
