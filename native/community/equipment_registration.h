#pragma once
#include <cstdint>
#include <set>
#include <vector>

namespace MajestyCommunity {
enum class EquipmentRegistration { Installed, Invalid, Collision, MissingResource };

// Old's original constructor owns four sixteen-byte maps. Resources remain
// owned by the original STRT provider; map nodes follow native teardown.
// Ops invokes original guest map/resource helpers, never host-pointer casts.
template <class Ops, class Records>
EquipmentRegistration RegisterEquipment(Ops &ops, std::uint32_t presenter, const Records &records) {
    if (!presenter || records.empty() || records.size() > 256)
        return EquipmentRegistration::Invalid;
    std::set<std::uint32_t> identities;
    for (const auto &record : records)
        if (record.equipmentId < 0x800000 || record.equipmentId > 0xffffff || record.slot > 1 ||
            !record.nameTable || !identities.insert(record.equipmentId).second)
            return EquipmentRegistration::Invalid;
    struct Pending {
        std::uint32_t name = 0, icon = 0, resource = 0, identity = 0;
    };
    std::vector<Pending> pending;
    // Check every destination before acquiring or publishing custom resources.
    // A failed original insertion can leave only native-owned empty nodes.
    for (const auto &record : records) {
        const auto name =
            ops.nameSlot(presenter + (record.slot == 0 ? 0x10 : 0), record.equipmentId);
        const auto icon =
            ops.iconSlot(presenter + (record.slot == 0 ? 0x20 : 0x30), record.equipmentId);
        if (!name || !icon || ops.read(name) || ops.read(icon))
            return EquipmentRegistration::Collision;
        pending.push_back({name, icon, 0, record.equipmentId});
    }
    for (unsigned i = 0; i < pending.size(); ++i) {
        pending[i].resource = ops.acquire(records[i].nameTable);
        if (!pending[i].resource)
            return EquipmentRegistration::MissingResource;
    }
    for (const auto &item : pending) {
        ops.write(item.name, item.resource);
        ops.write(item.icon, item.identity);
    }
    return EquipmentRegistration::Installed;
}
} // namespace MajestyCommunity
