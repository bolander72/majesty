#include "controller_lifecycle.h"
#include "resource_meter.h"
#include <fstream>
#include <iterator>
#include <stdexcept>
#include <vector>

void check(bool value) {
    if (!value)
        throw std::runtime_error("community controller fixture failed");
}

struct MeterOps {
    bool hasUnit = true, hasWindow = true;
    std::int32_t stock = 23;
    unsigned reads = 0, visibleCalls = 0, integerCalls = 0;
    std::int32_t shownStock = -1;
    std::uint32_t unit(std::uint32_t controller) {
        check(controller == 101);
        return hasUnit ? 300U : 0U;
    }
    std::uint32_t window(std::uint32_t controller) {
        check(controller == 101);
        return hasWindow ? 201U : 0U;
    }
    std::int32_t attribute(std::uint32_t unit, std::uint32_t id) {
        check(unit == 300 && id == 0x30565041U);
        ++reads;
        return stock;
    }
    void visible(std::uint32_t window, std::uint32_t control, bool shown) {
        check(window == 201 && shown && (control == 10787 || control == 10788));
        ++visibleCalls;
    }
    void integer(std::uint32_t window, std::uint32_t control, std::int32_t value) {
        check(window == 201 && control == 10789);
        ++integerCalls;
        shownStock = value;
    }
};

int main(int argc, char **argv) {
    check(argc == 2);
    std::ifstream input(argv[1], std::ios::binary);
    const std::vector<unsigned char> bytes((std::istreambuf_iterator<char>(input)), {});
    check(bytes.size() > 44 && bytes[4] == 20);
    MajestyStockControllers::Registry registry;
    std::string error;
    check(MajestyStockControllers::ParseRegistry(bytes.data(), bytes.size(), &registry, &error));
    check(registry.panels.size() == 1 && registry.meters.size() == 1 &&
          registry.researchRows.size() == 2 && registry.upgradeGates.size() == 1 &&
          registry.timedRageActions.size() == 1 && registry.rageCommandActions.size() == 1 &&
          registry.sovereignTargetActions.size() == 1);
    const auto &panel = registry.panels[0];
    check(panel.panelKey == "brewing" && panel.parentDialogId == 0x31304743U &&
          panel.childDialogId == 0x32304743U && panel.buildingFamilyId == 0x00424c41U &&
          panel.openCommandId == 8009);
    check(registry.meters[0].resourceKey == "reagents" &&
          registry.meters[0].attributeId == 0x30565041U);
    check(registry.timedRageActions[0].goldCost == 1500 &&
          registry.timedRageActions[0].resourceCost == 1 &&
          registry.timedRageActions[0].durationMs == 30000);
    check(registry.rageCommandActions[0].resourceCost == 10 &&
          registry.sovereignTargetActions[0].resourceCost == 10 &&
          registry.sovereignTargetActions[0].sourceTargetCallback == "Philosophers_Stone_Hit");
    for (std::size_t n = 0; n < bytes.size(); ++n) {
        MajestyStockControllers::Registry partial;
        check(!MajestyStockControllers::ParseRegistry(bytes.data(), n, &partial, &error));
    }
    auto trailing = bytes;
    trailing.push_back(0);
    check(!MajestyStockControllers::ParseRegistry(trailing.data(), trailing.size(), &registry,
                                                  &error));
    check(MajestyStockControllers::ParseRegistry(bytes.data(), bytes.size(), &registry, &error));

    MajestyCommunity::PanelLifecycle lifecycle(registry);
    check(lifecycle.selector(0x31304743U) == 0x30315041U);
    check(lifecycle.selector(0x32304743U) == 0x39365041U);
    for (const auto stock : {0x31305041U, 0x30315041U, 0x39365041U, 0x30394743U})
        check(lifecycle.selector(stock) == stock);
    check(!lifecycle.capture(100, 0x30315041U, 200, 300));
    check(!lifecycle.capture(0, 0x31304743U, 200, 300));
    check(!lifecycle.capture(100, 0x31304743U, 0, 300));
    check(!lifecycle.capture(100, 0x31304743U, 200, 0));
    check(lifecycle.capture(100, 0x31304743U, 200, 300));
    const auto parent = lifecycle.find(100);
    check(parent.parent && parent.window == 200 && parent.context == 300);
    check(lifecycle.child(100, 8009, 0x00424c41U) == 0x32304743U);
    check(lifecycle.child(100, 8008, 0x00424c41U) == 0);
    check(lifecycle.child(100, 8009, 0x00514241U) == 0);
    check(lifecycle.child(999, 8009, 0x00424c41U) == 0);
    check(lifecycle.capture(101, 0x32304743U, 201, 300));
    check(!lifecycle.find(101).parent);
    check(lifecycle.child(101, 8009, 0x00424c41U) == 0);
    MeterOps meter;
    check(MajestyCommunity::PresentResourceMeter(meter, 101, registry.meters[0]));
    check(meter.reads == 1 && meter.visibleCalls == 2 && meter.integerCalls == 1 &&
          meter.stock == 23 && meter.shownStock == 23);
    meter.stock = -9;
    check(MajestyCommunity::PresentResourceMeter(meter, 101, registry.meters[0]));
    check(meter.stock == -9 && meter.shownStock == 0);
    MeterOps missingUnit;
    missingUnit.hasUnit = false;
    check(!MajestyCommunity::PresentResourceMeter(missingUnit, 101, registry.meters[0]));
    check(missingUnit.reads == 0 && missingUnit.visibleCalls == 0 && missingUnit.integerCalls == 0);
    MeterOps missingWindow;
    missingWindow.hasWindow = false;
    check(!MajestyCommunity::PresentResourceMeter(missingWindow, 101, registry.meters[0]));
    check(missingWindow.reads == 0 && missingWindow.visibleCalls == 0 &&
          missingWindow.integerCalls == 0);
    lifecycle.destroyed(101, lifecycle.find(101).generation);
    check(!lifecycle.find(101).recipe && lifecycle.find(100).recipe);
    // Native teardown can call back into panel creation. Its delayed completion
    // must not clear a new tracked object at the reused guest address.
    check(lifecycle.capture(100, 0x31304743U, 202, 301));
    const auto replacement = lifecycle.find(100);
    check(replacement.generation != parent.generation);
    lifecycle.destroyed(100, parent.generation);
    check(lifecycle.find(100).window == 202 && lifecycle.find(100).context == 301);
    lifecycle.destroyed(100, replacement.generation);
    check(!lifecycle.find(100).recipe && lifecycle.child(100, 8009, 0x00424c41U) == 0);
    return 0;
}
