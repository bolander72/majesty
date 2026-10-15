// Private live-guest qualification through the official mod API; not a public
// content build.
#include "RuntimeFeatureRegistry.h"
#include "controller_lifecycle.h"
#include "controller_dispatch.h"
#include "name_registration.h"
#include "pop_mod_api.h"
#include "resource_meter.h"
#include "research_descriptors.h"
#include "research_activity.h"
#include "rage_dispatch.h"
#include "upgrade_research_gate.h"
#include "map_selection_identity.h"
#include "fog_reveal_identity.h"
#include <algorithm>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <sstream>
#include <vector>

POP_MOD_DECLARE_ABI();
namespace {
const PopModApi *host = nullptr;
MajestyRuntimeFeatures::Registry features;
MajestyStockControllers::Registry recipes;
MajestyCommunity::PanelLifecycle lifecycle(recipes);
MajestyCommunity::PrivateControllerDispatch privateDispatch;
MajestyCommunity::ResearchDescriptors researchDescriptors;
MajestyCommunity::ResearchActivity researchActivity;
std::uint32_t scratch = 0;
std::vector<std::uint32_t> hooks;
bool traceRecruitment = false;
bool attributeCompat = false;
bool panelBridge = false;
MajestyCommunity::MapSelectionIdentity mapSelection;
bool researchBridge = false;
bool traceCombat = false;
bool actionBridge = false;
bool targetBridge = false;
unsigned targetBeginDepth = 0;
struct TargetOwner {
    const MajestyStockControllers::SovereignTargetActionRecord *action = nullptr;
    std::uint32_t unit = 0, identity = 0;
} targetOwner;
struct TargetExecution {
    const MajestyStockControllers::SovereignTargetActionRecord *action = nullptr;
    std::uint32_t source = 0, clicked = 0, player = 0, spawned = 0;
    bool invoked = false;
} targetExecution;
std::vector<std::uint32_t> targetSpawnMethods;
std::map<std::uint32_t, std::uint32_t> targetDescriptors;
void hook(const PopModApi *, pop_cpu_v1 *, PopHookInvocation *, void *);
bool sharedFunctions = false;
unsigned sharedLookupDepth = 0;
std::map<std::string, std::string> sharedAliases;
std::map<std::pair<std::uint32_t, std::string>, std::uint32_t> sharedResolved;
std::string folded(std::string value) {
    for (auto &ch : value)
        if (ch >= 'A' && ch <= 'Z')
            ch += 'a' - 'A';
    return value;
}
MajestyCommunity::RageDispatch rageDispatch;
struct TimedAction {
    std::uint32_t unit = 0, control = 0, started = 0, duration = 0;
} timedAction;
bool controlledParty = false, controlledPartyApplied = false;
bool controlledStock = false, controlledStockApplied = false;
bool controlledDeath = false, controlledDeathApplied = false;
std::uint32_t controlledDeathUnit = 0, controlledDeathClock = 0, controlledDeathDelay = 0;
bool controlledTarget = false, controlledTargetApplied = false;
bool researchCompletionStaged = false;
std::uint32_t researchController = 0;
std::uint64_t researchControllerGeneration = 0;
std::uint32_t attributeFunction = 0;
bool traceArmed = false;
unsigned traceCalls = 0;
unsigned traceOperators = 0;
unsigned traceValues = 0;
std::vector<std::string> missingFunctions;
void require(bool ok, const char *why) {
    if (!ok) {
        std::fprintf(stderr, "[alchemist-native-probe] refused: %s\n", why);
        std::abort();
    }
}
std::uint32_t read(std::uint32_t a) {
    std::uint32_t v = 0;
    require(host->guest_read_u32(host, a, &v) == POP_OK, "guest read");
    return v;
}
void write(std::uint32_t a, std::uint32_t v) {
    require(host->guest_write_u32(host, a, v) == POP_OK, "guest write");
}
std::uint32_t call(std::uint32_t a, std::uint32_t self,
                   std::initializer_list<std::uint32_t> args = {}) {
    std::uint32_t v = 0;
    require(host->guest_call(host, a, self, args.begin(), static_cast<std::uint32_t>(args.size()),
                             &v) == POP_OK,
            "original guest call");
    return v;
}
void next(PopHookInvocation *inv, pop_cpu_v1 *cpu) {
    require(host->call_next(host, inv, cpu) == POP_OK, "original hook continuation");
}
void returned(pop_cpu_v1 *cpu, std::uint32_t value) {
    require(host->hook_return(host, cpu, value, 4) == POP_OK, "original ret4 discipline");
}
struct DispatchOps {
    std::uint32_t read(std::uint32_t address) {
        return ::read(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        ::write(address, value);
    }
    std::uint32_t allocate(std::uint32_t bytes) {
        std::uint32_t address = 0;
        return host->guest_alloc(host, bytes, &address) == POP_OK ? address : 0;
    }
    void release(std::uint32_t address) {
        require(host->guest_free(host, address) == POP_OK, "private dispatch release");
    }
};
struct ResearchOps {
    std::uint32_t unit(std::uint32_t controller) {
        return ::call(0x00481ec0U, controller);
    }
    std::uint32_t call(std::uint32_t address, std::uint32_t self,
                       std::initializer_list<std::uint32_t> args) {
        return ::call(address, self, args);
    }
    std::uint32_t fixedScale() {
        ::call(0x0051f310U, scratch + 220, {0x006d81c8U});
        return ::read(scratch + 220);
    }
    std::uint32_t read(std::uint32_t address) {
        return ::read(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        ::write(address, value);
    }
    std::uint32_t lookup(std::uint32_t id) {
        write(scratch + 208, id);
        call(0x00475390U, 0x006d81d0U, {scratch + 212, scratch + 208});
        const auto node = read(scratch + 212);
        return node == read(0x006d81d4U) ? 0 : read(node + 16);
    }
    std::uint32_t allocate(std::uint32_t bytes) {
        return call(0x0064c616U, 0, {bytes});
    }
    void release(std::uint32_t address) {
        call(0x00645bc0U, 0, {address});
    }
    bool insert(std::uint32_t id, std::uint32_t descriptor) {
        if (lookup(id))
            return false;
        write(scratch + 208, id);
        const auto slot = call(0x00475270U, 0x006d81d0U, {scratch + 208});
        if (!slot || read(slot))
            return false;
        write(slot, descriptor);
        return lookup(id) == descriptor;
    }
};
struct ActivityOps {
    MajestyCommunity::BuildingActivity capture(std::uint32_t unit) {
        return {call(0x005a1c40U, unit, {0x2c425041U, 0}),
                call(0x005a1c40U, unit, {0x38425041U, 0}),
                call(0x005a1c40U, unit, {0x0d425041U, 0})};
    }
    void restore(std::uint32_t unit, const MajestyCommunity::BuildingActivity &activity) {
        const auto setter = read(read(unit) + 0x124);
        call(setter, unit, {0x2c425041U, activity.command});
        call(setter, unit, {0x38425041U, activity.startedAt});
        call(setter, unit, {0x0d425041U, activity.duration});
    }
};
struct UpgradeOps {
    std::uint32_t completionAttribute(std::uint32_t action, std::uint32_t stockTemplate) {
        if (!(read(0x006d81e0U) & 0xff))
            call(0x004736a0U, 0);
        ResearchOps ops;
        auto descriptor = ops.lookup(action);
        if (!descriptor)
            descriptor = call(0x00474480U, 0, {stockTemplate});
        return descriptor ? read(descriptor + 16) : 0;
    }
    bool complete(std::uint32_t unit, std::uint32_t attribute) {
        return call(0x005a1c40U, unit, {attribute, 0}) != 0;
    }
};
std::vector<unsigned char> file(const char *name, std::size_t limit) {
    std::ifstream in(std::string(host->mod_dir(host)) + "/" + name,
                     std::ios::binary | std::ios::ate);
    require(in.good(), "owned registry missing");
    const auto n = in.tellg();
    require(n > 0 && static_cast<std::size_t>(n) <= limit, "registry size");
    in.seekg(0);
    std::vector<unsigned char> bytes(static_cast<std::size_t>(n));
    in.read(reinterpret_cast<char *>(bytes.data()), n);
    require(in.good(), "registry incomplete");
    return bytes;
}
struct NameOps {
    bool ready(std::uint32_t p) {
        return read(p + 0x14) == 1;
    }
    std::uint32_t read(std::uint32_t a) {
        return ::read(a);
    }
    void write(std::uint32_t a, std::uint32_t v) {
        ::write(a, v);
    }
    std::uint32_t slot(std::uint32_t p, std::uint32_t id) {
        write(scratch, id);
        write(scratch + 4, 0);
        call(0x004cf220U, p + 4, {scratch + 16, scratch});
        const auto n = read(scratch + 16);
        return n ? n + 0x10 : 0;
    }
    std::uint32_t construct(const MajestyRuntimeFeatures::NameGeneratorRecord &r,
                            std::uint32_t resources) {
        return call(
            0x004ca470U, call(0x004ca050U, 0),
            {r.namePartIds[0], r.namePartIds[1], r.namePartIds[2], r.namePartIds[3], resources});
    }
    bool valid_generator(std::uint32_t p) {
        return read(p + 4) && read(p + 8) && read(p + 12) && read(p + 16);
    }
    std::uint32_t allocate_wrapper() {
        return call(0x0064c616U, 0, {8});
    }
    void destroy_generator(std::uint32_t p) {
        call(read(read(p)), p, {1});
    }
};
struct MeterOps {
    std::uint32_t unit(std::uint32_t p) {
        return call(0x00481ec0U, p);
    }
    std::uint32_t window(std::uint32_t p) {
        return read(p + 0x14);
    }
    std::int32_t attribute(std::uint32_t p, std::uint32_t id) {
        return static_cast<std::int32_t>(call(0x005a1c40U, p, {id, 0}));
    }
    void visible(std::uint32_t p, std::uint32_t id, bool show) {
        call(read(read(p) + 0x20), p, {id, show ? 1U : 0U});
    }
    void integer(std::uint32_t p, std::uint32_t id, std::int32_t v) {
        call(read(read(p) + 0x5c), p, {id, static_cast<std::uint32_t>(v), 0});
    }
};
void meter(std::uint32_t p, std::uint64_t generation) {
    const auto s = lifecycle.find(p);
    if (!s.recipe || s.parent || s.generation != generation)
        return;
    MeterOps ops;
    for (const auto &r : recipes.meters)
        if (r.panelKey == s.recipe->panelKey)
            MajestyCommunity::PresentResourceMeter(ops, p, r);
}
bool upgradeAllowed(std::uint32_t controller, std::uint64_t generation) {
    const auto session = lifecycle.find(controller);
    if (!panelBridge || !session.recipe || !session.parent || session.generation != generation)
        return true;
    const auto unit = call(0x00481ec0U, controller);
    const auto kindLevel = unit ? read(unit + 0x6c) >> 24 : 0;
    const auto level = kindLevel >= '1' && kindLevel <= '3' ? kindLevel - '0' : 0;
    UpgradeOps ops;
    const bool allowed = MajestyCommunity::UpgradeResearchComplete(
        ops, recipes, session.recipe->panelKey, level, unit);
    static unsigned reports = 0;
    if (reports++ < 4)
        std::fprintf(stderr, "[alchemist-upgrade] unit=%08x level=%u research-complete=%d\n", unit,
                     level, allowed);
    return allowed;
}
void upgradePresentation(std::uint32_t controller, std::uint64_t generation) {
    if (upgradeAllowed(controller, generation))
        return;
    const auto session = lifecycle.find(controller);
    const auto window = read(controller + 0x14);
    if (!window)
        return;
    MeterOps ops;
    for (const auto &gate : recipes.upgradeGates)
        if (gate.panelKey == session.recipe->panelKey) {
            call(read(read(window) + 0x68), window, {gate.upgradeControlId, 0x0a, 1, 0});
            ops.visible(window, gate.upgradePriceControlId, false);
        }
}
std::uint32_t actionPalace(std::uint32_t unit) {
    return call(0x00418b50U, call(0x00415b40U, 0), {read(unit + 0x70)});
}
std::int32_t actionStock(std::uint32_t unit, const std::string &panel,
                         const std::string &resource) {
    MeterOps ops;
    for (const auto &meter : recipes.meters)
        if (meter.panelKey == panel && meter.resourceKey == resource)
            return ops.attribute(unit, meter.attributeId);
    return -1;
}
bool targetReadyForPlayer(std::uint32_t unit,
                          const MajestyStockControllers::SovereignTargetActionRecord &action,
                          std::uint32_t player) {
    if (!unit || (read(unit + 0x6c) & 0xffffffU) != 0x00784241U ||
        (read(unit + 0x6c) >> 24) < '0' + action.requiredLevel)
        return false;
    MeterOps ops;
    return read(unit + 0x70) == player && ops.attribute(unit, 0x00555041U) > 0 &&
           actionStock(unit, action.panelKey, action.resourceKey) >=
               static_cast<std::int32_t>(action.resourceCost);
}
bool targetReady(std::uint32_t unit,
                 const MajestyStockControllers::SovereignTargetActionRecord &action) {
    return targetReadyForPlayer(unit, action, read(call(0x00415b40U, 0) + 0x24));
}
std::uint32_t spellDescriptor(std::uint32_t id) {
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 32, &memory) == POP_OK, "spell descriptor lookup storage");
    write(memory, id);
    call(0x0047b130U, 0x006d8218U, {memory + 8, memory});
    const auto node = read(memory + 8);
    const auto result = node == read(0x006d821cU) ? 0 : read(node + 16);
    require(host->guest_free(host, memory) == POP_OK, "spell descriptor lookup release");
    return result;
}
std::uint32_t
ensureTargetDescriptor(const MajestyStockControllers::SecondaryPanelRecord &panel,
                       const MajestyStockControllers::SovereignTargetActionRecord &action) {
    std::uint8_t initialized = 0;
    require(host->guest_read_u8(host, 0x006d822aU, &initialized) == POP_OK,
            "native spell registry initialization flag");
    if (!initialized)
        call(0x004782c0U, 0);
    const auto original = spellDescriptor(action.targetTemplateControlId);
    require(original && read(original + 8) == action.stockTargetMode,
            "native target template mode");
    auto descriptor = spellDescriptor(action.privateControlId);
    const auto owned = targetDescriptors.find(action.privateControlId);
    if (descriptor) {
        require(owned != targetDescriptors.end() && owned->second == descriptor,
                "private spell descriptor ownership");
    } else {
        // The native descriptor map owns this original-heap allocation and
        // retires it through its own destructor, just like its stock entries.
        descriptor = call(0x0064c616U, 0, {20});
        require(descriptor != 0, "private spell descriptor allocation");
        for (unsigned i = 0; i < 5; ++i)
            write(descriptor + i * 4, read(original + i * 4));
        write(descriptor, panel.buildingFamilyId);
        write(descriptor + 4, panel.childDialogId);
        write(descriptor + 12, 1);
        write(descriptor + 16, 0);
        std::uint32_t memory = 0;
        require(host->guest_alloc(host, 32, &memory) == POP_OK,
                "spell descriptor insertion storage");
        write(memory, action.privateControlId);
        write(memory + 4, descriptor);
        call(0x0047b220U, 0x006d8218U, {memory + 8, memory});
        require(spellDescriptor(action.privateControlId) == descriptor,
                "original map owns private spell descriptor");
        require(host->guest_free(host, memory) == POP_OK, "spell descriptor insertion release");
        targetDescriptors[action.privateControlId] = descriptor;
    }
    return descriptor;
}
void beginTarget(std::uint32_t unit, const MajestyStockControllers::SecondaryPanelRecord &panel,
                 const MajestyStockControllers::SovereignTargetActionRecord &action) {
    if (!targetReady(unit, action))
        return;
    ensureTargetDescriptor(panel, action);
    targetOwner = {&action, unit, read(unit + 0x60)};
    ++targetBeginDepth;
    call(0x00479fc0U, 0, {action.privateControlId});
    --targetBeginDepth;
    host->log(host, "Private target entered the original sovereign selection lifecycle.");
}
void ensureTargetSpawnHook() {
    const auto world = read(0x0071c68cU);
    require(world && read(world + 4), "original sovereign world manager");
    const auto table = read(read(world + 4));
    require(read(table + 0x64) == 0x005a1480U && read(table + 0x68) == 0x005a1350U,
            "pinned sovereign coordinate wrapper and original creation entry");
    // Slot64's coordinate wrapper is a recovered block. Its slot68 callee is
    // independently listed and eligible. Verify both native return addresses
    // around that entry instead of changing the wrapper's eligibility.
    const auto method = read(table + 0x68);
    if (std::find(targetSpawnMethods.begin(), targetSpawnMethods.end(), method) !=
        targetSpawnMethods.end())
        return;
    std::uint32_t id = 0;
    const auto status = host->hook_install_ex(host, method, 0, hook, POP_HOOK_WRAP,
                                              POP_HOOK_NO_GAME_VIEW, nullptr, &id);
    std::fprintf(stderr, "[alchemist-target] original-spawn-method=%08x hook-status=%d\n", method,
                 status);
    require(status == POP_OK, "original sovereign creation method must be eligible");
    hooks.push_back(id);
    targetSpawnMethods.push_back(method);
    std::fprintf(stderr, "[alchemist-target] original-spawn-method=%08x\n", method);
}
void invokeSourceTarget(const TargetExecution &execution) {
    const auto &callback = execution.action->sourceTargetCallback;
    require(!callback.empty() && callback.size() < 120, "source-target GPL callback bound");
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 256, &memory) == POP_OK, "source-target native call storage");
    for (unsigned i = 0; i <= callback.size(); ++i)
        require(host->guest_write_u8(host, memory + 128 + i, callback[i]) == POP_OK,
                "source-target callback name");
    call(0x004e3520U, memory, {memory + 128});
    call(0x00629910U, memory + 32, {memory});
    require(read(memory + 36) != 0, "source-target original function binding");
    call(0x004e3820U, memory);
    call(0x00629bf0U, memory + 32);
    // Original 629A20 boxes actual game units as agent arguments. Let the
    // original call wrapper prepare all parameters, locals and return state.
    for (const auto unit : {execution.spawned, execution.source, execution.clicked})
        call(0x00629a20U, memory + 32, {unit});
    call(0x00629c40U, memory + 32);
    call(0x006299b0U, memory + 32);
    require(host->guest_free(host, memory) == POP_OK, "source-target native call release");
}
void setupControlledStock(std::uint32_t controller) {
    if (!controlledStock || controlledStockApplied)
        return;
    const auto unit = call(0x00481ec0U, controller);
    if (!unit || read(unit + 0x6c) != 0x33784241U)
        return;
    const auto id = call(0x005a1c40U, unit, {0x4541U, 0});
    const auto agent = call(0x006236b0U, call(0x00623b20U, 0), {id});
    require(agent != 0, "controlled reagent fixture actor");
    std::uint32_t text = 0;
    require(host->guest_alloc(host, 128, &text) == POP_OK, "controlled reagent fixture name");
    const char name[] = "num_resources";
    for (unsigned i = 0; i < sizeof(name); ++i)
        require(host->guest_write_u8(host, text + 64 + i, name[i]) == POP_OK,
                "controlled reagent fixture name write");
    call(0x004e3520U, text, {text + 64});
    const auto value = call(0x006263d0U, agent, {text});
    require(value && read(value + 4) == 1, "controlled reagent fixture existing integer");
    controlledStockApplied = true;
    // Explicit test precondition only. Ordinary collected-resource saves are
    // kept separately; the real private GPL owns every subsequent debit.
    write(call(read(read(value) + 0x28), value), 25);
    call(0x004e3820U, text);
    require(host->guest_free(host, text) == POP_OK, "controlled reagent fixture name release");
    call(read(read(unit) + 0x124), unit, {0x30565041U, 25});
    host->log(
        host,
        "Controlled fixture initialized exactly25 reagents; ordinary collection unqualified.");
}
bool timedActionActive() {
    if (timedAction.unit && read(0x0071c6a8U) - timedAction.started >= timedAction.duration)
        timedAction = {};
    return timedAction.unit != 0;
}
bool actionReady(std::uint32_t unit, const std::string &panel, const std::string &resource,
                 std::uint32_t level, std::uint32_t cost, std::uint32_t gold,
                 std::uint32_t completionTemplate = 0) {
    if (!unit || (read(unit + 0x6c) & 0xffffffU) != 0x00784241U ||
        read(unit + 0x6c) >> 24 < '0' + level || !read(unit + 0x60) || rageDispatch.pending())
        return false;
    const auto manager = call(0x00415b40U, 0);
    if (read(unit + 0x70) != read(manager + 0x24))
        return false;
    MeterOps ops;
    const auto palace = actionPalace(unit);
    if (!palace || ops.attribute(unit, 0x00555041U) <= 0 ||
        ops.attribute(palace, 0x07425041U) != 0 ||
        actionStock(unit, panel, resource) < static_cast<std::int32_t>(cost))
        return false;
    if (completionTemplate) {
        const auto descriptor = call(0x00474480U, 0, {completionTemplate});
        if (!descriptor || !read(descriptor + 16) || ops.attribute(palace, read(descriptor + 16)))
            return false;
    }
    const auto player = call(0x00416980U, manager);
    return player &&
           static_cast<std::int32_t>(call(read(read(player) + 0x20), player, {0x00505041U})) >=
               static_cast<std::int32_t>(gold);
}
void submitRageAction(std::uint32_t unit, const std::string &callback) {
    require(rageDispatch.begin(unit, read(unit + 0x60), callback), "private Rage command owner");
    // Old AP24 control0047DBA0/0047DC0F..31 uses this exact coordinate
    // metadata and four-word command packet. Gold/resources belong to GPL.
    call(0x005ad740U, unit, {scratch + 232});
    call(0x004974b0U, 0, {1, read(unit + 0x60), read(scratch + 232), read(scratch + 236)});
    host->log(host, "Private sovereign action queued through original Rage command packet.");
}
void actionPresentation(std::uint32_t controller, std::uint64_t generation) {
    const auto session = lifecycle.find(controller);
    if (!actionBridge || !session.recipe || session.parent || session.generation != generation)
        return;
    MeterOps ops;
    const auto unit = ops.unit(controller), window = ops.window(controller);
    if (!unit || !window)
        return;
    const auto send = [&](std::uint32_t id, bool disabled) {
        call(read(read(window) + 0x68), window, {id, 0x0a, disabled ? 1U : 0U, 0});
    };
    for (const auto &action : recipes.timedRageActions) {
        if (action.panelKey != session.recipe->panelKey)
            continue;
        const bool active = timedActionActive() && timedAction.unit == unit &&
                            timedAction.control == action.actionControlId;
        ops.visible(window, action.progressControlId, active);
        ops.visible(window, action.activeDisplayControlId, active);
        if (active) {
            const auto elapsed = read(0x0071c6a8U) - timedAction.started;
            for (unsigned i = 0; i < 4; ++i)
                write(scratch + 160 + i * 4, i == 0   ? 7
                                             : i == 1 ? elapsed
                                             : i == 3 ? timedAction.duration
                                                      : 0);
            call(read(read(window) + 0x68), window,
                 {action.progressControlId, 0x29, 0, scratch + 160});
            call(read(read(window) + 0x68), window, {action.progressControlId, 8, 0, 0});
        }
        send(action.actionControlId,
             active || !actionReady(unit, action.panelKey, action.resourceKey, action.requiredLevel,
                                    action.resourceCost, action.goldCost));
    }
    for (const auto &action : recipes.rageCommandActions)
        if (action.panelKey == session.recipe->panelKey)
            send(action.actionControlId,
                 !actionReady(unit, action.panelKey, action.resourceKey, action.requiredLevel,
                              action.resourceCost, 0, action.completionTemplateResearchControlId));
    if (targetBridge)
        for (const auto &action : recipes.sovereignTargetActions)
            if (action.panelKey == session.recipe->panelKey) {
                ensureTargetDescriptor(*session.recipe, action);
                send(action.visualControlId, !targetReady(unit, action));
            }
}
void researchProgress() {
    if (!researchBridge || researchCompletionStaged)
        return;
    const auto session = lifecycle.find(researchController);
    if (!session.recipe || session.parent || session.generation != researchControllerGeneration)
        return;
    MeterOps ops;
    const auto unit = ops.unit(researchController), window = ops.window(researchController);
    if (!unit || !window)
        return;
    const bool busy = researchActivity.phase() != MajestyCommunity::ResearchActivity::Phase::Idle;
    for (const auto &row : recipes.researchRows) {
        if (row.panelKey != session.recipe->panelKey)
            continue;
        const bool active =
            researchActivity.phase() == MajestyCommunity::ResearchActivity::Phase::Active &&
            researchActivity.unit() == unit && researchActivity.command() == row.actionControlId;
        ops.visible(window, row.progressControlId, active);
        ops.visible(window, row.activeDisplayControlId, active);
        const auto send = [&](std::uint32_t control, std::uint32_t message, std::uint32_t parameter,
                              std::uint32_t value) {
            // Old AP10's literal progress messages at46577F/465790 use +68,
            // unlike the newer Mod Manager build's +74 streamed-message slot.
            call(read(read(window) + 0x68), window, {control, message, parameter, value});
        };
        if (active) {
            ops.visible(window, row.actionControlId, false);
            ops.visible(window, row.priceControlId, false);
            const auto &order = researchActivity.submitted();
            const auto now = read(0x0071c6a8U);
            write(scratch + 192, 7);
            write(scratch + 196, now > order.startedAt ? now - order.startedAt : 0);
            write(scratch + 200, 0);
            write(scratch + 204, order.duration);
            send(row.progressControlId, 0x29, 0, scratch + 192);
            send(row.progressControlId, 8, 0, 0);
        } else if (busy) {
            send(row.actionControlId, 0x0a, 1, 0);
        }
    }
}
void researchPresentation(std::uint32_t controller, std::uint64_t generation) {
    const auto session = lifecycle.find(controller);
    if (!panelBridge || !session.recipe || session.parent || session.generation != generation)
        return;
    if (!(read(0x006d81e0U) & 0xff))
        call(0x004736a0U, 0);
    ResearchOps descriptors;
    require(researchDescriptors.prepare(descriptors, recipes.researchRows),
            "native private research descriptors");
    MeterOps ops;
    const auto unit = ops.unit(controller), window = ops.window(controller);
    if (!unit || !window)
        return;
    static bool updateReported = false;
    if (!updateReported) {
        const auto manager = read(0x0071c68cU);
        const auto world = manager ? read(manager + 0x10) : 0;
        if (world) {
            std::fprintf(stderr,
                         "[alchemist-research] original-world=%08x table=%08x update-entry=%08x\n",
                         world, read(world), read(read(world) + 0x8c));
            updateReported = true;
        }
    }
    for (const auto &row : recipes.researchRows) {
        if (row.panelKey != session.recipe->panelKey)
            continue;
        static unsigned reports = 0;
        if (reports++ < 8) {
            const auto descriptor = descriptors.lookup(row.actionControlId);
            std::fprintf(stderr,
                         "[alchemist-research] id=%u level=%u price=%u completion=%08x "
                         "complete=%d unit-kind=%08x activity=%d affordable=%d\n",
                         row.actionControlId, read(descriptor + 4), read(descriptor + 8),
                         read(descriptor + 16), ops.attribute(unit, read(descriptor + 16)),
                         read(unit + 0x6c), ops.attribute(unit, 0x2c425041U),
                         MajestyCommunity::ResearchAffordable(descriptors, controller, descriptor));
        }
        call(0x004748c0U, 0, {window, unit, row.actionControlId});
        // Idle native worlds must not display template progress as an order.
        ops.visible(window, row.progressControlId, false);
        ops.visible(window, row.activeDisplayControlId, false);
    }
    const auto level = read(unit + 0x6c) >> 24;
    const auto buildingLevel = level >= '1' && level <= '3' ? level - '0' : 0;
    for (const auto &action : recipes.timedRageActions)
        if (action.panelKey == session.recipe->panelKey) {
            const bool available = buildingLevel >= action.requiredLevel;
            ops.visible(window, action.actionControlId, available);
            ops.visible(window, action.iconControlId, available);
            ops.visible(window, action.priceControlId, available);
            ops.visible(window, action.progressControlId, false);
            ops.visible(window, action.activeDisplayControlId, false);
        }
    for (const auto &action : recipes.rageCommandActions)
        if (action.panelKey == session.recipe->panelKey) {
            ops.visible(window, action.actionControlId, buildingLevel >= action.requiredLevel);
            ops.visible(window, action.iconControlId, buildingLevel >= action.requiredLevel);
            ops.visible(window, action.priceControlId, false);
        }
    for (const auto &action : recipes.sovereignTargetActions)
        if (action.panelKey == session.recipe->panelKey) {
            ops.visible(window, action.visualControlId, buildingLevel >= action.requiredLevel);
            ops.visible(window, action.iconControlId, buildingLevel >= action.requiredLevel);
            ops.visible(window, action.priceControlId, false);
        }
    researchProgress();
    actionPresentation(controller, generation);
}
void beginResearch(std::uint32_t controller,
                   const MajestyStockControllers::ResearchRowRecord &row) {
    ActivityOps activity;
    ResearchOps descriptors;
    const auto unit = descriptors.unit(controller);
    const auto descriptor = descriptors.lookup(row.actionControlId);
    if (!unit || !descriptor ||
        researchActivity.phase() != MajestyCommunity::ResearchActivity::Phase::Idle)
        return;
    if (!MajestyCommunity::ResearchUnitHasIdentity(descriptors, unit))
        return;
    const auto owner = read(unit + 0x84);
    // Retain the stock row's level/completion/construction/health guards in
    // addition to the creator's original AP99 gold validation.
    const auto kindLevel = read(unit + 0x6c) >> 24;
    const auto level = kindLevel >= '1' && kindLevel <= '3' ? kindLevel - '0' : 0;
    const auto completed = call(0x005a1c40U, unit, {read(descriptor + 16), 0});
    const auto constructed = call(0x005a1c40U, unit, {0x02425041U, 0});
    const auto damaged = call(0x00431630U, unit) & 0xff;
    std::fprintf(stderr,
                 "[alchemist-research-command] id=%u level=%u required=%u completed=%u "
                 "constructed=%u damaged=%u\n",
                 row.actionControlId, level, read(descriptor + 4), completed, constructed, damaged);
    if (level < read(descriptor + 4) || completed || !constructed || damaged)
        return;
    const auto recruitment = activity.capture(unit);
    activity.restore(unit, {});
    const bool affordable = (call(0x00474c10U, controller, {row.actionControlId}) & 0xff) != 0;
    std::fprintf(stderr, "[alchemist-research-command] native-can-submit=%d\n", affordable);
    if (!affordable) {
        activity.restore(unit, recruitment);
        return;
    }
    require(researchActivity.begin(unit, row.actionControlId, recruitment),
            "private research owner");
    call(0x00495900U, 0, {owner, unit, row.actionControlId});
    const bool captured = researchActivity.capture(activity, recruitment);
    if (!captured)
        activity.restore(unit, recruitment);
    host->log(host, captured ? "Private research submitted and native tuple captured."
                             : "Private research submitted; original queued tuple pending.");
}
std::string guestString(std::uint32_t p) {
    const auto text = read(p), length = read(p + 8);
    require(length < 256, "attribute string bound");
    std::string result(length, '\0');
    for (std::uint32_t i = 0; i < length; ++i) {
        std::uint8_t ch = 0;
        require(host->guest_read_u8(host, text + i, &ch) == POP_OK, "attribute string read");
        result[i] = char(ch);
    }
    return result;
}
// Resolve an authored export before the original VM prepares its call frame.
// Function objects carry both bytecode and local-variable models: replacing a
// block at execution time would retain the wrong model and corrupt the frame.
bool sharedFunctionLookup(pop_cpu_v1 *cpu, PopHookInvocation *inv) {
    if (!sharedFunctions || sharedLookupDepth)
        return false;
    const auto argument = cpu->esp + 4, originalName = read(argument);
    const auto found = sharedAliases.find(folded(guestString(originalName)));
    if (found == sharedAliases.end())
        return false;
    const auto key = std::make_pair(cpu->ecx, found->first);
    const auto cached = sharedResolved.find(key);
    if (cached != sharedResolved.end()) {
        // The first twelve bytes of the original function object are its
        // owned TString. Its lifetime ends at the quest teardown hook below.
        ++sharedLookupDepth;
        write(argument, cached->second);
        next(inv, cpu);
        write(argument, originalName);
        --sharedLookupDepth;
        return true;
    }
    ++sharedLookupDepth;
    std::uint32_t text = 0;
    require(host->guest_alloc(host, 256, &text) == POP_OK, "shared function string allocation");
    for (unsigned i = 0; i <= found->second.size(); ++i)
        require(host->guest_write_u8(host, text + 128 + i, found->second[i]) == POP_OK,
                "shared function alias write");
    call(0x004e3520U, text, {text + 128});
    const auto alias = call(0x00631b40U, cpu->ecx, {text});
    if (alias) {
        const auto original = call(0x00631b40U, cpu->ecx, {originalName});
        require(read(alias + 20) == 0x0061e4c0U, "authored alias interpreted dispatch");
        if (original) {
            require(read(original + 20) == 0x0061e4c0U, "shared export cannot replace native API");
            require(call(0x00631ba0U, cpu->ecx, {originalName}) ==
                        call(0x00631ba0U, cpu->ecx, {text}),
                    "shared export return type agrees");
        }
        sharedResolved.emplace(key, alias);
        write(argument, text);
    }
    // A miss during declaration loading is deliberately not cached. All
    // aliases must be registered before the subsequent original linking pass.
    next(inv, cpu);
    write(argument, originalName);
    call(0x004e3820U, text);
    require(host->guest_free(host, text) == POP_OK, "shared function string release");
    --sharedLookupDepth;
    return true;
}
std::uint32_t valueRef(std::uint32_t value, std::uint32_t offset) {
    return call(read(read(value) + offset), value);
}
void addAttribute(std::uint32_t context) {
    // Native external-call arguments are references to GPL values. Resolve
    // the real agent and use its original attribute map, not a host sidecar.
    const auto value = [context](unsigned index) {
        return read(read(read(context + 4) + index * 4));
    };
    const auto agent = call(0x006255e0U, valueRef(value(1), 0x5c));
    require(agent != 0, "AddAttribute live agent");
    const auto name = valueRef(value(2), 0x30);
    const auto typeName = guestString(valueRef(value(3), 0x30));
    const auto input = value(4), type = read(input + 4);
    require((typeName == "boolean" && type == 6) || (typeName == "integer" && type == 1) ||
                (typeName == "function" && type == 8),
            "AddAttribute authored type agreement");
    if (call(0x00626440U, agent, {name}) & 0xff)
        return;
    const auto runtime = read(read(0x007218b4U) + 0x10), pool = read(runtime + 0x1c);
    std::uint32_t growthBefore[9];
    for (unsigned i = 0; i < 9; ++i)
        growthBefore[i] = read(pool + 0xa4 + i * 4);
    if (traceRecruitment)
        std::fprintf(stderr,
                     "[alchemist-pool-trace] attribute-before name=%s pool=%08x growth=%u\n",
                     guestString(name).c_str(), pool, read(pool + 0xbc));
    const auto copy = call(0x0062a810U, pool, {type});
    require(copy && read(copy + 4) == type, "AddAttribute original typed allocation");
    // Original list-copy path 00639ac0..00639ada allocates by type then
    // copies through virtual +18. Attribute insertion 006261c0 copies the
    // key and takes the value pointer; the original saver owns both.
    call(read(read(copy) + 0x18), copy, {input});
    if (!(call(0x006261c0U, agent, {name, copy}) & 0xff)) {
        call(0x0062aa20U, pool, {copy});
        require(false, "AddAttribute original insertion refused");
    }
    require(call(0x006263d0U, agent, {name}) == copy,
            "AddAttribute original map owns independent value");
    for (unsigned i = 0; i < 9; ++i)
        require(read(pool + 0xa4 + i * 4) == growthBefore[i],
                "AddAttribute preserves native pool growth settings");
    std::fprintf(stderr, "[alchemist-attributes] installed name=%s type=%u\n",
                 guestString(name).c_str(), type);
    if (traceRecruitment)
        std::fprintf(stderr, "[alchemist-pool-trace] attribute-after name=%s pool=%08x growth=%u\n",
                     guestString(name).c_str(), pool, read(pool + 0xbc));
}
void registerAttributes() {
    const auto prepareName = [](const char *name) {
        const auto length = std::strlen(name);
        require(length < 64, "attribute registration name bound");
        for (unsigned i = 0; i <= length; ++i)
            require(host->guest_write_u8(host, scratch + 128 + i, name[i]) == POP_OK,
                    "attribute registration string");
        write(scratch + 96, scratch + 128);
        write(scratch + 100, length);
        write(scratch + 104, length);
    };
    const auto runtime = read(read(0x007218b4U) + 0x10);
    for (const char *name : {"SetAttribute"}) {
        prepareName(name);
        require(call(0x00631b40U, read(runtime + 8), {scratch + 96}) != 0,
                "stock void binding exists");
        const auto type = call(0x00631ba0U, read(runtime + 8), {scratch + 96});
        require(type == 0, "stock void registry type");
        if (traceRecruitment)
            std::fprintf(stderr, "[alchemist-attributes] stock-void name=%s type=%u\n", name, type);
    }
    prepareName("AddAttribute");
    // The recognized dispatcher hook below implements only this registered
    // external name. NullFunction itself and all other calls stay original.
    // Void is the original None value type 0. Type 10 is the registry's
    // missing-symbol fallback and must never be allocated from the nine
    // value buckets: its index overlaps the pool's growth settings.
    call(0x00631c00U, read(runtime + 8), {scratch + 96, 0x005a9600U, 0, 0, 0});
    require(call(0x00631ba0U, read(runtime + 8), {scratch + 96}) == 0,
            "AddAttribute registered as original None result");
    attributeFunction = call(0x00631b40U, read(runtime + 8), {scratch + 96});
    require(attributeFunction && read(attributeFunction + 20) == 0x005a9600U,
            "AddAttribute registered dispatch identity");
}
void hook(const PopModApi *, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    const auto target = cpu->target, self = cpu->ecx;
    if (panelBridge && target == 0x0042ee50U) {
        DispatchOps ops;
        const auto unit = read(cpu->esp + 4);
        require(MajestyCommunity::WithAlchemistFogReveal(ops, unit, [&] { next(inv, cpu); }),
                "Alchemist fog descriptor identity lifetime");
        return;
    }
    // Gold HD reserves second-byte L for non-selectable legacy actors. The
    // community's ALC1 collides with that broad test. Scope the compatibility
    // identity to the original map predicates; restore before card dispatch
    // and before the callback returns. Descriptors, GPL and saves retain ALC1.
    if (panelBridge && (target == 0x0043dfc0U || target == 0x0043e250U || target == 0x0043ee80U ||
                        target == 0x0043ddb0U || target == 0x0043de30U || target == 0x0043ded0U)) {
        DispatchOps ops;
        mapSelection.enter();
        next(inv, cpu);
        require(mapSelection.leave(ops), "map selection identity lifetime");
        return;
    }
    if (panelBridge && target == 0x005b6670U) {
        DispatchOps ops;
        mapSelection.character(ops, self, read(cpu->esp));
        next(inv, cpu);
        return;
    }
    if (panelBridge && target == 0x00418660U) {
        DispatchOps ops;
        require(mapSelection.restore(ops), "map selection identity before card");
        next(inv, cpu);
        return;
    }
    if ((researchBridge || sharedFunctions) && target == 0x00628e60U) {
        sharedResolved.clear();
        targetOwner = {};
        targetExecution = {};
        targetBeginDepth = 0;
        // The original quest/GPL teardown retires all raw world references.
        // No host activity tuple may survive into a fresh loaded world.
        researchActivity = {};
        rageDispatch.reset();
        timedAction = {};
        researchController = 0;
        researchControllerGeneration = 0;
        controlledPartyApplied = false;
        controlledStockApplied = false;
        controlledDeathApplied = false;
        controlledDeathUnit = 0;
        controlledDeathClock = 0;
        controlledTargetApplied = false;
        next(inv, cpu);
        return;
    }
    if (targetBridge && target == 0x004380c0U) {
        // Any ordinary mode selection replaces our source owner. The private
        // begin call uses the same native method inside its explicit scope.
        if (!targetBeginDepth)
            targetOwner = {};
        next(inv, cpu);
        return;
    }
    if (targetBridge && target == 0x005cd860U && targetOwner.action && self == read(0x0071c844U) &&
        read(self + 0x30) == targetOwner.action->stockTargetMode && read(cpu->esp + 4) == 23) {
        // Sp23's native registration uses cursor23. Keep its target predicate
        // and invalid-target feedback while presenting the declared cursor39.
        const auto argument = cpu->esp + 4;
        write(argument, targetOwner.action->cursorOrdinal);
        next(inv, cpu);
        write(argument, 23);
        return;
    }
    if (targetBridge && self == 0x006d8218U && (target == 0x0047b130U || target == 0x0047b220U)) {
        const auto panel = lifecycle.find(researchController);
        const auto key = read(cpu->esp + 8);
        // The visible native control and the private command descriptor have
        // separate IDs. Both find() and the old operator[] insertion probe are
        // used by native hover/price presenters; scope both to this live panel.
        if (panel.recipe && !panel.parent && panel.generation == researchControllerGeneration &&
            (target != 0x0047b220U || read(key + 4) == 0)) {
            for (const auto &action : recipes.sovereignTargetActions) {
                const auto owned = targetDescriptors.find(action.privateControlId);
                if (action.panelKey == panel.recipe->panelKey &&
                    read(key) == action.visualControlId && owned != targetDescriptors.end() &&
                    spellDescriptor(action.privateControlId) == owned->second) {
                    write(key, action.privateControlId);
                    next(inv, cpu);
                    write(key, action.visualControlId);
                    return;
                }
            }
        }
        next(inv, cpu);
        return;
    }
    if (targetBridge && target == 0x004a7420U) {
        const auto argument = cpu->esp + 4;
        const auto mode = read(argument), cost = read(argument + 20);
        if (targetOwner.action && mode == targetOwner.action->stockTargetMode) {
            const auto &action = *targetOwner.action;
            if (read(targetOwner.unit + 0x60) == targetOwner.identity &&
                read(argument + 4) == read(targetOwner.unit + 0x70) &&
                targetReady(targetOwner.unit, action)) {
                // Keep player, coordinates and the exact clicked target in
                // their native packet fields. The otherwise-zero price field
                // carries the source building ID, as the community v2 contract
                // requires. Receipt/execution does not depend on a UI pointer.
                write(argument, action.privateMode);
                write(argument + 20, targetOwner.identity);
                host->log(host,
                          "Private source and clicked target committed in native spell packet.");
            } else {
                // Preserve native repeat-target behavior and its ordinary
                // unaffordable-cast feedback without executing another spell.
                write(argument + 20, 0x7fffffffU);
            }
            next(inv, cpu);
            write(argument, mode);
            write(argument + 20, cost);
            return;
        }
        next(inv, cpu);
        return;
    }
    if (targetBridge && target == 0x004a60b0U) {
        const auto previous = targetExecution;
        targetExecution = {};
        const auto argument = cpu->esp + 4, mode = read(argument), cost = read(argument + 24);
        const MajestyStockControllers::SovereignTargetActionRecord *action = nullptr;
        for (const auto &candidate : recipes.sovereignTargetActions)
            if (candidate.privateMode == mode)
                action = &candidate;
        if (action) {
            // The original receiver adds its sequence/unit field between mode
            // and player, so this executor has seven words, not the sender's
            // six. Preserve that original packet/acknowledgement lifecycle.
            const auto world = read(0x0071c68cU);
            const auto manager = world ? read(world + 4) : 0, player = read(argument + 8);
            if (!manager) {
                targetExecution = previous;
                require(host->hook_return(host, cpu, 0, 0) == POP_OK,
                        "retired-world private spell cdecl return");
                return;
            }
            const auto source = call(0x005a10d0U, manager, {cost});
            const auto clicked = call(0x005a10d0U, manager, {read(argument + 20)});
            if (!source || !clicked || read(source + 0x60) != cost ||
                !targetReadyForPlayer(source, *action, player)) {
                targetExecution = previous;
                require(host->hook_return(host, cpu, 0, 0) == POP_OK,
                        "invalid private spell original cdecl return");
                return;
            }
            ensureTargetSpawnHook();
            targetExecution = {action, source, clicked, player, 0, false};
            write(argument, action->stockExecutorMode);
            write(argument + 24, 0);
        }
        next(inv, cpu);
        if (action) {
            require(!targetExecution.spawned || targetExecution.invoked,
                    "created private spell must invoke its authored source-target callback");
            write(argument, mode);
            write(argument + 24, cost);
        }
        targetExecution = previous;
        return;
    }
    if (targetBridge && targetExecution.action &&
        std::find(targetSpawnMethods.begin(), targetSpawnMethods.end(), target) !=
            targetSpawnMethods.end() &&
        read(cpu->esp) == 0x005a14c2U && read(cpu->esp + 0x30) == 0x004a70d8U) {
        const auto argument = cpu->esp + 8, original = read(argument);
        require(original == 0x31455657U, "original Lightning Storm creation description");
        write(argument, targetExecution.action->privateUnitId);
        next(inv, cpu);
        write(argument, original);
        targetExecution.spawned = cpu->eax;
        if (cpu->eax)
            require(read(cpu->eax + 0x6c) == targetExecution.action->privateUnitId &&
                        read(cpu->eax + 0x70) == targetExecution.player,
                    "created native private spell identity and owner");
        return;
    }
    if (targetBridge && target == 0x005ae750U && targetExecution.action &&
        targetExecution.spawned && read(cpu->esp + 4) == targetExecution.spawned &&
        read(cpu->esp) == 0x004a7174U) {
        std::fprintf(
            stderr, "[alchemist-target] callback=%s expected=%s target=%08x expected-target=%08x\n",
            guestString(self).c_str(), targetExecution.action->sourceTargetCallback.c_str(),
            read(cpu->esp + 8), targetExecution.clicked);
        // The old Character description leaves this stock two-argument script
        // slot empty for the community's paired callback. Its validated MMCR
        // record supplies the name; 629910 resolves that original GPL export.
        require(read(cpu->esp + 8) == targetExecution.clicked && !targetExecution.invoked,
                "native private spell callback and exact clicked target");
        invokeSourceTarget(targetExecution);
        targetExecution.invoked = true;
        host->log(host,
                  "Native spell invoked authored callback with Spell, Lab and clicked enemy.");
        require(host->hook_return(host, cpu, 1, 8) == POP_OK,
                "private spell preserves original two-argument RET8");
        return;
    }
    if (controlledDeath && target == 0x005a1c40U) {
        if (read(self + 0x60) == 1719 && read(self + 0x6c) == 0x31434c41U)
            controlledDeathUnit = self;
        next(inv, cpu);
        return;
    }
    if (researchBridge && target == 0x005d9680U) {
        // Optional isolated test setup: use the already implemented ordinary
        // single-player cheat, never rewrite actor statistics or mod balance.
        const auto state = read(0x006d7670U);
        static unsigned partyReports = 0;
        if (controlledParty && state && partyReports++ < 4)
            std::fprintf(stderr, "[alchemist-test-party] state=%u pending=%u\n", read(state),
                         read(state + 4));
        if (controlledParty && !controlledPartyApplied && state &&
            (read(state) == 3 || read(state) == 7) && !read(state + 4)) {
            std::uint32_t text = 0;
            require(host->guest_alloc(host, 128, &text) == POP_OK, "test party string allocation");
            const char code[] = "level 1000";
            for (unsigned i = 0; i < sizeof(code); ++i)
                require(host->guest_write_u8(host, text + 64 + i, code[i]) == POP_OK,
                        "test party string write");
            call(0x004e3520U, text, {text + 64});
            const auto recognized = call(0x00480e00U, 0, {text});
            call(0x004e3820U, text);
            require(host->guest_free(host, text) == POP_OK, "test party string release");
            require(recognized == 1, "ordinary single-player test cheat recognition");
            controlledPartyApplied = true;
            host->log(host, "Controlled test party requested through ordinary level 1000 cheat.");
        }
        const bool pending =
            researchActivity.phase() == MajestyCommunity::ResearchActivity::Phase::Pending;
        ActivityOps activity;
        const auto recruitment = pending ? activity.capture(researchActivity.unit())
                                         : MajestyCommunity::BuildingActivity{};
        next(inv, cpu);
        if (controlledTarget && !controlledTargetApplied && state &&
            (read(state) == 3 || read(state) == 7) && !read(state + 4)) {
            const auto world = read(0x0071c68cU), manager = world ? read(world + 4) : 0;
            require(manager && recipes.sovereignTargetActions.size() == 1,
                    "controlled target original world and declared action");
            const auto source = call(0x005a10d0U, manager, {915});
            const auto clicked = call(0x005a10d0U, manager, {1797});
            const auto &action = recipes.sovereignTargetActions.front();
            MeterOps ops;
            require(source && clicked && targetReady(source, action) &&
                        read(clicked + 0x60) == 1797 && read(clicked + 0x70) == 7 &&
                        ops.attribute(clicked, 0x00555041U) > 0,
                    "controlled target exact existing hostile and funded Lab");
            controlledTargetApplied = true;
            std::uint32_t position = 0;
            require(host->guest_alloc(host, 16, &position) == POP_OK,
                    "controlled target original coordinate storage");
            call(0x005ad740U, clicked, {position});
            call(0x004a7420U, 0,
                 {action.privateMode, read(source + 0x70), read(position), read(position + 4), 1797,
                  915});
            require(host->guest_free(host, position) == POP_OK,
                    "controlled target coordinate release");
            host->log(host, "Controlled existing target submitted through original spell packet.");
        }
        if (pending && researchActivity.capture(activity, recruitment))
            host->log(host,
                      "Original simulation update installed private research; AP10 restored.");
        if (controlledDeath && !controlledDeathApplied && controlledDeathUnit && state &&
            (read(state) == 3 || read(state) == 7) && !read(state + 4)) {
            if (!controlledDeathClock)
                controlledDeathClock = read(0x0071c6a8U);
            const auto unit = controlledDeathUnit;
            require(read(unit + 0x60) == 1719 && read(unit + 0x6c) == 0x31434c41U,
                    "controlled Phoenix injury still owns exact hero");
            require(read(unit + 0x70) == read(call(0x00415b40U, 0) + 0x24),
                    "controlled Phoenix injury owner");
            if (read(0x0071c6a8U) - controlledDeathClock >= controlledDeathDelay) {
                controlledDeathApplied = true;
                // Test-only lethal injury enters the original HP setter and its
                // death observer. Never call gravestone/resurrection ourselves or
                // modify the inventory, chance roll or authored effect duration.
                call(read(read(unit) + 0x124), unit, {0x00555041U, 0});
                host->log(host, "Controlled Phoenix injury submitted through original HP setter.");
            }
        }
        researchProgress();
        if (actionBridge && timedAction.unit)
            actionPresentation(researchController, researchControllerGeneration);
        return;
    }
    if (actionBridge && target == 0x0047dd10U) {
        const auto unit = read(cpu->esp + 4);
        const bool owned = rageDispatch.matches(unit, read(unit + 0x60));
        {
            MajestyCommunity::RageDispatch::Scope scope(rageDispatch, unit, read(unit + 0x60));
            next(inv, cpu);
        }
        if (owned) {
            rageDispatch.reset();
            host->log(host, "Original Rage dispatch returned from private GPL action.");
            actionPresentation(researchController, researchControllerGeneration);
        }
        return;
    }
    if (actionBridge && target == 0x004e3520U && !rageDispatch.callback().empty() &&
        read(cpu->esp + 4) == 0x006c0170U) {
        const auto argument = cpu->esp + 4;
        const auto &callback = rageDispatch.callback();
        for (unsigned i = 0; i <= callback.size(); ++i)
            require(host->guest_write_u8(host, scratch + 128 + i, callback[i]) == POP_OK,
                    "private GPL callback string");
        write(argument, scratch + 128);
        next(inv, cpu);
        write(argument, 0x006c0170U);
        host->log(host, "Original Rage invocation constructed the authored private GPL callback.");
        return;
    }
    if (researchBridge && target == 0x004abf70U) {
        const auto unit = read(cpu->esp + 8), eventType = read(cpu->esp + 20);
        ActivityOps activity;
        const auto command = researchActivity.command();
        researchCompletionStaged = true;
        const bool handled = researchActivity.complete(activity, unit, eventType, [&] {
            ResearchOps descriptors;
            require(call(0x00474480U, 0, {command}) == descriptors.lookup(command),
                    "private completion descriptor still owned by native AP99");
            next(inv, cpu);
        });
        researchCompletionStaged = false;
        if (!handled)
            next(inv, cpu);
        else if (researchActivity.phase() == MajestyCommunity::ResearchActivity::Phase::Idle) {
            host->log(host, "Original event2009 completed private research; AP10 restored.");
            researchPresentation(researchController, researchControllerGeneration);
        }
        return;
    }
    const auto privateEntry = privateDispatch.find(self);
    const auto privateSession = lifecycle.find(self);
    if (privateEntry.table && privateEntry.generation == privateSession.generation &&
        privateSession.recipe && !privateSession.parent) {
        const auto sp = cpu->esp;
        if (target == MajestyCommunity::PrivateControllerDispatch::controlBridge) {
            const auto command = read(sp + 4);
            static unsigned commandReports = 0;
            if (researchBridge && commandReports++ < 32)
                std::fprintf(stderr, "[alchemist-private-control] command=%u\n", command);
            if (command == 0x1f4dU) {
                const auto unit = call(0x00481ec0U, self);
                if (!unit) {
                    returned(cpu, 0);
                    return;
                }
                const auto manager = call(0x00415b40U, 0), window = read(self + 0x14);
                call(read(read(window) + 0x14), window);
                call(0x00416890U, manager, {privateSession.recipe->parentDialogId, unit, 0, 0});
                returned(cpu, 1);
            } else {
                bool privateAction = false;
                if (actionBridge) {
                    const auto unit = call(0x00481ec0U, self);
                    for (const auto &action : recipes.timedRageActions)
                        if (action.panelKey == privateSession.recipe->panelKey &&
                            action.actionControlId == command) {
                            if (!timedActionActive() &&
                                actionReady(unit, action.panelKey, action.resourceKey,
                                            action.requiredLevel, action.resourceCost,
                                            action.goldCost)) {
                                timedAction = {unit, command, read(0x0071c6a8U), action.durationMs};
                                submitRageAction(unit, action.callbackSymbol);
                            }
                            actionPresentation(self, privateSession.generation);
                            returned(cpu, 0);
                            return;
                        }
                    for (const auto &action : recipes.rageCommandActions)
                        if (action.panelKey == privateSession.recipe->panelKey &&
                            action.actionControlId == command) {
                            if (actionReady(unit, action.panelKey, action.resourceKey,
                                            action.requiredLevel, action.resourceCost, 0,
                                            action.completionTemplateResearchControlId))
                                submitRageAction(unit, action.callbackSymbol);
                            actionPresentation(self, privateSession.generation);
                            returned(cpu, 0);
                            return;
                        }
                }
                if (targetBridge) {
                    const auto unit = call(0x00481ec0U, self);
                    for (const auto &action : recipes.sovereignTargetActions)
                        if (action.panelKey == privateSession.recipe->panelKey &&
                            (command == action.visualControlId ||
                             command == action.privateControlId)) {
                            beginTarget(unit, *privateSession.recipe, action);
                            actionPresentation(self, privateSession.generation);
                            returned(cpu, 0);
                            return;
                        }
                }
                for (const auto &row : recipes.researchRows) {
                    const bool selected = row.panelKey == privateSession.recipe->panelKey &&
                                          row.actionControlId == command;
                    privateAction = privateAction || selected;
                    if (selected && researchBridge) {
                        beginResearch(self, row);
                        returned(cpu, 0);
                        return;
                    }
                }
                for (const auto &action : recipes.timedRageActions)
                    privateAction =
                        privateAction || (action.panelKey == privateSession.recipe->panelKey &&
                                          action.actionControlId == command);
                for (const auto &action : recipes.rageCommandActions)
                    privateAction =
                        privateAction || (action.panelKey == privateSession.recipe->panelKey &&
                                          action.actionControlId == command);
                for (const auto &action : recipes.sovereignTargetActions)
                    privateAction =
                        privateAction ||
                        (action.panelKey == privateSession.recipe->panelKey &&
                         (action.visualControlId == command || action.privateControlId == command));
                // Presentation/navigation are qualified separately. Until each
                // authored transaction is ported, never let an overlapping
                // stock command execute a different spell under its new label.
                if (privateAction) {
                    returned(cpu, 0);
                    return;
                }
                returned(cpu, call(0x0047a790U, self, {command}));
            }
            return;
        }
        if (target == MajestyCommunity::PrivateControllerDispatch::eventBridge) {
            if (researchCompletionStaged) {
                require(host->hook_return(host, cpu, 0, 16) == POP_OK,
                        "private completion event ret16 discipline");
                return;
            }
            const auto argument2 = read(sp + 8), argument3 = read(sp + 12);
            const auto result =
                call(0x0047aae0U, self, {read(sp + 4), read(sp + 8), read(sp + 12), read(sp + 16)});
            meter(self, privateSession.generation);
            if (MajestyCommunity::ResearchRowsNeedRefresh(argument2, argument3))
                researchPresentation(self, privateSession.generation);
            else if (actionBridge && (argument3 == 0x30565041U || argument3 == 0x07425041U))
                actionPresentation(self, privateSession.generation);
            require(host->hook_return(host, cpu, result, 16) == POP_OK,
                    "private event ret16 discipline");
            return;
        }
    }
    if (target == 0x0062a6a0U) {
        next(inv, cpu);
        std::fprintf(stderr, "[alchemist-pool-trace] constructor pool=%08x growth=%u\n", self,
                     read(self + 0xbc));
        return;
    }
    if (target == 0x0062a7c0U) {
        const auto type = read(cpu->esp + 4), count = read(cpu->esp + 8);
        next(inv, cpu);
        std::fprintf(stderr,
                     "[alchemist-pool-trace] setter pool=%08x type=%u growth=%u boolean=%u\n", self,
                     type, count, read(self + 0xbc));
        return;
    }
    if (target == 0x0062abf0U) {
        const auto type = read(cpu->esp + 4), count = read(cpu->esp + 8);
        next(inv, cpu);
        if (traceArmed && type == 6) {
            const auto bucket = self + (type + 1) * 16;
            std::fprintf(stderr,
                         "[alchemist-pool-trace] boolean-growth count=%u pool=%08x "
                         "start=%08x end=%08x capacity=%08x\n",
                         count, self, read(bucket + 4), read(bucket + 8), read(bucket + 12));
        }
        return;
    }
    if (target == 0x0062a810U || target == 0x0062a890U) {
        const auto type = read(cpu->esp + 4), caller = read(cpu->esp), instruction = cpu->esi;
        next(inv, cpu);
        if (traceArmed && traceValues++ < 1024) {
            std::uint32_t actual = 0, vtable = 0, boolean = 0;
            if (cpu->eax) {
                host->guest_read_u32(host, cpu->eax, &vtable);
                host->guest_read_u32(host, cpu->eax + 4, &actual);
                if (vtable)
                    host->guest_read_u32(host, vtable + 0x2c, &boolean);
            }
            std::fprintf(
                stderr,
                "[alchemist-value-trace] requested=%u actual=%u value=%08x "
                "vtable=%08x bool-method=%08x allocator=%08x caller=%08x instruction=%08x\n",
                type, actual, cpu->eax, vtable, boolean, target, caller, instruction);
            if (caller == 0x0061e586U) {
                std::fprintf(stderr,
                             "[alchemist-result-trace] operation=%u result-ref=%08x "
                             "left-ref=%08x left-value=%08x right-ref=%08x right-value=%08x\n",
                             read(instruction), read(instruction + 16), read(instruction + 20),
                             read(read(instruction + 20)), read(instruction + 24),
                             read(read(instruction + 24)));
            }
            if (type == 6 && actual != type) {
                const auto bucket = self + (type + 1) * 16;
                const auto start = read(bucket + 4), end = read(bucket + 8);
                std::fprintf(stderr,
                             "[alchemist-pool-trace] invalid-boolean pool=%08x "
                             "start=%08x end=%08x capacity=%08x\n",
                             self, start, end, read(bucket + 12));
                if (end >= start && end - start <= 4096) {
                    for (auto at = end > start + 64 ? end - 64 : start; at < end; at += 4)
                        std::fprintf(stderr, "[alchemist-pool-trace] slot=%08x value=%08x\n", at,
                                     read(at));
                }
            }
        }
        return;
    }
    if (target == 0x00424f10U) {
        next(inv, cpu);
        registerAttributes();
        return;
    }
    if ((target == 0x00631b40U || target == 0x00631ba0U) && sharedFunctionLookup(cpu, inv))
        return;
    if (target == 0x00631b40U) {
        const auto name = read(cpu->esp + 4);
        next(inv, cpu);
        if (!cpu->eax && missingFunctions.size() < 64) {
            const auto text = guestString(name);
            // The interpreter also probes constants in the function registry
            // before resolving them elsewhere. Those misses are expected.
            if (!text.empty() && text[0] != '#' &&
                std::find(missingFunctions.begin(), missingFunctions.end(), text) ==
                    missingFunctions.end()) {
                missingFunctions.push_back(text);
                std::fprintf(stderr, "[alchemist-recruit-trace] missing-function=%s\n",
                             text.c_str());
            }
        }
        return;
    }
    // Optional, bounded observation of the authored hero's GPL execution.
    // Read the original function object's string and operator arguments;
    // continue every call unchanged, including the guest's failure path.
    if (target == 0x006381b0U) {
        if (attributeCompat && self == attributeFunction) {
            addAttribute(read(cpu->esp + 4) + 0x14);
            returned(cpu, 0);
            return;
        }
        if (!traceRecruitment && !traceCombat) {
            next(inv, cpu);
            return;
        }
        char name[128] = {};
        const auto text = read(self), length = read(self + 8);
        bool valid = text && length && length < sizeof name;
        for (std::uint32_t i = 0; valid && i < length; ++i) {
            std::uint8_t ch = 0;
            valid = host->guest_read_u8(host, text + i, &ch) == POP_OK;
            name[i] = ch >= 32 && ch < 127 ? char(ch) : '?';
        }
        if (valid) {
            static unsigned combatReports = 0;
            static std::map<std::string, unsigned> combatNameReports;
            std::string lower(name);
            std::transform(lower.begin(), lower.end(), lower.begin(), [](unsigned char ch) {
                return ch >= 'A' && ch <= 'Z' ? char(ch + 'a' - 'A') : char(ch);
            });
            if (lower.rfind("mja_", 0) == 0)
                lower.erase(0, 4);
            if (traceCombat && combatReports < 256 &&
                (lower == "dropgoldinradius" || lower == "alchemist_award_monster_part" ||
                 lower == "alchemy_transmutation_oil_hit" ||
                 lower == "alchemy_paralytic_oil_begin" ||
                 lower.find("alchemist_stun_serum") == 0 ||
                 lower.find("alchemist_flash_flask") == 0 ||
                 lower.find("alchemist_miasma_mist") == 0 || lower == "purchase_phoenix_phial" ||
                 lower == "phoenix_phial_resurrection_end" || lower == "gravestone" ||
                 lower == "shared_begin_resurrect" || lower == "shared_end_resurrect") &&
                combatNameReports[lower]++ < 8) {
                ++combatReports;
                std::fprintf(stderr, "[alchemist-combat-call] function=%s block=%08x\n", name,
                             read(self + 12));
            }
            if (traceCombat && controlledDeathApplied && controlledDeathUnit &&
                lower == "phoenix_phial_resurrection_end") {
                next(inv, cpu);
                std::fprintf(stderr, "[alchemist-phoenix-return] unit=%u hp=%u maxhp=%u\n",
                             read(controlledDeathUnit + 0x60),
                             call(0x005a1c40U, controlledDeathUnit, {0x00555041U, 0}),
                             call(0x005a1c40U, controlledDeathUnit, {0x01555041U, 0}));
                return;
            }
            if (std::strstr(name, "Alchemist_birth") || std::strstr(name, "alchemist_birth"))
                traceArmed = true;
            if (traceRecruitment && traceArmed && traceCalls++ < 2048)
                std::fprintf(stderr, "[alchemist-recruit-trace] call=%s block=%08x target=%08x\n",
                             name, read(self + 12), read(self + 20));
        }
        next(inv, cpu);
        return;
    }
    if (target == 0x0063cb20U) {
        const auto sp = cpu->esp;
        const auto operation = read(sp + 4), left = read(sp + 8), right = read(sp + 12);
        next(inv, cpu);
        if (traceArmed && traceOperators++ < 256)
            std::fprintf(stderr,
                         "[alchemist-recruit-trace] operator=%u left-type=%u "
                         "right-type=%u result=%08x\n",
                         operation, left, right, cpu->eax);
        return;
    }
    if (target == 0x004cd8d0U) {
        next(inv, cpu);
        NameOps ops;
        const auto context = call(0x004ba7e0U, 0);
        for (const auto &r : features.nameGenerators)
            require(MajestyCommunity::RegisterNames(ops, self, read(context + 0x160), r) ==
                        MajestyCommunity::Registration::Installed,
                    "native NM18 registration");
        host->log(host, "Alchemist NM18 installed through original generator lifecycle.");
        return;
    }
    if (target == 0x004ca4f0U) {
        const auto a = cpu->esp + 4, requested = read(a), selected = lifecycle.selector(requested),
                   window = read(a + 4), context = read(a + 8);
        if (requested != selected)
            write(a, selected);
        next(inv, cpu);
        if (requested != selected) {
            write(a, requested);
            require(lifecycle.capture(cpu->eax, requested, window, context),
                    "private factory result");
            const auto session = lifecycle.find(cpu->eax);
            if (panelBridge && !session.parent) {
                DispatchOps ops;
                require(privateDispatch.install(ops, cpu->eax, session.generation),
                        "private child dispatch binding");
                researchController = cpu->eax;
                researchControllerGeneration = session.generation;
            }
            host->log(host, "Alchemist private panel constructed through original factory.");
        }
        return;
    }
    const auto s = lifecycle.find(self);
    if (target == 0x00465f00U && s.parent && s.recipe && panelBridge)
        for (const auto &gate : recipes.upgradeGates)
            if (gate.panelKey == s.recipe->panelKey &&
                read(cpu->esp + 4) == gate.upgradeControlId &&
                !upgradeAllowed(self, s.generation)) {
                upgradePresentation(self, s.generation);
                returned(cpu, 0);
                host->log(host,
                          "Private Laboratory upgrade rejected by authored research prerequisite.");
                return;
            }
    if (target == 0x00465f00U && s.parent && s.recipe &&
        read(cpu->esp + 4) == s.recipe->openCommandId) {
        const auto unit = call(0x00481ec0U, self), family = read(read(unit + 0x80) + 4) & 0xffffffU,
                   child = lifecycle.child(self, read(cpu->esp + 4), family);
        require(child != 0, "private building family");
        returned(cpu, call(0x0047c5c0U, self, {child, 0}));
        return;
    }
    if (target == 0x0047a790U && s.recipe && !s.parent && read(cpu->esp + 4) == 0x1f4dU) {
        const auto unit = call(0x00481ec0U, self);
        if (!unit) {
            returned(cpu, 0);
            return;
        }
        const auto manager = call(0x00415b40U, 0), window = read(self + 0x14);
        call(read(read(window) + 0x14), window);
        call(0x00416890U, manager, {s.recipe->parentDialogId, unit, 0, 0});
        returned(cpu, 1);
        return;
    }
    next(inv, cpu);
    if (target == 0x00465270U || target == 0x0047a360U) {
        DispatchOps ops;
        privateDispatch.destroyed(ops, self, s.generation);
        lifecycle.destroyed(self, s.generation);
        if (self == researchController && s.generation == researchControllerGeneration) {
            researchController = 0;
            researchControllerGeneration = 0;
        }
    }
    if (target == 0x0047a760U || target == 0x0047aae0U)
        meter(self, s.generation);
    if (target == 0x0047a760U)
        researchPresentation(self, s.generation);
    if (target == 0x004652a0U || target == 0x00466110U)
        upgradePresentation(self, s.generation);
    if (target == 0x004652a0U && s.parent)
        setupControlledStock(self);
}
} // namespace
extern "C" POP_MOD_EXPORT PopModStatus pop_mod_init(const PopModApi *api) {
    if (!api || api->size < offsetof(PopModApi, guest_call) + sizeof(api->guest_call) ||
        !api->guest_call || !api->hook_install_ex)
        return POP_E_ABI;
    host = api;
    const char *trace = std::getenv("RECOMP_ALCHEMIST_RECRUIT_TRACE");
    traceRecruitment = trace && !std::strcmp(trace, "1");
    const char *combat = std::getenv("RECOMP_ALCHEMIST_COMBAT_TRACE");
    traceCombat = combat && !std::strcmp(combat, "1");
    const char *attributes = std::getenv("RECOMP_ALCHEMIST_ATTRIBUTE_COMPAT");
    attributeCompat = attributes && !std::strcmp(attributes, "1");
    const char *panels = std::getenv("RECOMP_ALCHEMIST_PANEL_BRIDGE");
    panelBridge = panels && !std::strcmp(panels, "1");
    const char *research = std::getenv("RECOMP_ALCHEMIST_RESEARCH_BRIDGE");
    researchBridge = panelBridge && research && !std::strcmp(research, "1");
    const char *actions = std::getenv("RECOMP_ALCHEMIST_ACTION_BRIDGE");
    actionBridge = researchBridge && actions && !std::strcmp(actions, "1");
    const char *targets = std::getenv("RECOMP_ALCHEMIST_TARGET_BRIDGE");
    targetBridge = actionBridge && targets && !std::strcmp(targets, "1");
    const char *targetTest = std::getenv("RECOMP_ALCHEMIST_TEST_TARGET_COMMAND");
    controlledTarget = targetBridge && targetTest && !std::strcmp(targetTest, "1797");
    const char *party = std::getenv("RECOMP_ALCHEMIST_TEST_PARTY_LEVELS");
    controlledParty = researchBridge && party && !std::strcmp(party, "1");
    const char *stock = std::getenv("RECOMP_ALCHEMIST_TEST_REAGENTS");
    controlledStock = actionBridge && stock && !std::strcmp(stock, "25");
    const char *death = std::getenv("RECOMP_ALCHEMIST_TEST_PHOENIX_DEATH");
    controlledDeath = researchBridge && death && !std::strcmp(death, "1719");
    const char *delay = std::getenv("RECOMP_ALCHEMIST_TEST_PHOENIX_DELAY_MS");
    controlledDeathDelay = delay && !std::strcmp(delay, "10000") ? 10000 : 0;
    const char *shared = std::getenv("RECOMP_ALCHEMIST_SHARED_FUNCTIONS");
    sharedFunctions = shared && !std::strcmp(shared, "1");
    if (sharedFunctions) {
        const auto raw = file("shared-overrides.tsv", 32768);
        std::istringstream input(std::string(raw.begin(), raw.end()));
        std::string line;
        require(bool(std::getline(input, line)) && line == "majesty-alchemist-shared-gpl-v1",
                "shared function route version");
        while (std::getline(input, line)) {
            const auto tab = line.find('\t');
            require(tab != std::string::npos && tab > 0 && tab < 101,
                    "shared function route shape");
            const auto name = line.substr(0, tab), alias = line.substr(tab + 1);
            require(alias == "MJA_" + name && alias.size() < 128 &&
                        name.find_first_not_of(
                            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_0123456789") ==
                            std::string::npos &&
                        sharedAliases.emplace(folded(name), alias).second,
                    "shared function route identity");
        }
        require(!sharedAliases.empty() && sharedAliases.size() <= 128,
                "shared function route bound");
    }
    const auto n = file("features.bin", 1024 * 1024),
               c = file("controllers.bin", MajestyStockControllers::kMaximumRegistryBytes);
    std::string error;
    require(n.size() >= 8 && n[4] == 1 && !n[5] && !n[6] && !n[7], "MMFR version");
    require(c.size() >= 8 && c[4] == 20 && !c[5] && !c[6] && !c[7], "MMCR version");
    require(MajestyRuntimeFeatures::ParseRegistry(n.data(), n.size(), &features, &error),
            "original MMFR parser");
    require(MajestyStockControllers::ParseRegistry(c.data(), c.size(), &recipes, &error),
            "original MMCR parser");
    if (host->guest_alloc(host, 256, &scratch) != POP_OK)
        return POP_E_RANGE;
    for (const auto a :
         {0x004cd8d0U, 0x004ca4f0U, 0x00465f00U, 0x00465270U, 0x0047a360U, 0x0047a760U}) {
        std::uint32_t id = 0;
        const auto status = host->hook_install_ex(host, a, 0, hook, POP_HOOK_WRAP,
                                                  POP_HOOK_NO_GAME_VIEW, nullptr, &id);
        if (status != POP_OK)
            return status;
        hooks.push_back(id);
    }
    host->log(host, "Private Alchemist names/factory/setup probe loaded; original AP69 method "
                    "eligibility is unchanged. Private dispatch is explicitly opt-in.");
    if (panelBridge) {
        for (const auto address : {0x00466110U, 0x004652a0U, 0x0043dfc0U, 0x0043e250U, 0x0043ee80U,
                                   0x005b6670U, 0x00418660U, 0x0043ddb0U, 0x0043de30U, 0x0043ded0U,
                                   0x0042ee50U}) {
            std::uint32_t id = 0;
            const auto status = host->hook_install_ex(host, address, 0, hook, POP_HOOK_WRAP,
                                                      POP_HOOK_NO_GAME_VIEW, nullptr, &id);
            if (status != POP_OK)
                return status;
            hooks.push_back(id);
        }
        host->log(host, "Private AP69 instances use original RET4/RET16 dispatch bridges.");
    }
    if (researchBridge) {
        require(read(0x006c2028U) == 0x2009U && read(0x006c202cU) == 0x004abf70U &&
                    read(0x006c2030U) == 0x200bU && read(0x00682950U + 0x8c) == 0x005d9680U,
                "original research completion and simulation dispatch bindings");
        for (const auto address : {0x004abf70U, 0x005d9680U, 0x00628e60U}) {
            std::uint32_t id = 0;
            const auto status = host->hook_install_ex(host, address, 0, hook, POP_HOOK_WRAP,
                                                      POP_HOOK_NO_GAME_VIEW, nullptr, &id);
            if (status != POP_OK)
                return status;
            hooks.push_back(id);
        }
        host->log(host, "Private research route enabled through original queue/update/event2009.");
    }
    if (controlledDeath) {
        std::uint32_t id = 0;
        const auto status = host->hook_install_ex(host, 0x005a1c40U, 0, hook, POP_HOOK_WRAP,
                                                  POP_HOOK_NO_GAME_VIEW, nullptr, &id);
        if (status != POP_OK)
            return status;
        hooks.push_back(id);
    }
    if (sharedFunctions && !researchBridge) {
        std::uint32_t id = 0;
        const auto status = host->hook_install_ex(host, 0x00628e60U, 0, hook, POP_HOOK_WRAP,
                                                  POP_HOOK_NO_GAME_VIEW, nullptr, &id);
        if (status != POP_OK)
            return status;
        hooks.push_back(id);
    }
    if (actionBridge)
        for (const auto address : {0x0047dd10U, 0x004e3520U}) {
            std::uint32_t id = 0;
            const auto status = host->hook_install_ex(host, address, 0, hook, POP_HOOK_WRAP,
                                                      POP_HOOK_NO_GAME_VIEW, nullptr, &id);
            if (status != POP_OK)
                return status;
            hooks.push_back(id);
        }
    if (targetBridge)
        for (const auto address : {0x004380c0U, 0x0047b130U, 0x0047b220U, 0x004a7420U, 0x004a60b0U,
                                   0x005ae750U, 0x005cd860U}) {
            std::uint32_t id = 0;
            const auto status = host->hook_install_ex(host, address, 0, hook, POP_HOOK_WRAP,
                                                      POP_HOOK_NO_GAME_VIEW, nullptr, &id);
            if (status != POP_OK)
                return status;
            hooks.push_back(id);
        }
    if (traceRecruitment || traceCombat || attributeCompat || sharedFunctions) {
        std::vector<std::uint32_t> extraHooks{0x006381b0U};
        if (traceRecruitment)
            extraHooks.push_back(0x0063cb20U);
        if (traceRecruitment || sharedFunctions)
            extraHooks.push_back(0x00631b40U);
        if (sharedFunctions)
            extraHooks.push_back(0x00631ba0U);
        if (traceRecruitment)
            extraHooks.push_back(0x0062a810U);
        if (traceRecruitment)
            extraHooks.push_back(0x0062a890U);
        if (traceRecruitment)
            extraHooks.push_back(0x0062abf0U);
        if (traceRecruitment) {
            extraHooks.push_back(0x0062a6a0U);
            extraHooks.push_back(0x0062a7c0U);
        }
        if (attributeCompat)
            extraHooks.push_back(0x00424f10U);
        for (const auto a : extraHooks) {
            std::uint32_t id = 0;
            const auto status = host->hook_install_ex(host, a, 0, hook, POP_HOOK_WRAP,
                                                      POP_HOOK_NO_GAME_VIEW, nullptr, &id);
            if (status != POP_OK)
                return status;
            hooks.push_back(id);
        }
    }
    return POP_OK;
}
extern "C" POP_MOD_EXPORT PopModStatus pop_mod_exit() {
    DispatchOps ops;
    privateDispatch.clear(ops);
    for (const auto id : hooks)
        host->hook_remove(host, id);
    hooks.clear();
    sharedResolved.clear();
    sharedAliases.clear();
    sharedLookupDepth = 0;
    targetOwner = {};
    targetExecution = {};
    targetBeginDepth = 0;
    targetDescriptors.clear();
    targetSpawnMethods.clear();
    if (scratch)
        host->guest_free(host, scratch);
    scratch = 0;
    attributeFunction = 0;
    return POP_OK;
}
