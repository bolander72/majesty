#include "expansion_panel_owner.h"
#include <cassert>
#include <fstream>
#include <iterator>
#include <string>
#include <utility>
#ifdef NDEBUG
#error "Native controller checks require enabled assertions"
#endif
using namespace MajestyCommunity;
namespace {
std::vector<unsigned char> bytes(const char *path) {
    std::ifstream input(path, std::ios::binary);
    assert(input.good());
    std::vector<unsigned char> result{std::istreambuf_iterator<char>(input), {}};
    assert(!result.empty() && result.size() <= 512 * 1024);
    return result;
}
std::uint32_t word(const std::vector<unsigned char> &data, unsigned &at) {
    assert(at <= data.size() && data.size() - at >= 4);
    std::uint32_t value = 0;
    for (unsigned i = 0; i < 4; ++i)
        value |= std::uint32_t(data[at++]) << (8 * i);
    return value;
}
struct Ops {
    std::map<std::uint32_t, std::uint32_t> memory;
    std::vector<std::pair<std::uint32_t, std::uint32_t>> ranges;
    std::map<std::uint32_t, unsigned> allocated;
    std::uint32_t currentUnit = 0x1000, next = 0x9000;
    unsigned releases = 0;
    bool valid(std::uint32_t address, std::uint32_t count) {
        for (const auto &[start, size] : ranges)
            if (address >= start && address - start <= size && count <= size - (address - start))
                return true;
        return false;
    }
    std::uint32_t read(std::uint32_t address) {
        assert(valid(address, 4));
        return memory[address];
    }
    void write(std::uint32_t address, std::uint32_t value) {
        assert(valid(address, 4));
        memory[address] = value;
    }
    std::uint32_t allocate(unsigned size) {
        const auto result = next;
        next += 0x100;
        ranges.emplace_back(result, size);
        assert(allocated.emplace(result, size).second);
        return result;
    }
    void release(std::uint32_t address) {
        assert(allocated.erase(address) == 1);
        ++releases;
    }
    std::uint32_t unit(std::uint32_t) {
        return currentUnit;
    }
    explicit Ops(const ExpansionPanelPlan &plan) {
        const auto &profile = *plan.profile;
        ranges = {
            {0x1000, 0x90}, {0x2000, 0x40}, {0x5000, 8}, {profile.vtable, profile.entries * 4}};
        for (unsigned i = 0; i < profile.entries; ++i)
            write(profile.vtable + i * 4, profile.methods[i]);
        write(0x2000, profile.vtable);
        write(0x2014, 0x6000);
        write(0x2018, 0x7000); // The world token is deliberately not the unit pointer.
        write(0x201c, 41);
        write(0x1060, 41);
        write(0x106c, plan.family | (std::uint32_t('1') << 24U));
        write(0x1080, 0x5000);
        write(0x5004, read(0x106c));
    }
};
} // namespace
int main(int argc, char **argv) {
    assert(argc == 3);
    auto raw = bytes(argv[1]);
    MajestyStockControllers::Registry registry;
    std::string error;
    assert(MajestyStockControllers::ParseRegistry(raw.data(), raw.size(), &registry, &error));
    ExpansionPanelOwner owner(registry);
    raw = bytes(argv[2]);
    unsigned at = 0;
    assert(word(raw, at) == NativeFourCC("EPCT"));
    assert(word(raw, at) == expansionControllerProfiles.size());
    for (const auto &profile : expansionControllerProfiles) {
        assert(word(raw, at) == profile.selector);
        assert(word(raw, at) == profile.vtable);
        assert(word(raw, at) == profile.entries);
        for (unsigned i = 0; i < profile.entries; ++i)
            assert(word(raw, at) == profile.methods[i]);
    }
    assert(at == raw.size());
    assert(owner.selector(NativeFourCC("CGAG")) == NativeFourCC("AP08"));
    assert(owner.selector(NativeFourCC("CGAG")) != NativeFourCC("AP80"));
    assert(owner.selector(NativeFourCC("CGZM")) == NativeFourCC("MX09"));
    assert(owner.selector(NativeFourCC("CGZC")) == NativeFourCC("AP41"));
    assert(owner.selector(NativeFourCC("CGZT")) == NativeFourCC("MX05"));
    assert(owner.selector(NativeFourCC("CGAQ")) == NativeFourCC("MX05"));
    for (const auto stock : {"CGPH", "CG01", "CGBD", "AP08", "AP80"}) {
        const auto id = std::uint32_t(stock[0]) | (std::uint32_t(stock[1]) << 8U) |
                        (std::uint32_t(stock[2]) << 16U) | (std::uint32_t(stock[3]) << 24U);
        assert(owner.selector(id) == id);
    }
    const std::array<std::uint32_t, expansionPanelEntryCount> bridges{0x100000, 0x100010, 0x100020,
                                                                      0x100030, 0x100040};
    for (const auto dialog : {NativeFourCC("CGAG"), NativeFourCC("CGZM"), NativeFourCC("CGZC"),
                              NativeFourCC("CGZT"), NativeFourCC("CGAQ")}) {
        const auto plan = owner.plan(dialog);
        assert(plan.profile);
        Ops ops(plan);
        assert(!owner.attach(ops, 0x2000, dialog, 0x6001, 0x1000, bridges));
        assert(ops.allocated.empty());
        const auto original = ops.read(plan.profile->vtable + 8);
        ops.write(plan.profile->vtable + 8, original + 1);
        assert(!owner.attach(ops, 0x2000, dialog, 0x6000, 0x1000, bridges));
        ops.write(plan.profile->vtable + 8, original);
        assert(owner.attach(ops, 0x2000, dialog, 0x6000, 0x1000, bridges));
        const auto first = owner.find(0x2000);
        assert(first.context == 0x7000 && first.unit == 0x1000 && first.identity == 41);
        assert(owner.alive(ops, first));
        assert(!owner.attach(ops, 0x2000, dialog, 0x6000, 0x1000, bridges));
        constexpr unsigned slots[] = {0, 1, 3, 8, 14};
        for (unsigned i = 0; i < plan.profile->entries; ++i) {
            auto expected = plan.profile->methods[i];
            for (unsigned j = 0; j < expansionPanelEntryCount; ++j)
                if (i == slots[j])
                    expected = bridges[j];
            assert(ops.read(first.table + i * 4) == expected);
        }
        if (dialog == NativeFourCC("CGAG"))
            assert(owner.child(first, 28929) == NativeFourCC("CGAQ"));
        if (dialog == NativeFourCC("CGZM")) {
            assert(owner.child(first, 5001) == NativeFourCC("CGZC"));
            assert(owner.child(first, 10800) == NativeFourCC("CGZT"));
        }
        assert(owner.child(first, 0xffffffffU) == 0);
        ops.write(0x1060, 42);
        assert(!owner.alive(ops, first));
        ops.write(0x1060, 41);
        ops.write(0x2018, 0x7100);
        assert(!owner.alive(ops, first));
        ops.write(0x2018, 0x7000);
        assert(owner.detach(ops, 0x2000, first.generation));
        assert(ops.read(0x2000) == plan.profile->vtable && ops.allocated.empty());
        assert(owner.attach(ops, 0x2000, dialog, 0x6000, 0x1000, bridges));
        const auto replacement = owner.find(0x2000);
        assert(replacement.generation > first.generation);
        assert(!owner.detach(ops, 0x2000, first.generation));
        assert(owner.alive(ops, replacement));
        owner.clear(ops);
        assert(ops.releases == 2 && ops.allocated.empty());
    }
}
