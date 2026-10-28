#include "private_intent_text.h"
#include "StockControllerRegistry.h"
#include <cassert>
#include <cstring>
#include <fstream>
#include <iterator>
#include <map>
#ifdef NDEBUG
#error "Native intent checks require enabled assertions"
#endif
namespace {
std::vector<unsigned char> bytes(const char *path) {
    std::ifstream input(path, std::ios::binary);
    assert(input.good());
    std::vector<unsigned char> result{std::istreambuf_iterator<char>(input), {}};
    assert(!result.empty() && result.size() <= 16 * 1024 * 1024);
    return result;
}
struct Ops {
    std::vector<unsigned char> memory = std::vector<unsigned char>(8 * 1024 * 1024);
    std::map<std::uint32_t, unsigned> owned;
    std::uint32_t next = 0x20000;
    unsigned frees = 0;
    bool deny = false;
    bool valid(std::uint32_t address, std::uint32_t count) {
        return address >= 4 && address <= memory.size() && count <= memory.size() - address;
    }
    std::uint32_t allocate(unsigned size) {
        if (deny || !valid(next, size))
            return 0;
        const auto result = next;
        next += size + 16;
        assert(owned.emplace(result, size).second);
        return result;
    }
    void release(std::uint32_t address) {
        assert(owned.erase(address) == 1);
        ++frees;
    }
    std::uint32_t read(std::uint32_t address) {
        assert(valid(address, 4));
        std::uint32_t result = 0;
        std::memcpy(&result, memory.data() + address, 4);
        return result;
    }
    void write(std::uint32_t address, std::uint32_t value) {
        assert(valid(address, 4));
        std::memcpy(memory.data() + address, &value, 4);
    }
    void writeByte(std::uint32_t address, unsigned char value) {
        assert(valid(address, 1));
        memory[address] = value;
    }
};
} // namespace
int main(int argc, char **argv) {
    assert(argc == 3);
    const auto controls = bytes(argv[1]), raw = bytes(argv[2]);
    MajestyStockControllers::Registry recipes;
    std::string error;
    assert(
        MajestyStockControllers::ParseRegistry(controls.data(), controls.size(), &recipes, &error));
    MajestyCommunity::PrivateIntentText text;
    Ops ops;
    ops.deny = true;
    assert(!text.initialize(ops, raw.data(), raw.size(), error));
    assert(ops.owned.empty() && text.records().empty());
    ops.deny = false;
    assert(text.initialize(ops, raw.data(), raw.size(), error));
    assert(!text.initialize(ops, raw.data(), raw.size(), error));
    assert(text.records().size() >= 33 && ops.owned.size() == 1);
    ops.write(0x007218b4U, 0x1000);
    ops.write(0x1010, 0x2000);
    ops.write(0x2028, 0x3000);
    for (const auto &record : text.records()) {
        assert(text.text(record.id) && *text.text(record.id) == record.text);
        const auto view = text.view(record.id);
        assert(view && ops.read(view + 4) == 0 && ops.read(view + 8) == record.text.size());
        assert(ops.read(view) == view + 12);
        assert(std::string(reinterpret_cast<const char *>(ops.memory.data() + view + 12)) ==
               record.text);
        assert(text.lookup(ops, 0, 0x58544941U, record.id) == view);
        assert(text.lookup(ops, 0x3000, 0xffffffffU, record.id) == view);
        assert(text.lookup(ops, 0, 0x4e544e55U, record.id) == 0);
        assert(text.lookup(ops, 0x58544941U, 0xffffffffU, record.id) == 0);
    }
    unsigned rowTexts = 0;
    const auto checkRowText = [&](std::uint32_t id) {
        const auto *value = text.text(id);
        assert(value && !value->empty() && value->size() <= 96);
        ++rowTexts;
    };
    for (const auto &board : recipes.liveAgentLists) {
        assert(board.dataRecordRows && board.hasRowVariants);
        for (const auto &variant : board.rowVariants) {
            checkRowText(variant.rowTitleIntentId);
            checkRowText(variant.rowTextIntentId);
        }
        if (board.hasRowValue)
            checkRowText(board.rowValueSuffixIntentId);
    }
    assert(rowTexts == 33);
    auto unknown = MajestyIntentText::kFirstPrivateIntentId;
    while (text.view(unknown))
        ++unknown;
    assert(text.lookup(ops, 0, 0x58544941U, unknown) == 0);
    const auto first = text.records().front().id;
    ops.write(0x007218b4U, 0);
    assert(text.lookup(ops, 0x3000, 0xffffffffU, first) == 0);
    text.clear(ops);
    assert(ops.frees == 1 && ops.owned.empty() && text.view(first) == 0);
    auto malformed = raw;
    malformed.push_back(0);
    assert(!text.initialize(ops, malformed.data(), malformed.size(), error));
    assert(ops.owned.empty());
    malformed = raw;
    malformed[20] = 0x81; // An undefined Windows-1252 byte in the first text.
    assert(!text.initialize(ops, malformed.data(), malformed.size(), error));
    assert(ops.owned.empty());
}
