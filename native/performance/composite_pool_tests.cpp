#include "composite_pool.h"

#include <cassert>
#include <memory>

namespace {
struct Resource {
    int id, width, format;
    int *destroyed;
    ~Resource() {
        ++*destroyed;
    }
};
} // namespace

int main() {
    int created = 0, destroyed = 0;
    auto make = [&](int width = 800, int format = 1) {
        return std::shared_ptr<Resource>(new Resource{++created, width, format, &destroyed});
    };
    auto matches = [](const Resource &r) { return r.width == 800 && r.format == 1; };
    {
        presentation::CompositePool<Resource, 2> pool;
        auto first = pool.acquire(matches, [&] { return make(); });
        const int first_id = first->id;
        // A GPU frame and a retained screenshot keep independent leases.
        auto gpu = first, capture = first;
        first.reset();
        auto second = pool.acquire(matches, [&] { return make(); });
        assert(second->id != first_id);
        // Both cached resources are busy: fallback is temporary and uncached.
        auto temporary = pool.acquire(matches, [&] { return make(); });
        temporary.reset();
        assert(created == 3 && destroyed == 1);
        gpu.reset();
        auto still_busy = pool.acquire(matches, [&] { return make(); });
        assert(still_busy->id != first_id);
        still_busy.reset();
        capture.reset();
        auto recycled = pool.acquire(matches, [&] { return make(); });
        assert(recycled->id == first_id && created == 4);
        recycled.reset();
        // Consecutive completed frames reuse storage without allocating.
        for (int i = 0; i < 10000; ++i) {
            auto frame = pool.acquire(matches, [&] { return make(); });
            assert(frame->id == first_id);
        }
        assert(created == 4);
        // A new resolution cannot reuse the old allocation; replace the free
        // slot rather than retaining one cache for each resolution ever used.
        auto full_hd = pool.acquire([](const Resource &r) { return r.width == 1920; },
                                    [&] { return make(1920); });
        assert(full_hd->width == 1920 && created == 5 && destroyed == 3);
        full_hd.reset();
        // Failed allocation must leave the old free entry reusable.
        auto failed = pool.acquire([](const Resource &) { return false; },
                                   [] { return std::shared_ptr<Resource>{}; });
        assert(!failed);
        auto restored = pool.acquire([](const Resource &r) { return r.width == 1920; },
                                     [&] { return make(1920); });
        assert(restored->width == 1920 && created == 5);
        restored.reset();
        // Equal dimensions with another format need a distinct allocation.
        auto changed_format =
            pool.acquire([](const Resource &r) { return r.width == 1920 && r.format == 2; },
                         [&] { return make(1920, 2); });
        assert(changed_format->format == 2 && created == 6);
        second.reset();
    }
    assert(created == destroyed);
}
