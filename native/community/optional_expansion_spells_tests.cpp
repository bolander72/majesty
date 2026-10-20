#include "optional_expansion_spells.h"
#include <map>
#include <stdexcept>
#include <string>

namespace {
void verify(bool value, int line) {
    if (!value)
        throw std::runtime_error("optional expansion spell contract failed at " +
                                 std::to_string(line));
}
#define check(value) verify((value), __LINE__)
struct Ops {
    std::map<std::uint32_t, std::uint32_t> memory{
        {100, 0},    {104, 200},  {108, 212}, {200, 300}, {204, 304},   {208, 308}, {300, 1000},
        {304, 1100}, {308, 1200}, {1000, 9},  {1004, 6},  {1008, 1},    {1100, 9},  {1104, 5},
        {1108, 77},  {1200, 9},   {1204, 3},  {1208, 88}, {1500, 2000}, {1508, 18}};
    std::string name = "turn_undead_healer";
    std::uint32_t catalogAddress = 3000, descriptor = 0;
    unsigned lookups = 0, resets = 0, references = 0;
    bool valid(std::uint32_t address, std::uint32_t bytes) {
        if (address == 2000)
            return bytes <= name.size();
        return bytes >= 4 && memory.count(address) && memory.count(address + bytes - 4);
    }
    std::uint32_t read(std::uint32_t address) {
        return memory.at(address);
    }
    std::uint32_t reference(std::uint32_t value, std::uint32_t slot) {
        check(value == 1200 && slot == 0x30);
        ++references;
        return 1500;
    }
    char byte(std::uint32_t address) {
        return name.at(address - 2000);
    }
    std::uint32_t catalog() {
        return catalogAddress;
    }
    std::uint32_t find(std::uint32_t catalog, std::uint32_t chars) {
        check(catalog == catalogAddress && chars == 2000);
        ++lookups;
        return descriptor;
    }
    void resetBoolean(std::uint32_t result) {
        check(result == 1000);
        ++resets;
        memory[1008] = 0; // Original CBool::Reset changes the value only.
    }
};
} // namespace

int main() {
    using MajestyCommunity::OptionalExpansionSpells;
    OptionalExpansionSpells guard;
    Ops absent;
    const auto original = absent.memory;
    check(guard.absent(absent, 100));
    auto expected = original;
    expected[1008] = 0;
    check(absent.memory == expected && absent.lookups == 1 && absent.resets == 1);
    check(guard.absent(absent, 100));
    check(absent.lookups == 1 && absent.resets == 2);
    // Northern keeps its actual ability, level requirement and cooldown.
    guard.reset();
    Ops northern;
    northern.descriptor = 4000;
    check(!guard.absent(northern, 100) && !northern.resets);
    check(northern.memory == original);
    northern.descriptor = 0;
    guard.reset();
    check(guard.absent(northern, 100) && northern.lookups == 2);
    northern.catalogAddress = 5000;
    northern.descriptor = 4000;
    check(!guard.absent(northern, 100) && northern.lookups == 3);
    Ops uppercase;
    uppercase.name = "Turn_Undead_Healer";
    guard.reset();
    check(guard.absent(uppercase, 100));
    // The optional ignore-cooldown integer argument is accepted unchanged.
    Ops ignoreCooldown;
    ignoreCooldown.memory[108] = 216;
    ignoreCooldown.memory[212] = 312;
    ignoreCooldown.memory[312] = 1300;
    ignoreCooldown.memory[1300] = 9;
    ignoreCooldown.memory[1304] = 1;
    ignoreCooldown.memory[1308] = 1;
    guard.reset();
    check(guard.absent(ignoreCooldown, 100));
    ignoreCooldown.descriptor = 4000;
    guard.reset();
    const auto beforeCooldown = ignoreCooldown.memory;
    check(!guard.absent(ignoreCooldown, 100));
    check(ignoreCooldown.memory == beforeCooldown);
    ignoreCooldown.memory[1304] = 6;
    guard.reset();
    check(!guard.absent(ignoreCooldown, 100));
    for (const auto &name : {"healer_heal", "turn_undead_paladin", "turn_undead_healerX",
                             "turn_undead_heale", "OtherMissingSpell"}) {
        Ops other;
        other.name = name;
        other.memory[1508] = other.name.size();
        guard.reset();
        check(!guard.absent(other, 100) && !other.lookups && !other.resets);
    }
    for (const auto &change : std::map<std::uint32_t, std::uint32_t>{{104, 201},
                                                                     {108, 208},
                                                                     {200, 0},
                                                                     {300, 0},
                                                                     {1004, 1},
                                                                     {1104, 1},
                                                                     {1204, 1},
                                                                     {1500, 0},
                                                                     {1508, 17}}) {
        Ops malformed;
        malformed.memory[change.first] = change.second;
        const auto before = malformed.memory;
        guard.reset();
        check(!guard.absent(malformed, 100));
        check(malformed.memory == before && !malformed.resets && !malformed.lookups);
    }
    Ops noCatalog;
    noCatalog.catalogAddress = 0;
    guard.reset();
    check(!guard.absent(noCatalog, 100) && !noCatalog.lookups && !noCatalog.resets);
    check(!guard.absent(noCatalog, 0));
}
