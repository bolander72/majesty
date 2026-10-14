#pragma once
#include <cstdint>

namespace MajestyCommunity {
enum class Registration {
    Installed,
    NotReady,
    MissingStock,
    Collision,
    ConstructionFailed,
    AllocationFailed
};

// All values are guest addresses/IDs. Ops owns guest ABI calls; this algorithm
// neither fabricates a generator nor substitutes stock name fragments.
template <class Ops, class Record>
Registration RegisterNames(Ops &ops, std::uint32_t registry, std::uint32_t resources,
                           const Record &record) {
    if (!ops.ready(registry) || !resources)
        return Registration::NotReady;
    const auto stockSlot = ops.slot(registry, 0x37314d4eU); // stock NM17
    const auto stock = stockSlot ? ops.read(stockSlot) : 0U;
    if (!stock)
        return Registration::MissingStock;
    const auto slot = ops.slot(registry, record.generatorId);
    if (!slot || ops.read(slot))
        return Registration::Collision;
    const auto generator = ops.construct(record, resources);
    if (!generator || !ops.valid_generator(generator)) {
        if (generator)
            ops.destroy_generator(generator);
        return Registration::ConstructionFailed;
    }
    const auto wrapper = ops.allocate_wrapper();
    if (!wrapper) {
        ops.destroy_generator(generator);
        return Registration::AllocationFailed;
    }
    // Original eight-byte wrapper owns the original 56-byte generator. Its
    // stock vtable/destructor/map lifecycle remains intact.
    ops.write(wrapper, ops.read(stock));
    ops.write(wrapper + 4, generator);
    ops.write(slot, wrapper);
    return Registration::Installed;
}
} // namespace MajestyCommunity
