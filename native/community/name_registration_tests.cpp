#include "name_registration.h"
#include "RuntimeFeatureRegistry.h"
#include <cstdlib>
#include <fstream>
#include <iterator>
#include <map>
#include <stdexcept>
#include <vector>

void check(bool value) {
    if (!value)
        throw std::runtime_error("community name fixture failed");
}

struct Ops {
    std::map<std::uint32_t, std::uint32_t> memory;
    std::map<std::uint32_t, std::uint32_t> slots;
    bool isReady = true, valid = true, allocate = true;
    unsigned destroyed = 0, constructed = 0;
    std::uint32_t expectedRegistry = 100, expectedResources = 200;
    Ops() {
        slots[0x37314d4e] = 300;
        memory[300] = 400;
        memory[400] = 0x6833f0;
    }
    bool ready(std::uint32_t r) {
        check(r == expectedRegistry);
        return isReady;
    }
    std::uint32_t read(std::uint32_t p) {
        return memory[p];
    }
    void write(std::uint32_t p, std::uint32_t v) {
        memory[p] = v;
    }
    std::uint32_t slot(std::uint32_t r, std::uint32_t key) {
        check(r == expectedRegistry);
        if (!slots.count(key))
            slots[key] = 500;
        return slots[key];
    }
    std::uint32_t construct(const MajestyRuntimeFeatures::NameGeneratorRecord &r,
                            std::uint32_t resources) {
        check(resources == expectedResources && r.generatorId == 0x38314d4e);
        const std::uint32_t expected[] = {0x39364e48U, 0x30374e48U, 0x31374e48U, 0x32374e48U};
        for (unsigned i = 0; i < 4; ++i)
            check(r.namePartIds[i] == expected[i]);
        ++constructed;
        return 600;
    }
    bool valid_generator(std::uint32_t p) {
        check(p == 600);
        return valid;
    }
    std::uint32_t allocate_wrapper() {
        return allocate ? 700U : 0U;
    }
    void destroy_generator(std::uint32_t p) {
        check(p == 600);
        ++destroyed;
    }
};

int main(int argc, char **argv) {
    check(argc == 2);
    std::ifstream input(argv[1], std::ios::binary);
    std::vector<unsigned char> bytes((std::istreambuf_iterator<char>(input)), {});
    check(!bytes.empty());
    MajestyRuntimeFeatures::Registry registry;
    std::string error;
    check(MajestyRuntimeFeatures::ParseRegistry(bytes.data(), bytes.size(), &registry, &error));
    check(registry.nameGenerators.size() == 1 && registry.enchantmentRows.size() == 2);
    const auto record = registry.nameGenerators[0];
    for (std::size_t n = 0; n < bytes.size(); ++n) {
        MajestyRuntimeFeatures::Registry partial;
        check(!MajestyRuntimeFeatures::ParseRegistry(bytes.data(), n, &partial, &error));
    }
    using MajestyCommunity::Registration;
    Ops ops;
    check(MajestyCommunity::RegisterNames(ops, 100, 200, record) == Registration::Installed);
    check(ops.memory[500] == 700 && ops.memory[700] == ops.memory[400] && ops.memory[704] == 600);
    check(ops.memory[300] == 400 && ops.destroyed == 0 && ops.constructed == 1);
    check(MajestyCommunity::RegisterNames(ops, 100, 200, record) == Registration::Collision);
    check(ops.constructed == 1);
    Ops notReady;
    notReady.isReady = false;
    check(MajestyCommunity::RegisterNames(notReady, 100, 200, record) == Registration::NotReady);
    check(notReady.constructed == 0);
    Ops missing;
    missing.memory[300] = 0;
    check(MajestyCommunity::RegisterNames(missing, 100, 200, record) == Registration::MissingStock);
    Ops invalid;
    invalid.valid = false;
    check(MajestyCommunity::RegisterNames(invalid, 100, 200, record) ==
          Registration::ConstructionFailed);
    check(invalid.destroyed == 1 && invalid.memory[500] == 0);
    Ops noMemory;
    noMemory.allocate = false;
    check(MajestyCommunity::RegisterNames(noMemory, 100, 200, record) ==
          Registration::AllocationFailed);
    check(noMemory.destroyed == 1 && noMemory.memory[500] == 0);
    return 0;
}
