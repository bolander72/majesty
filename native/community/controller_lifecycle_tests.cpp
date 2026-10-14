#include "controller_lifecycle.h"
#include "controller_dispatch.h"
#include "resource_meter.h"
#include "research_descriptors.h"
#include "research_activity.h"
#include <fstream>
#include <iterator>
#include <stdexcept>
#include <vector>
#include <map>

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
struct DispatchOps {
    std::map<std::uint32_t, std::uint32_t> memory;
    std::vector<std::uint32_t> freed;
    std::uint32_t next = 1000;
    bool allocationFails = false;
    std::uint32_t read(std::uint32_t address) {
        return memory.at(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        memory[address] = value;
    }
    std::uint32_t allocate(std::uint32_t bytes) {
        check(bytes == 44);
        if (allocationFails)
            return 0;
        const auto address = next;
        next += bytes;
        return address;
    }
    void release(std::uint32_t address) {
        freed.push_back(address);
    }
};

struct ResearchOps : DispatchOps {
    std::map<std::uint32_t, std::uint32_t> descriptors;
    std::uint32_t lookup(std::uint32_t id) {
        return descriptors.count(id) ? descriptors.at(id) : 0;
    }
    std::uint32_t allocate(std::uint32_t bytes) {
        check(bytes == 20);
        if (allocationFails)
            return 0;
        const auto result = next;
        next += bytes;
        return result;
    }
    bool insert(std::uint32_t id, std::uint32_t value) {
        if (lookup(id))
            return false;
        descriptors[id] = value;
        return true;
    }
};

int main(int argc, char **argv) {
    struct ActivityOps {
        MajestyCommunity::BuildingActivity activity{8000, 100, 12000};
        MajestyCommunity::BuildingActivity capture(std::uint32_t unit) {
            check(unit == 300);
            return activity;
        }
        void restore(std::uint32_t unit, MajestyCommunity::BuildingActivity value) {
            check(unit == 300);
            activity = value;
        }
    } activityOps;
    MajestyCommunity::ResearchActivity activityOwner;
    const auto recruitment = activityOps.activity;
    check(!activityOwner.begin(0, 10771));
    check(activityOwner.begin(300, 10771));
    check(!activityOwner.begin(301, 10774));
    // An unrelated update or incomplete tuple must not steal recruitment.
    check(!activityOwner.capture(activityOps, recruitment));
    activityOps.activity = {10771, 200, 0};
    check(!activityOwner.capture(activityOps, recruitment));
    activityOps.activity = {10771, 200, 30000};
    check(activityOwner.capture(activityOps, recruitment));
    check(activityOps.activity.command == 8000 && activityOps.activity.duration == 12000);
    unsigned completionCalls = 0;
    auto completion = [&] {
        ++completionCalls;
        check(activityOps.activity.command == 10771 && activityOps.activity.startedAt == 200);
        activityOps.activity = {};
    };
    check(!activityOwner.complete(activityOps, 301, 2, completion));
    check(!activityOwner.complete(activityOps, 300, 1, completion));
    check(completionCalls == 0);
    // A native callback that leaves the order active must retain its owner.
    check(activityOwner.complete(activityOps, 300, 2, [] {}));
    check(activityOwner.phase() == MajestyCommunity::ResearchActivity::Phase::Active);
    check(activityOps.activity.command == 8000);
    check(activityOwner.complete(activityOps, 300, 2, completion));
    check(completionCalls == 1 &&
          activityOwner.phase() == MajestyCommunity::ResearchActivity::Phase::Idle);
    check(activityOps.activity.command == 8000 && activityOps.activity.startedAt == 100);
    check(!activityOwner.complete(activityOps, 300, 2, completion));
    check(!MajestyCommunity::ResearchRowsNeedRefresh(0, 0));
    check(MajestyCommunity::ResearchRowsNeedRefresh(0, 0x00505041U));
    check(!MajestyCommunity::ResearchRowsNeedRefresh(1, 0x00505041U));
    check(MajestyCommunity::ResearchRowsNeedRefresh(1, 0x2c425041U));
    check(MajestyCommunity::ResearchRowsNeedRefresh(1, 0x02425041U));
    check(MajestyCommunity::ResearchRowsNeedRefresh(7, 0x18000000U));
    check(MajestyCommunity::ResearchRowsNeedRefresh(7, 0x2b000000U));
    check(!MajestyCommunity::ResearchRowsNeedRefresh(7, 0x2b000001U));
    DispatchOps dispatchOps;
    dispatchOps.memory[100] = 200;
    const std::uint32_t original[] = {0x0047a360U, 0x0047a760U, 3,           0x0047a790U, 5, 6,
                                      7,           8,           0x0047aae0U, 10,          11};
    for (unsigned i = 0; i < 11; ++i)
        dispatchOps.memory[200 + i * 4] = original[i];
    MajestyCommunity::PrivateControllerDispatch dispatch;
    dispatchOps.allocationFails = true;
    check(!dispatch.install(dispatchOps, 100, 1) && dispatchOps.read(100) == 200);
    dispatchOps.allocationFails = false;
    check(dispatch.install(dispatchOps, 100, 1));
    const auto clone = dispatch.find(100).table;
    for (unsigned i = 0; i < 11; ++i) {
        check(dispatchOps.read(200 + i * 4) == original[i]);
        check(dispatchOps.read(clone + i * 4) == (i == 3   ? dispatch.controlBridge
                                                  : i == 8 ? dispatch.eventBridge
                                                           : original[i]));
    }
    check(!dispatch.install(dispatchOps, 100, 2));
    dispatch.destroyed(dispatchOps, 100, 2);
    check(dispatch.find(100).table == clone && dispatchOps.freed.empty());
    dispatch.destroyed(dispatchOps, 100, 1);
    check(!dispatch.find(100).table && dispatchOps.freed.size() == 1);
    dispatchOps.memory[100] = 200;
    check(dispatch.install(dispatchOps, 100, 2));
    const auto replacementDispatch = dispatch.find(100).table;
    dispatch.destroyed(dispatchOps, 100, 1);
    check(dispatch.find(100).table == replacementDispatch);
    dispatch.clear(dispatchOps);
    check(dispatchOps.read(100) == 200 && dispatchOps.freed.size() == 2);
    dispatchOps.memory[200 + 12] = 0;
    check(!dispatch.install(dispatchOps, 100, 3) && dispatchOps.read(100) == 200);
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
    ResearchOps researchOps;
    for (const auto &row : registry.researchRows) {
        for (const auto id : {row.descriptorTemplateControlId, row.completionTemplateControlId}) {
            if (researchOps.lookup(id))
                continue;
            const auto address = researchOps.allocate(20);
            researchOps.descriptors[id] = address;
            for (unsigned i = 0; i < 5; ++i)
                researchOps.memory[address + i * 4] = id * 10 + i + 1;
        }
    }
    const auto beforeTemplates = researchOps.memory;
    MajestyCommunity::ResearchDescriptors research;
    researchOps.allocationFails = true;
    check(!research.prepare(researchOps, registry.researchRows));
    for (const auto &row : registry.researchRows)
        check(!researchOps.lookup(row.actionControlId));
    researchOps.allocationFails = false;
    check(research.prepare(researchOps, registry.researchRows));
    for (const auto &row : registry.researchRows) {
        const auto descriptorClone = researchOps.lookup(row.actionControlId);
        const auto source = researchOps.lookup(row.descriptorTemplateControlId);
        const auto completion = researchOps.lookup(row.completionTemplateControlId);
        check(researchOps.read(descriptorClone) == beforeTemplates.at(source));
        check(researchOps.read(descriptorClone + 4) == row.requiredLevel);
        check(researchOps.read(descriptorClone + 8) == row.price);
        check(researchOps.read(descriptorClone + 12) == beforeTemplates.at(source + 12));
        check(researchOps.read(descriptorClone + 16) == beforeTemplates.at(completion + 16));
        for (unsigned i = 0; i < 5; ++i)
            check(researchOps.read(source + i * 4) == beforeTemplates.at(source + i * 4));
    }
    const auto firstClone = researchOps.lookup(registry.researchRows[0].actionControlId);
    check(research.prepare(researchOps, registry.researchRows));
    check(researchOps.lookup(registry.researchRows[0].actionControlId) == firstClone);
    researchOps.descriptors[registry.researchRows[0].actionControlId] = 9999;
    check(!research.prepare(researchOps, registry.researchRows));
    for (const auto &row : registry.researchRows)
        researchOps.descriptors.erase(row.actionControlId);
    check(research.prepare(researchOps, registry.researchRows));
    check(researchOps.lookup(registry.researchRows[0].actionControlId) != firstClone);
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
