#include "recruitment_panel_owner.h"
#include <fstream>
#include <functional>
#include <iterator>
#include <stdexcept>
#include <vector>

namespace {
using namespace MajestyCommunity;
void check(bool value) {
    if (!value)
        throw std::runtime_error("private recruitment ownership failed");
}
std::vector<unsigned char> file(const char *path) {
    std::ifstream stream(path, std::ios::binary);
    check(bool(stream));
    return {(std::istreambuf_iterator<char>(stream)), {}};
}
struct Ops {
    RecruitmentPanelOwner *owner = nullptr;
    std::map<std::uint32_t, std::uint32_t> memory, units;
    std::map<std::uint32_t, bool> visibility;
    std::vector<PrivateTemplateBridge> presented;
    std::vector<std::uint32_t> disabled, freed, ordered;
    std::function<void()> eventAction;
    unsigned extrasCount = 0, allocations = 0, tooltips = 0, stockTooltips = 0, toggles = 0;
    std::uint32_t next = 10000;
    bool busy = false, failAllocation = false;
    bool valid(std::uint32_t address, std::uint32_t) {
        return address && memory.count(address);
    }
    std::uint32_t read(std::uint32_t address) {
        return memory.at(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        memory[address] = value;
    }
    std::uint32_t allocate(std::uint32_t bytes) {
        check(bytes == 68);
        ++allocations;
        if (failAllocation)
            return 0;
        const auto result = next;
        next += 128;
        return result;
    }
    void release(std::uint32_t address) {
        freed.push_back(address);
    }
    std::uint32_t unit(std::uint32_t controller) {
        return units.at(controller);
    }
    bool researchBusy(std::uint32_t unit) {
        check(unit == 5000);
        return busy;
    }
    void present(const RecruitmentPanelSession &s, PrivateTemplateBridge bridge) {
        if (bridge == PrivateTemplateBridge::Setup && s.child)
            check(read(s.controller + 0x20) == 1 && read(s.controller + 0x30) == 0xabcdef);
        presented.push_back(bridge);
    }
    void visible(const RecruitmentPanelSession &, std::uint32_t id, bool value) {
        visibility[id] = value;
    }
    void disable(const RecruitmentPanelSession &, std::uint32_t id) {
        disabled.push_back(id);
    }
    void extras(const RecruitmentPanelSession &) {
        ++extrasCount;
    }
    bool researchCommand(const RecruitmentPanelSession &, std::uint32_t command) {
        return command == 29472;
    }
    std::uint32_t stockControl(const RecruitmentPanelSession &, std::uint32_t command) {
        ordered.push_back(command);
        return 23;
    }
    std::uint32_t openChild(const RecruitmentPanelSession &s) {
        check(!s.child && s.unit == 5000);
        return 24;
    }
    std::uint32_t returnParent(const RecruitmentPanelSession &s) {
        check(s.child && s.unit == 5000);
        return 25;
    }
    std::uint32_t toggle(const RecruitmentPanelSession &s, std::uint32_t command) {
        check(s.child && (command == 29504 || command == 29505));
        ++toggles;
        return 26;
    }
    std::uint32_t describe(const RecruitmentPanelSession &, unsigned index, std::uint32_t command,
                           std::uint32_t argument, std::uint32_t text) {
        check(RecruitmentIndex(command) == index && argument == 77 && text == 88);
        ++tooltips;
        return index + 1;
    }
    std::uint32_t stockTooltip(const RecruitmentPanelSession &, std::uint32_t, std::uint32_t,
                               std::uint32_t) {
        ++stockTooltips;
        return 7;
    }
    void nativeEvent(const RecruitmentPanelSession &, const std::array<std::uint32_t, 4> &args) {
        check(args[0] == 11 && args[1] == 22 && args[3] == 44);
        if (eventAction)
            eventAction();
    }
    std::uint32_t stockDestroy(const RecruitmentPanelSession &s, std::uint32_t flags) {
        check(flags == 1 && read(s.controller) == s.original && !owner->find(s.controller).recipe);
        return 27;
    }
    void makeController(std::uint32_t controller) {
        write(controller, 2000);
        write(controller + 0x14, controller + 1000);
        write(controller + 0x18, 915); // opaque ID, deliberately not a unit pointer
        write(controller + 0x20, 0);
        write(controller + 0x30, 0xabcdef); // would corrupt adjacent data in Old
        units[controller] = 5000;
    }
};
} // namespace

int main(int argc, char **argv) {
    check(argc == 3);
    const auto registryBytes = file(argv[1]), tableBytes = file(argv[2]);
    MajestyStockControllers::Registry registry;
    std::string error;
    check(MajestyStockControllers::ParseRegistry(registryBytes.data(), registryBytes.size(),
                                                 &registry, &error));
    check(registry.privateRecruitments.size() == 1 && tableBytes.size() == 68);
    const auto &recipe = registry.privateRecruitments[0];
    RecruitmentPanelOwner owner(registry);
    check(owner.selector(recipe.parentDialogId) == 0x32355041);
    check(owner.selector(recipe.childDialogId) == 0x32355041);
    check(owner.selector(registry.panels[0].parentDialogId) == registry.panels[0].parentDialogId);
    Ops ops;
    ops.owner = &owner;
    for (unsigned offset = 0; offset < tableBytes.size(); offset += 4) {
        const auto original = static_cast<std::uint32_t>(tableBytes[offset]) |
                              static_cast<std::uint32_t>(tableBytes[offset + 1]) << 8 |
                              static_cast<std::uint32_t>(tableBytes[offset + 2]) << 16 |
                              static_cast<std::uint32_t>(tableBytes[offset + 3]) << 24;
        ops.write(2000 + offset, original);
    }
    ops.write(5000, 6000);
    ops.write(5000 + 0x60, 915);
    ops.write(5000 + 0x80, 7000);
    ops.write(7000, 0);
    ops.write(7000 + 4, 0x31744241); // ABt1
    ops.makeController(100);
    ops.makeController(300);
    const std::array<std::uint32_t, recruitmentPanelEntryCount> bridges = {8000, 8016, 8032, 8048,
                                                                           8064, 8080, 8096};
    const auto attach = [&](std::uint32_t controller, std::uint32_t dialog) {
        return owner.attach(ops, controller, dialog, controller + 1000, 915, 0x744241, bridges);
    };
    check(!owner.attach(ops, 100, recipe.parentDialogId, 1100, 915, 0x754241, bridges));
    check(!ops.allocations);
    // Refuse any wrong native class before creating private ownership.
    ops.memory[2000 + 16 * 4] ^= 1;
    check(!attach(100, recipe.parentDialogId) && !ops.allocations);
    ops.memory[2000 + 16 * 4] ^= 1;
    ops.failAllocation = true;
    check(!attach(100, recipe.parentDialogId) && ops.read(100) == 2000);
    ops.failAllocation = false;
    check(attach(100, recipe.parentDialogId) && attach(300, recipe.childDialogId));
    const auto parent = owner.find(100), child = owner.find(300);
    check(parent.generation != child.generation && !attach(100, recipe.parentDialogId));
    for (unsigned i = 0; i < 17; ++i) {
        check(ops.read(2000 + i * 4) == PrivateControllerDispatch::recruitmentVtable[i]);
        if (i != 0 && i != 1 && i != 2 && i != 3 && i != 8 && i != 13 && i != 16)
            check(ops.read(child.table + i * 4) == ops.read(2000 + i * 4));
    }
    owner.setup(ops, 300);
    check(ops.extrasCount == 1 && ops.presented.back() == PrivateTemplateBridge::Setup);
    ops.presented.clear();
    owner.refresh(ops, 100);
    check(ops.presented.empty() && ops.visibility.size() == 8);
    check(owner.control(ops, 100, recipe.openCommandId) == 24);
    for (auto command : {0x1f48U, 0x1389U, 0x1388U}) {
        check(owner.control(ops, 100, command) == 0 && ops.ordered.empty());
        check(owner.tooltip(ops, 100, command, 77, 88) == 0 && !ops.tooltips);
    }
    owner.counts(ops, 300);
    check(ops.presented.empty());
    owner.counts(ops, 100);
    check(ops.presented.back() == PrivateTemplateBridge::Counts);
    ops.presented.clear();
    ops.busy = true;
    owner.refresh(ops, 300);
    check(ops.presented.empty() && ops.disabled.size() == 3);
    for (auto command : {0x1f48U, 0x1389U, 0x1388U}) {
        check(owner.control(ops, 300, command) == 0 && ops.ordered.empty());
        check(owner.tooltip(ops, 300, command, 77, 88) == 0 && !ops.tooltips);
    }
    check(owner.control(ops, 300, 0x1f4d) == 25);
    for (auto command : {0x1f5bU, 0x1f47U, 29472U, 0x22ceU})
        check(owner.control(ops, 300, command) == 0 && ops.ordered.empty());
    check(owner.control(ops, 300, 29504) == 26 && owner.control(ops, 300, 29505) == 26);
    check(ops.toggles == 2);
    ops.busy = false;
    owner.refresh(ops, 300);
    check(ops.presented.back() == PrivateTemplateBridge::RefreshAll);
    for (auto command : {0x1f48U, 0x1389U, 0x1388U}) {
        check(owner.control(ops, 300, command) == 23 && ops.ordered.back() == command);
        check(owner.tooltip(ops, 300, command, 77, 88) == RecruitmentIndex(command) + 1);
    }
    // Parent teardown does not clear the surviving child's native context.
    check(owner.destroy(ops, 100, 1) == 27 && ops.freed.size() == 1);
    check(owner.alive(ops, child) && owner.control(ops, 300, 0x1f4d) == 25);
    ops.makeController(100);
    check(attach(100, recipe.parentDialogId));
    check(!owner.alive(ops, parent));
    ops.presented.clear();
    owner.event(ops, 100, {11, 22, 0x00425041, 44});
    check(ops.presented == std::vector<PrivateTemplateBridge>{PrivateTemplateBridge::Counts});
    ops.presented.clear();
    owner.event(ops, 300, {11, 22, 0x00425041, 44});
    check(ops.presented == std::vector<PrivateTemplateBridge>{PrivateTemplateBridge::RefreshAll});
    ops.eventAction = [&] { check(owner.destroy(ops, 300, 1) == 27); };
    const auto before = ops.extrasCount;
    ops.presented.clear();
    owner.event(ops, 300, {11, 22, 0x00425041, 44});
    check(ops.presented.empty() && ops.extrasCount == before && !owner.find(300).recipe);
    // The same pointer/owner/player is insufficient if the actor was recycled.
    ops.memory[5000 + 0x60] = 916;
    const auto orders = ops.ordered.size();
    check(owner.control(ops, 100, 0x1f5b) == 0 && ops.ordered.size() == orders);
    check(owner.destroy(ops, 100, 1) == 27 && ops.freed.size() == 3);
    ops.memory[5000 + 0x60] = 917;
    ops.makeController(100);
    ops.makeController(300);
    check(attach(100, recipe.parentDialogId) && attach(300, recipe.childDialogId));
    owner.clear(ops);
    check(ops.read(100) == 2000 && ops.read(300) == 2000 && ops.freed.size() == 5);
    check(!owner.find(100).recipe && !owner.find(300).recipe);
    check(attach(100, recipe.parentDialogId));
    owner.clear(ops);
    return 0;
}
