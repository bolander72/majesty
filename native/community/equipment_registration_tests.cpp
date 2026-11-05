#include "equipment_registration.h"
#include <cassert>
#include <map>
#include <utility>
#include <vector>

struct Record {
    std::uint32_t equipmentId, slot, nameTable;
};
struct Ops {
    std::map<std::pair<std::uint32_t, std::uint32_t>, std::uint32_t> slots;
    std::map<std::uint32_t, std::uint32_t> values, resources;
    std::uint32_t next = 0x10000;
    unsigned acquisitions = 0, writes = 0;
    std::uint32_t slot(std::uint32_t map, std::uint32_t id) {
        auto &value = slots[{map, id}];
        if (!value)
            value = next += 4;
        return value;
    }
    std::uint32_t nameSlot(std::uint32_t map, std::uint32_t id) {
        return slot(map, id);
    }
    std::uint32_t iconSlot(std::uint32_t map, std::uint32_t id) {
        return slot(map, id);
    }
    std::uint32_t read(std::uint32_t address) {
        return values[address];
    }
    void write(std::uint32_t address, std::uint32_t value) {
        ++writes;
        values[address] = value;
    }
    std::uint32_t acquire(std::uint32_t id) {
        ++acquisitions;
        return resources[id];
    }
};

int main() {
    using Result = MajestyCommunity::EquipmentRegistration;
    const std::vector<Record> records{
        {0xd82af6, 0, 0x314e4542}, {0xdf51ed, 0, 0x324e4542}, {0xbad73c, 0, 0x334e4542}};
    Ops ops;
    for (const auto &record : records)
        ops.resources[record.nameTable] = record.nameTable + 0x1000;
    assert(MajestyCommunity::RegisterEquipment(ops, 0x8000, records) == Result::Installed);
    assert(ops.writes == 6 && ops.acquisitions == 3);
    for (const auto &record : records) {
        assert(ops.read(ops.nameSlot(0x8010, record.equipmentId)) ==
               ops.resources[record.nameTable]);
        assert(ops.read(ops.iconSlot(0x8020, record.equipmentId)) == record.equipmentId);
    }
    const auto before = ops.writes;
    assert(MajestyCommunity::RegisterEquipment(ops, 0x8000, records) == Result::Collision);
    assert(ops.writes == before && ops.acquisitions == 3);
    Ops missing;
    assert(MajestyCommunity::RegisterEquipment(missing, 0x8000, records) ==
           Result::MissingResource);
    assert(!missing.writes);
    Ops duplicate;
    auto changed = records;
    changed.push_back(records.front());
    assert(MajestyCommunity::RegisterEquipment(duplicate, 0x8000, changed) == Result::Invalid);
    assert(duplicate.slots.empty());
    changed = records;
    changed[1].equipmentId = 8;
    assert(MajestyCommunity::RegisterEquipment(duplicate, 0x8000, changed) == Result::Invalid);
    changed = records;
    changed[0].slot = 2;
    assert(MajestyCommunity::RegisterEquipment(duplicate, 0x8000, changed) == Result::Invalid);
    const std::vector<Record> armor{{0xd82af6, 1, 0x314e4542}};
    assert(MajestyCommunity::RegisterEquipment(ops, 0x9000, armor) == Result::Installed);
    assert(ops.read(ops.nameSlot(0x9000, armor[0].equipmentId)) ==
           ops.resources[armor[0].nameTable]);
    assert(ops.read(ops.iconSlot(0x9030, armor[0].equipmentId)) == armor[0].equipmentId);
}
