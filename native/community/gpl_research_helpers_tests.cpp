#include "gpl_research_helpers.h"
#include <cassert>
#include <map>
#include <vector>

struct Ops {
    std::map<std::uint32_t, std::uint32_t> words;
    std::map<std::uint32_t, std::uint32_t> attributes;
    std::uint32_t actor = 0x7000, order = 0x9000;
    unsigned writes = 0, calls = 0;
    bool valid(std::uint32_t address, std::uint32_t bytes) {
        return address && bytes >= 4 && address <= UINT32_MAX - bytes && words.count(address) &&
               words.count(address + bytes - 4);
    }
    std::uint32_t read(std::uint32_t address) {
        return words.at(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        ++writes;
        words[address] = value;
    }
    std::uint32_t integer(std::uint32_t value) {
        return value + 8;
    }
    std::uint32_t unit(std::uint32_t) {
        return actor;
    }
    std::uint32_t attribute(std::uint32_t unit, std::uint32_t id) {
        assert(unit == actor);
        return attributes[id];
    }
    std::uint32_t call(std::uint32_t address, std::uint32_t self,
                       std::initializer_list<std::uint32_t> arguments) {
        assert(address == 0x005b2e10 && self == actor && arguments.size() == 2);
        auto at = arguments.begin();
        assert(*at++ == 1 && *at == 0x4005);
        ++calls;
        return order;
    }
    void reset() {
        words = {{0x1000, 0},      {0x1004, 0x2000}, {0x1008, 0x200c},     {0x2000, 0x3000},
                 {0x2004, 0x3004}, {0x2008, 0x3008}, {0x3000, 0x4000},     {0x3004, 0x4010},
                 {0x3008, 0x4020}, {0x4000, 0},      {0x4004, 1},          {0x4008, 99},
                 {0x4010, 0},      {0x4014, 5},      {0x4020, 0},          {0x4024, 1},
                 {0x4028, 7331},   {0x7000, 0x8000}, {0x706c, 0x33744241}, {0x8180, 0x005b2e10}};
        attributes = {{0x01425041, 1}, {0x02425041, 1}, {0x2c425041, 7331}};
        actor = 0x7000;
        order = 0x9000;
        writes = calls = 0;
    }
};
int main() {
    using namespace MajestyCommunity;
    MajestyRuntimeFeatures::Registry source;
    MajestyRuntimeFeatures::KingdomResearchRecord record{};
    record.identity = "00112233445566778899aabbccddeeff";
    record.buildingFamily = 0x474442;
    record.actionControlId = 7331;
    record.requiredLevel = 3;
    source.kingdomResearch.push_back(record);
    std::vector<std::uint8_t> raw{'M', 'J', 'R', '1', 1, 0, 0, 0};
    for (unsigned i = 0; i < 16; ++i)
        raw.push_back(i * 17);
    const auto append = [&](std::uint32_t value) {
        for (unsigned i = 0; i < 4; ++i)
            raw.push_back((value >> (8 * i)) & 255);
    };
    append(record.buildingFamily);
    append(0x744241);
    std::vector<ResearchBinding> bindings;
    assert(ParseResearchBindings(raw.data(), raw.size(), source, bindings) && bindings.size() == 1);
    const auto original = raw;
    raw[24] ^= 1;
    assert(!ParseResearchBindings(raw.data(), raw.size(), source, bindings) &&
           bindings.size() == 1);
    raw = original;
    raw[31] = 1;
    assert(!ParseResearchBindings(raw.data(), raw.size(), source, bindings));
    raw = original;
    raw[8] ^= 1;
    assert(!ParseResearchBindings(raw.data(), raw.size(), source, bindings));
    assert(!ParseResearchBindings(nullptr, 0, source, bindings));
    raw = original;
    raw.push_back(0);
    assert(!ParseResearchBindings(raw.data(), raw.size(), source, bindings));
    ResearchInFlight flight;
    Ops ops;
    const auto query = [&](ResearchQuery kind) {
        return ExecuteResearchQuery(ops, bindings, flight, kind, 0x1000);
    };
    ops.reset();
    assert(query(ResearchQuery::Eligible) && ops.read(0x4008) == 1 && !ops.calls);
    ops.reset();
    ops.words[0x706c] = 0x32744241;
    assert(query(ResearchQuery::Eligible) && ops.read(0x4008) == 0);
    ops.reset();
    ops.attributes[0x01425041] = 0;
    assert(query(ResearchQuery::Eligible) && ops.read(0x4008) == 0);
    ops.reset();
    ops.attributes[0x02425041] = 0;
    assert(query(ResearchQuery::Eligible) && ops.read(0x4008) == 0);
    ops.reset();
    ops.words[0x706c] = 0x33754241;
    assert(query(ResearchQuery::Eligible) && ops.read(0x4008) == 0);
    ops.reset();
    assert(query(ResearchQuery::Order) && ops.read(0x4008) == 1 && ops.calls == 1);
    ops.reset();
    ops.order = 0;
    assert(query(ResearchQuery::Order) && ops.read(0x4008) == 0 && ops.calls == 1);
    ops.reset();
    ops.attributes[0x2c425041] = 2;
    assert(query(ResearchQuery::Order) && ops.read(0x4008) == 0 && !ops.calls);
    ops.reset();
    ops.words[0x8180] = 0;
    assert(!query(ResearchQuery::Order) && !ops.writes && !ops.calls);
    ops.reset();
    ops.actor = 0;
    assert(query(ResearchQuery::Order) && ops.read(0x4008) == 0);
    ops.reset();
    ops.words[0x4028] = 7332;
    assert(query(ResearchQuery::Order) && ops.read(0x4008) == 0 && !ops.calls);
    ops.reset();
    ops.words[0x4028] = 0xffffffff;
    assert(query(ResearchQuery::Order) && ops.read(0x4008) == 0);
    ops.reset();
    ops.words[0x4024] = 3;
    assert(query(ResearchQuery::Order) && ops.read(0x4008) == 0);
    ops.reset();
    ops.words[0x4004] = 10;
    assert(!query(ResearchQuery::Order) && !ops.writes);
    ops.reset();
    ops.order = 0;
    {
        ResearchFlight outer(flight, ops.actor, 7331);
        assert(query(ResearchQuery::Order) && ops.read(0x4008) == 1 && !ops.calls);
        {
            ResearchFlight inner(flight, ops.actor, 7332);
            assert(query(ResearchQuery::Order) && ops.read(0x4008) == 0 && ops.calls == 1);
        }
        assert(flight.unit == ops.actor && flight.command == 7331);
        ops.words[0x706c] = 0x33754241;
        assert(query(ResearchQuery::Order) && ops.read(0x4008) == 0);
    }
    assert(!flight.unit && !flight.command);
}
