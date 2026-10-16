#include "gpl_attribute_bridge.h"
#include <map>
#include <stdexcept>
#include <vector>

namespace {
void check(bool value) {
    if (!value)
        throw std::runtime_error("native GPL attribute bridge failed");
}
struct Ops {
    std::map<std::uint32_t, std::uint32_t> memory, attributes;
    std::vector<std::uint32_t> reads;
    std::string typeName = "list";
    unsigned allocations = 0, resets = 0, copies = 0, releases = 0;
    bool refuseInsertion = false;
    Ops(unsigned count, std::uint32_t type) {
        memory = {{100, 0},
                  {104, 200},
                  {108, 200 + count * 4},
                  {0x007218b4, 40000},
                  {40000 + 0x10, 41000},
                  {41000 + 0x1c, 42000},
                  {1500, 2000},
                  {1504, type},
                  {1516, 99},
                  {2016, 9016},
                  {2024, 9024}};
        for (unsigned i = 0; i < count; ++i) {
            memory[200 + i * 4] = 300 + i * 4;
            memory[300 + i * 4] = 1000 + i * 100;
            memory[1000 + i * 100] = 0;
            memory[1004 + i * 100] = i == 1 ? 5 : i == 2 || i == 3 ? 3 : type;
        }
        for (unsigned i = 0; i < 9; ++i)
            memory[42000 + 0xa4 + i * 4] = 16;
    }
    bool valid(std::uint32_t address, std::uint32_t bytes) {
        return memory.count(address) && memory.count(address + bytes - 4);
    }
    std::uint32_t read(std::uint32_t address) {
        reads.push_back(address);
        return memory.at(address);
    }
    std::uint32_t reference(std::uint32_t value, std::uint32_t offset) {
        check((value == 1100 && offset == 0x5c) ||
              ((value == 1200 || value == 1300) && offset == 0x30));
        return value;
    }
    std::string text(std::uint32_t value) {
        check(value == 1300);
        return typeName;
    }
    std::uint32_t call(std::uint32_t address, std::uint32_t self,
                       std::initializer_list<std::uint32_t> input) {
        const std::vector<std::uint32_t> args(input);
        if (address == 0x006255e0) {
            check(self == 1100 && args.empty());
            return 800;
        }
        if (address == 0x00626440 || address == 0x006263d0) {
            check(self == 800 && args == std::vector<std::uint32_t>{1200});
            return attributes.count(1200) ? attributes.at(1200) : 0;
        }
        if (address == 0x0062a810) {
            check(self == 42000 && args == std::vector<std::uint32_t>{memory.at(1504)});
            ++allocations;
            return 1500;
        }
        if (address == 9016) {
            check(self == 1500 && args.empty());
            memory[1516] = 0; // explicit native Reset fixture
            ++resets;
            return 0;
        }
        if (address == 9024) {
            check(self == 1500 && args == std::vector<std::uint32_t>{1400});
            ++copies;
            return 0;
        }
        if (address == 0x006261c0) {
            check(self == 800 && args == std::vector<std::uint32_t>{1200, 1500});
            if (!refuseInsertion)
                attributes[1200] = 1500;
            return !refuseInsertion;
        }
        check(address == 0x0062aa20 && self == 42000 && args == std::vector<std::uint32_t>{1500});
        ++releases;
        return 0;
    }
};
} // namespace

int main() {
    using namespace MajestyCommunity;
    Ops emptyList(4, 4);
    check(InstallAuthoredAttribute(emptyList, 100) == AttributeInstall::Added);
    check(emptyList.allocations == 1 && emptyList.resets == 1 && !emptyList.copies);
    check(emptyList.memory.at(1516) == 0 && emptyList.attributes.at(1200) == 1500);
    // The omitted initializer is outside the actual span. It must never be read.
    for (auto address : emptyList.reads)
        check(address != 216 && address != 316 && address != 1400);
    check(InstallAuthoredAttribute(emptyList, 100) == AttributeInstall::AlreadyExists);
    check(emptyList.allocations == 1);
    for (const auto &row : std::map<std::string, std::uint32_t>{
             {"integer", 1}, {"list", 4}, {"boolean", 6}, {"function", 8}}) {
        Ops initialized(5, row.second);
        initialized.typeName = row.first;
        check(InstallAuthoredAttribute(initialized, 100) == AttributeInstall::Added);
        check(initialized.copies == 1 && !initialized.resets);
        check(initialized.attributes.at(1200) != 1400);
    }
    for (auto end : {200U, 212U, 217U, 224U, 196U, 0xffffffffU}) {
        Ops malformed(4, 4);
        malformed.memory[108] = end;
        check(InstallAuthoredAttribute(malformed, 100) == AttributeInstall::Invalid);
        check(!malformed.allocations);
    }
    Ops wrongInitializer(5, 1);
    wrongInitializer.typeName = "boolean";
    check(InstallAuthoredAttribute(wrongInitializer, 100) == AttributeInstall::Invalid);
    check(!wrongInitializer.allocations);
    Ops missingSymbolType(4, 4);
    missingSymbolType.typeName = "unknown";
    check(InstallAuthoredAttribute(missingSymbolType, 100) == AttributeInstall::Invalid);
    check(!missingSymbolType.allocations);
    Ops wrongAgent(4, 4);
    wrongAgent.memory[1104] = 1;
    check(InstallAuthoredAttribute(wrongAgent, 100) == AttributeInstall::Invalid);
    check(!wrongAgent.allocations);
    Ops failedInsert(4, 4);
    failedInsert.refuseInsertion = true;
    check(InstallAuthoredAttribute(failedInsert, 100) == AttributeInstall::InsertionFailed);
    check(failedInsert.releases == 1 && failedInsert.attributes.empty());
    return 0;
}
