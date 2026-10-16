#include "controller_dispatch.h"
#include "recruitment_commands.h"
#include <fstream>
#include <iterator>
#include <map>
#include <stdexcept>
#include <vector>

namespace {
void check(bool value) {
    if (!value)
        throw std::runtime_error("private recruitment contract failed");
}
std::vector<unsigned char> file(const char *path) {
    std::ifstream stream(path, std::ios::binary);
    check(bool(stream));
    return {(std::istreambuf_iterator<char>(stream)), {}};
}
struct Ops {
    std::map<std::uint32_t, std::uint32_t> memory;
    std::vector<std::uint32_t> freed;
    unsigned allocations = 0;
    bool failAllocation = false;
    std::uint32_t read(std::uint32_t address) {
        return memory.at(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        memory[address] = value;
    }
    std::uint32_t allocate(std::uint32_t bytes) {
        check(bytes == 68);
        ++allocations;
        return failAllocation ? 0U : 1000U;
    }
    void release(std::uint32_t address) {
        freed.push_back(address);
    }
};
} // namespace

int main(int argc, char **argv) {
    check(argc == 3);
    const auto raw = file(argv[1]), table = file(argv[2]);
    check(raw.size() > 60 && raw[4] == 21);
    MajestyStockControllers::Registry registry;
    std::string error;
    check(MajestyStockControllers::ParseRegistry(raw.data(), raw.size(), &registry, &error));
    check(registry.privateRecruitments.size() == 1 && registry.panels.size() == 1);
    const auto &r = registry.privateRecruitments[0];
    check(r.thirdPriceControlId == 29441 && r.openCommandId == 29442 && r.childDialogId);
    check(registry.buildingOpenToggles.size() == 1);
    const auto &hiring = registry.buildingOpenToggles[0];
    check(hiring.parentControllerBase == 0x32355041 && hiring.openCommandId == 29504 &&
          hiring.closeCommandId == 29505 && hiring.panelDialogId == r.childDialogId);
    using Command = MajestyCommunity::RecruitmentCommand;
    const auto route = [&](std::uint32_t dialog, std::uint32_t command, bool busy = false) {
        return MajestyCommunity::RouteRecruitmentCommand(registry, r, dialog, command, busy);
    };
    for (unsigned i = 0; i < 3; ++i) {
        const std::uint32_t command[] = {0x1f48, 0x1389, 0x1388};
        check(MajestyCommunity::RecruitmentIndex(command[i]) == i);
        check(route(r.parentDialogId, command[i]) == Command::Blocked);
        check(route(r.childDialogId, command[i]) == Command::Stock);
        check(route(r.childDialogId, command[i], true) == Command::Blocked);
    }
    check(route(r.parentDialogId, r.openCommandId) == Command::OpenChild);
    check(route(r.childDialogId, 0x1f4d, true) == Command::ReturnParent);
    for (auto command : {0x1f5bU, 0x1f49U, 0x22ceU, 0x1f47U, 29472U, 0xffffffffU})
        check(route(r.childDialogId, command) == Command::Blocked);
    for (auto command : {0x1f40U, 0x1f41U})
        check(route(r.childDialogId, command, true) == Command::Stock);
    for (auto command : {29504U, 29505U})
        check(route(r.childDialogId, command) == Command::Toggle);
    check(route(r.parentDialogId, 0x1f5b) == Command::Stock);
    check(route(registry.panels[0].childDialogId, 0x1f48) == Command::Blocked);
    auto inlineRecipe = r;
    inlineRecipe.childDialogId = inlineRecipe.openCommandId = 0;
    check(MajestyCommunity::RouteRecruitmentCommand(registry, inlineRecipe, r.parentDialogId,
                                                    0x1388, false) == Command::Stock);
    check(MajestyCommunity::RouteRecruitmentCommand(registry, inlineRecipe, r.parentDialogId,
                                                    0x1388, true) == Command::Blocked);

    // Test the entire table against bytes independently extracted from the
    // hash-pinned executable. Slot 16 must survive, unlike an AP69-sized copy.
    using Dispatch = MajestyCommunity::PrivateControllerDispatch;
    check(table.size() == Dispatch::recruitmentVtable.size() * 4);
    Ops ops;
    ops.memory[100] = 200;
    for (unsigned i = 0; i < Dispatch::recruitmentVtable.size(); ++i) {
        const auto offset = i * 4;
        const auto original = static_cast<std::uint32_t>(table[offset]) |
                              static_cast<std::uint32_t>(table[offset + 1]) << 8 |
                              static_cast<std::uint32_t>(table[offset + 2]) << 16 |
                              static_cast<std::uint32_t>(table[offset + 3]) << 24;
        check(original == Dispatch::recruitmentVtable[i]);
        ops.memory[200 + offset] = original;
    }
    const auto stock = ops.memory;
    Dispatch dispatch;
    for (unsigned i = 0; i < Dispatch::recruitmentVtable.size(); ++i) {
        ops.memory[200 + i * 4] ^= 1;
        check(!dispatch.installRecruitment(ops, 100, 1));
        check(ops.read(100) == 200 && !ops.allocations);
        ops.memory[200 + i * 4] ^= 1;
    }
    check(!dispatch.install(ops, 100, 1)); // AP69 must reject AP52.
    ops.failAllocation = true;
    check(!dispatch.installRecruitment(ops, 100, 1) && ops.read(100) == 200);
    ops.failAllocation = false;
    check(dispatch.installRecruitment(ops, 100, 1));
    const auto entry = dispatch.find(100);
    check(entry.entries == 17 && entry.table == 1000);
    for (unsigned i = 0; i < Dispatch::recruitmentVtable.size(); ++i) {
        check(ops.read(200 + i * 4) == stock.at(200 + i * 4));
        check(ops.read(entry.table + i * 4) == (i == 3   ? Dispatch::controlBridge
                                                : i == 8 ? Dispatch::eventBridge
                                                         : stock.at(200 + i * 4)));
    }
    check(!dispatch.installRecruitment(ops, 100, 2));
    dispatch.destroyed(ops, 100, 2);
    check(dispatch.find(100).table && ops.freed.empty());
    dispatch.clear(ops);
    check(ops.read(100) == 200 && ops.freed.size() == 1);
    check(dispatch.installRecruitment(ops, 100, 2));
    dispatch.destroyed(ops, 100, 1);
    check(dispatch.find(100).generation == 2);
    dispatch.destroyed(ops, 100, 2);
    check(!dispatch.find(100).table && ops.freed.size() == 2);
    return 0;
}
