#include "kingdom_research_descriptors.h"
#include <cassert>
#include <map>

struct Ops {
    std::map<std::uint32_t, std::uint32_t> table, words;
    std::uint32_t next = 0x8000;
    unsigned allocations = 0, releases = 0;
    bool failAllocation = false;
    std::uint32_t lookup(std::uint32_t id) {
        return table.count(id) ? table.at(id) : 0;
    }
    std::uint32_t read(std::uint32_t address) {
        return words.at(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        words[address] = value;
    }
    std::uint32_t allocate(std::uint32_t size) {
        assert(size == 20);
        ++allocations;
        if (failAllocation)
            return 0;
        auto result = next;
        next += 32;
        return result;
    }
    void release(std::uint32_t address) {
        assert(address >= 0x8000);
        ++releases;
    }
    bool insert(std::uint32_t id, std::uint32_t descriptor) {
        return table.emplace(id, descriptor).second;
    }
    Ops() {
        table[5020] = 0x7000;
        for (unsigned i = 0; i < 5; ++i)
            words[0x7000 + i * 4] = 10 + i;
    }
};
int main() {
    MajestyRuntimeFeatures::KingdomResearchRecord record{};
    record.actionControlId = 29472;
    record.descriptorTemplateControlId = 5020;
    record.requiredLevel = 3;
    record.price = 3000;
    record.completionAttribute = 0xda882f2c;
    std::vector<MajestyRuntimeFeatures::KingdomResearchRecord> records{record};
    MajestyCommunity::KingdomResearchDescriptors descriptors;
    Ops ops;
    assert(descriptors.prepare(ops, records));
    const auto entry = ops.lookup(29472);
    assert(entry && ops.read(entry) == 10 && ops.read(entry + 12) == 13);
    assert(ops.read(entry + 4) == 3 && ops.read(entry + 8) == 3000 &&
           ops.read(entry + 16) == record.completionAttribute);
    assert(descriptors.prepare(ops, records) && ops.allocations == 1 && !ops.releases);
    records[0].price = 3001;
    assert(!descriptors.prepare(ops, records) && ops.allocations == 1);
    records[0] = record;
    Ops collision;
    collision.table[29472] = 0x9000;
    MajestyCommunity::KingdomResearchDescriptors other;
    assert(!other.prepare(collision, records) && !collision.allocations);
    Ops missing;
    missing.table.clear();
    assert(!other.prepare(missing, records) && !missing.allocations);
    Ops failure;
    failure.failAllocation = true;
    assert(!other.prepare(failure, records) && !failure.lookup(29472));
    Ops duplicate;
    records.push_back(record);
    assert(!other.prepare(duplicate, records) && !duplicate.allocations);
    records = {record};
    records[0].requiredLevel = 4;
    assert(!other.prepare(duplicate, records) && !duplicate.allocations);
}
