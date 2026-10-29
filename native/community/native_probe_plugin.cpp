// Private live-guest qualification through the official mod API; not a public
// content build.
#include "RuntimeFeatureRegistry.h"
#include "community_names.h"
#include "controller_dispatch.h"
#include "controller_lifecycle.h"
#include "equipment_registration.h"
#include "gpl_attribute_bridge.h"
#include "gpl_base_timing_helpers.h"
#include "gpl_world_queries.h"
#include "gpl_integer_helpers.h"
#include "gpl_research_helpers.h"
#include "gpl_spell_timing_helpers.h"
#include "movement_scale.h"
#include "name_registration.h"
#include "private_intent_text.h"
#include "optional_expansion_effectors.h"
#include "optional_expansion_spells.h"
#include "pop_mod_api.h"
#include "research_activity.h"
#include "research_descriptors.h"
#include "resource_meter.h"
#include "shared_function_routes.h"
#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
#include "expansion_panel_runtime.h"
#include "guild_gameplay_runtime.h"
#include "hero_ui_runtime.h"
#include "movement_runtime.h"
#endif
#include "fog_reveal_identity.h"
#include "kingdom_research_descriptors.h"
#include "map_selection_identity.h"
#include "rage_dispatch.h"
#include "upgrade_research_gate.h"
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
bool controlledCommunityGpl = false, controlledCommunityGplApplied = false;
bool controlledCommunityGplActive = false, controlledCommunityGplReload = false;
bool controlledEquipment = false, controlledEquipmentApplied = false;
MajestyRuntimeFeatures::Registry equipmentFeatures;
std::uint32_t equipmentPresenter = 0;
bool integerHelpers = false, controlledIntegers = false, controlledIntegersApplied = false;
std::map<std::uint32_t, MajestyCommunity::IntegerHelper> integerFunctions;
bool baseTimingHelpers = false, controlledBaseTiming = false, controlledBaseTimingApplied = false;
std::map<std::uint32_t, MajestyCommunity::BaseTimingHelper> baseTimingFunctions;
bool spellTimingHelpers = false, controlledSpellTiming = false,
     controlledSpellTimingApplied = false;
bool controlledSpellExpiryApplied = false;
std::uint32_t controlledSpellUnit = 0, controlledSpellIdentity = 0, controlledSpellStarted = 0,
              controlledSpellSourceValue = 0;
MajestyRuntimeFeatures::Registry timingFeatures;
std::map<std::uint32_t, MajestyCommunity::SpellTimingHelper> spellTimingFunctions;
bool worldQueryHelpers = false;
bool controlledWorldQueries = false, controlledWorldQueriesApplied = false;
bool privateIntents = false, controlledPrivateIntents = false,
     controlledPrivateIntentsApplied = false;
MajestyCommunity::PrivateIntentText privateIntentText;
std::uint64_t privateIntentLookups = 0;
bool expansionPanels = false;
bool controlledExpansionPanels = false, controlledExpansionPanelsApplied = false;
bool controlledExpansionPlay = false;
bool controlledExpansionReload = false;
bool controlledExpansionQuestRefresh = false;
bool singlePlayerOnly = false;
bool controlledSinglePlayer = false;
bool traceExpansionGpl = false;
bool traceExpansionGplCalls = false;
void beginControlledExpansionPlay(std::uint32_t, std::uint32_t, std::uint32_t);
void runControlledExpansionPlay();
void runControlledExpansionReload();
void runControlledExpansionPanels(std::uint32_t);
std::map<std::uint32_t, MajestyCommunity::WorldQuery> worldQueryFunctions;
bool researchQueryHelpers = false, controlledResearchQuery = false,
     controlledResearchQueryApplied = false;
MajestyRuntimeFeatures::Registry researchQueryFeatures;
MajestyRuntimeFeatures::Registry heroUiCompatibility;
std::vector<MajestyCommunity::ResearchBinding> researchBindings;
MajestyCommunity::ResearchInFlight researchFlight;
MajestyCommunity::KingdomResearchDescriptors kingdomResearchDescriptors;
std::map<std::uint32_t, MajestyCommunity::ResearchQuery> researchQueryFunctions;
bool communityProcess = false;
bool controlledProfileIo = false, controlledProfileIoApplied = false;
bool movementScale = false;
std::uint32_t movementEntry = 0;
bool spellOrigin = false;
bool controlledMarch = false, controlledMarchApplied = false, controlledMarchScaled = false,
     controlledMarchExpired = false;
std::uint32_t controlledMarchStarted = 0, controlledOriginCount = 0, controlledOriginCaster = 0;
std::vector<MajestyRuntimeFeatures::NameGeneratorRecord> communityNames;
std::uint32_t communityResearchEntry = 0;
#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
MajestyStockControllers::Registry communityRecipes;
std::uint32_t read(std::uint32_t);
bool privateResearch(std::uint32_t unit, std::uint32_t command) {
    if (!unit)
        return false;
    for (const auto &binding : researchBindings)
        if (binding.nativeFamily == (read(unit + 0x6c) & 0xffffffU) &&
            binding.record.actionControlId == command)
            return true;
    return false;
}
#endif
unsigned controlledEmptyLists = 0;
std::uint32_t controlledLedgerAgent = 0;
bool controlledStock = false, controlledStockApplied = false;
bool controlledDeath = false, controlledDeathApplied = false;
std::uint32_t controlledDeathUnit = 0, controlledDeathClock = 0, controlledDeathDelay = 0;
bool controlledTarget = false, controlledTargetApplied = false;
bool researchCompletionStaged = false;
std::uint32_t researchController = 0;
std::uint64_t researchControllerGeneration = 0;
std::uint32_t attributeFunction = 0;
std::uint32_t optionalEffectorFunction = 0;
MajestyCommunity::OptionalExpansionEffectors optionalExpansion;
std::uint32_t optionalSpellFunction = 0;
MajestyCommunity::OptionalExpansionSpells optionalExpansionSpells;
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
    const auto status =
        host->guest_call(host, a, self, args.begin(), static_cast<std::uint32_t>(args.size()), &v);
    if (status != POP_OK)
        std::fprintf(stderr, "[community-call] target=%08x arguments=%zu status=%d\n", a,
                     args.size(), static_cast<int>(status));
    require(status == POP_OK, "original guest call");
    return v;
}
void next(PopHookInvocation *inv, pop_cpu_v1 *cpu) {
    require(host->call_next(host, inv, cpu) == POP_OK, "original hook continuation");
}
void returned(pop_cpu_v1 *cpu, std::uint32_t value) {
    require(host->hook_return(host, cpu, value, 4) == POP_OK, "original ret4 discipline");
}
struct EquipmentOps {
    std::uint32_t memory = 0;
    EquipmentOps() {
        require(host->guest_alloc(host, 64, &memory) == POP_OK, "equipment original call storage");
    }
    ~EquipmentOps() {
        require(host->guest_free(host, memory) == POP_OK, "equipment original call release");
    }
    std::uint32_t read(std::uint32_t address) {
        return ::read(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        ::write(address, value);
    }
    std::uint32_t nameSlot(std::uint32_t map, std::uint32_t id) {
        write(memory, id);
        return call(0x004c1bc0U, map, {memory});
    }
    std::uint32_t iconSlot(std::uint32_t map, std::uint32_t id) {
        write(memory, id);
        write(memory + 4, 0);
        call(0x004c2960U, memory + 8, {memory, memory + 4});
        call(0x004c2460U, map, {memory + 16, memory + 8});
        const auto node = read(memory + 16);
        return node ? node + 16 : 0;
    }
    std::uint32_t acquire(std::uint32_t table) {
        return call(0x004f2000U, 0, {0, table});
    }
};
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
struct IntentTextOps : DispatchOps {
    bool valid(std::uint32_t address, std::uint32_t bytes) {
        std::uint32_t ignored = 0;
        return address && bytes >= 4 && address <= UINT32_MAX - bytes &&
               host->guest_read_u32(host, address, &ignored) == POP_OK &&
               host->guest_read_u32(host, address + bytes - 4, &ignored) == POP_OK;
    }
    void writeByte(std::uint32_t address, unsigned char value) {
        require(host->guest_write_u8(host, address, value) == POP_OK, "private intent bytes");
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

// Original Old GPL scalar call wrapper. Preserve its actual function binding,
// argument/result references, typed values and normal-return cleanup.
bool evaluateScalar(const std::string &symbol, std::uint32_t unit, std::int32_t operation,
                    std::uint32_t &result, bool includeOperation = true) {
    if (symbol.empty() || symbol.size() > 120 || !unit)
        return false;
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 256, &memory) == POP_OK, "GPL scalar native storage");
    for (unsigned i = 0; i <= symbol.size(); ++i)
        require(host->guest_write_u8(host, memory + 128 + i, symbol[i]) == POP_OK,
                "GPL scalar symbol");
    call(0x004e3520U, memory, {memory + 128});
    const auto evaluator = memory + 32;
    call(0x00629910U, evaluator, {memory});
    call(0x004e3820U, memory);
    const auto binding = read(evaluator + 4);
    bool valid = binding && read(binding + 20) == 0x0061e4c0U;
    if (valid) {
        call(0x00629bf0U, evaluator);
        call(0x00629a20U, evaluator, {unit});
        if (includeOperation)
            call(0x00629a40U, evaluator, {static_cast<std::uint32_t>(operation)});
        call(0x00629c40U, evaluator);
        const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
        valid = begin && end >= begin && end - begin >= 4 && end - begin <= 64;
        if (valid) {
            const auto reference = read(begin), value = reference ? read(reference) : 0;
            valid = value && read(value + 4) == 1;
            if (valid)
                result = call(0x00629c10U, evaluator);
        }
    }
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "GPL scalar native release");
    return valid;
}

bool invokeAgentPair(const char *symbol, std::uint32_t first, std::uint32_t second,
                     bool scalarResult) {
    const auto length = std::strlen(symbol);
    require(length && length < 120, "two-agent callback name bound");
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 256, &memory) == POP_OK, "spell origin evaluator storage");
    for (unsigned i = 0; i <= length; ++i)
        require(host->guest_write_u8(host, memory + 128 + i, symbol[i]) == POP_OK,
                "spell origin callback name");
    call(0x004e3520U, memory, {memory + 128});
    const auto evaluator = memory + 32;
    call(0x00629910U, evaluator, {memory});
    call(0x004e3820U, memory);
    const auto binding = read(evaluator + 4);
    bool valid = binding && read(binding + 20) == 0x0061e4c0U;
    if (valid) {
        call(0x00629bf0U, evaluator);
        call(0x00629a20U, evaluator, {first});
        call(0x00629a20U, evaluator, {second});
        call(0x00629c40U, evaluator);
        if (scalarResult) {
            const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
            // Old keeps both typed argument references beside the return
            // reference after GPL evaluation: three slots, not just one.
            valid = begin && end >= begin && end - begin == 12;
            if (valid) {
                const auto reference = read(begin), value = reference ? read(reference) : 0;
                const auto firstValue = read(read(begin + 4)), secondValue = read(read(begin + 8));
                valid = value && firstValue && secondValue && read(value + 4) == 1 &&
                        read(firstValue + 4) == 5 && read(secondValue + 4) == 5 &&
                        call(0x00629c10U, evaluator) == 1;
            }
        }
    }
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "spell origin evaluator release");
    return valid;
}
bool recordSpellOrigin(std::uint32_t spell, std::uint32_t caster) {
    return invokeAgentPair("MM_SO_Record", spell, caster, true);
}

// One explicitly requested private probe, never a player save. This isolates
// the original CreateFile/WriteFile ABI from the game's save serializer.
void runControlledProfileIo() {
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 512, &memory) == POP_OK, "profile IO probe storage");
    const char path[] = "Documents\\My Games\\MajestyHD\\SaveGame\\community2265-io.tmp";
    const char payload[] = "native-write-probe";
    for (unsigned i = 0; i < sizeof(path); ++i)
        require(host->guest_write_u8(host, memory + 64 + i, path[i]) == POP_OK, "profile IO path");
    for (unsigned i = 0; i < sizeof(payload); ++i)
        require(host->guest_write_u8(host, memory + 256 + i, payload[i]) == POP_OK,
                "profile IO bytes");
    const auto file = call(read(0x0067f118U), 0, {memory + 64, 0x40000000U, 0, 0, 2, 0x80, 0});
    std::uint32_t wrote = 0, result = 0, closed = 0;
    if (file && file != 0xffffffffU) {
        result = call(read(0x0067f144U), 0, {file, memory + 256, sizeof(payload), memory, 0});
        wrote = read(memory);
        closed = call(read(0x0067f090U), 0, {file});
    }
    std::fprintf(stderr,
                 "[community-profile-io] file=%08x result=%u expected=%u "
                 "wrote=%u closed=%u\n",
                 file, result, static_cast<unsigned>(sizeof(payload)), wrote, closed);
    require(host->guest_free(host, memory) == POP_OK, "profile IO probe release");
    controlledProfileIoApplied = true;
}

std::uint32_t evaluateAgentResult(const std::string &symbol) {
    require(!symbol.empty() && symbol.size() <= 120, "GPL agent result symbol");
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 256, &memory) == POP_OK, "GPL agent result native storage");
    for (unsigned i = 0; i <= symbol.size(); ++i)
        require(host->guest_write_u8(host, memory + 128 + i, symbol[i]) == POP_OK,
                "GPL agent result symbol write");
    call(0x004e3520U, memory, {memory + 128});
    const auto evaluator = memory + 32;
    call(0x00629910U, evaluator, {memory});
    call(0x004e3820U, memory);
    const auto binding = read(evaluator + 4);
    require(binding && read(binding + 20) == 0x0061e4c0U, "GPL agent result interpreted binding");
    // The stock constructor starts with integer result zero. Use its own
    // drain/append/rebuild methods to supply a typed NullAgent return slot.
    call(0x00637780U, evaluator + 8);
    call(0x006362a0U, evaluator + 8, {0});
    call(0x00637e10U, evaluator + 0x1c, {evaluator + 8});
    call(0x00629c40U, evaluator);
    const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
    require(begin && end >= begin && end - begin >= 4 && end - begin <= 64,
            "GPL agent result span");
    const auto reference = read(begin), value = reference ? read(reference) : 0;
    require(value && read(value + 4) == 5, "GPL agent result native tag");
    const auto agentReference = call(read(read(value) + 0x5c), value);
    const auto result = call(0x006255e0U, agentReference);
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "GPL agent result native release");
    return result;
}

void runControlledCommunityGpl() {
    const auto manager = call(0x00415b40U, 0), player = read(manager + 0x24);
    const auto palace = call(0x00418b50U, manager, {player});
    if (!palace || !read(palace + 0x60))
        return;
    controlledCommunityGplApplied = true;
    controlledCommunityGplActive = true;
    controlledEmptyLists = 0;
    controlledLedgerAgent = 0;
    const std::string status = "MM_KR_61f71999deb595c08a9e9fd4ad74ab25";
    for (const auto &test : std::vector<std::pair<std::string, std::pair<std::int32_t, unsigned>>>{
             {status, {3, 3}},
             {status, {3, 3}},
             {"MM_Toggle_Bards_Hiring_Closed", {-1, 0}},
             {"MM_Toggle_Bards_Hiring_Closed", {1, 1}},
             {"MM_Toggle_Bards_Hiring_Closed", {-1, 1}},
             {"MM_Toggle_Bards_Hiring_Closed", {0, 0}}}) {
        std::uint32_t result = 0xffffffff;
        require(evaluateScalar(test.first, palace, test.second.first, result),
                "controlled original authored GPL scalar binding/result");
        std::fprintf(stderr,
                     "[community-gpl-control] symbol=%s operation=%d result=%u "
                     "expected=%u\n",
                     test.first.c_str(), test.second.first, result, test.second.second);
        require(result == test.second.second, "controlled authored GPL scalar result");
    }
    controlledCommunityGplActive = false;
    const auto root = evaluateAgentResult(status + "_Root");
    require(root && controlledEmptyLists == (controlledCommunityGplReload ? 0U : 3U) &&
                (controlledCommunityGplReload || root == controlledLedgerAgent),
            "authored native ledger creation or original saved ledger restoration");
    controlledLedgerAgent = root;
    std::vector<std::uint32_t> lists;
    for (const char *suffix : {"_done", "_pending", "_available"}) {
        const auto key = status + suffix;
        std::uint32_t storage = 0;
        require(host->guest_alloc(host, 256, &storage) == POP_OK, "ledger check native text");
        for (unsigned i = 0; i <= key.size(); ++i)
            require(host->guest_write_u8(host, storage + 128 + i, key[i]) == POP_OK,
                    "ledger check key");
        call(0x004e3520U, storage, {storage + 128});
        const auto value = call(0x006263d0U, controlledLedgerAgent, {storage});
        require(value && read(value + 4) == 4 && !read(value + 0x10) &&
                    std::find(lists.begin(), lists.end(), value) == lists.end(),
                "native research ledger owns three distinct empty lists");
        lists.push_back(value);
        std::fprintf(stderr, "[community-gpl-control] native-list=%s type=4 size=0 distinct=1\n",
                     key.c_str());
        call(0x004e3820U, storage);
        require(host->guest_free(host, storage) == POP_OK, "ledger check native release");
    }
    host->log(host, controlledCommunityGplReload
                        ? "Controlled community GPL: original save restored native research "
                          "lists "
                          "and hiring state."
                        : "Controlled community GPL: native empty research ledgers and saved "
                          "hiring toggle passed.");
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
    host->log(host, "Controlled fixture initialized exactly25 reagents; ordinary "
                    "collection unqualified.");
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
                         "[alchemist-research] original-world=%08x table=%08x "
                         "update-entry=%08x\n",
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
void runControlledEquipment() {
    const auto presenter = call(0x004c0760U, 0);
    require(presenter == 0x006d8818U && presenter == equipmentPresenter,
            "original equipment singleton construction and registration");
    EquipmentOps ops;
    for (const auto &record : equipmentFeatures.equipment) {
        const auto name =
            ops.nameSlot(presenter + (record.slot == 0 ? 0x10 : 0), record.equipmentId);
        const auto icon =
            ops.iconSlot(presenter + (record.slot == 0 ? 0x20 : 0x30), record.equipmentId);
        const auto table = read(name);
        require(table && read(icon) == record.equipmentId,
                "original equipment map retains private type");
        const auto count = call(read(read(table) + 0x24), table);
        require(count >= 4 && count <= 16, "original equipment quality name count");
        for (unsigned rank = 0; rank < count; ++rank) {
            const auto text = call(0x004f2040U, 0, {table, 0xffffffffU, rank});
            require(text != 0, "actual authored equipment quality name");
            call(0x004e35f0U, ops.memory + 32, {text});
            const auto value = guestString(ops.memory + 32);
            call(0x004e3820U, ops.memory + 32);
            require(!value.empty() && value.size() <= 80, "authored equipment name bound");
            std::fprintf(stderr, "[community-equipment] id=%06x slot=%u rank=%u name=%s\n",
                         record.equipmentId, record.slot, rank, value.c_str());
        }
    }
    require(call(0x004c0760U, 0) == presenter, "original singleton repeated getter");
    controlledEquipmentApplied = true;
    host->log(host, "Controlled community equipment: original singleton maps and "
                    "authored quality "
                    "names passed.");
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
struct AttributeOps {
    bool valid(std::uint32_t address, std::uint32_t bytes) {
        std::uint32_t ignored = 0;
        return address && bytes >= 4 && address <= UINT32_MAX - bytes &&
               host->guest_read_u32(host, address, &ignored) == POP_OK &&
               host->guest_read_u32(host, address + bytes - 4, &ignored) == POP_OK;
    }
    std::uint32_t read(std::uint32_t address) {
        return ::read(address);
    }
    std::uint32_t reference(std::uint32_t value, std::uint32_t offset) {
        return valueRef(value, offset);
    }
    std::string text(std::uint32_t address) {
        return guestString(address);
    }
    std::uint32_t call(std::uint32_t address, std::uint32_t self,
                       std::initializer_list<std::uint32_t> args) {
        return ::call(address, self, args);
    }
};
struct IntegerOps : AttributeOps {
    std::uint32_t integer(std::uint32_t value) {
        return valueRef(value, 0x28);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        ::write(address, value);
    }
    std::uint32_t now() {
        return ::read(0x0071c6a8U);
    }
};
struct ExpansionEffectorOps : AttributeOps {
    std::uint8_t byte(std::uint32_t address) {
        std::uint8_t value = 0;
        require(host->guest_read_u8(host, address, &value) == POP_OK, "effector name byte");
        return value;
    }
    std::uint32_t catalog() {
        return ::read(0x0071c6c8U);
    }
    std::uint32_t find(std::uint32_t catalog, std::uint32_t name) {
        return ::call(0x0059c060U, catalog, {name});
    }
    void resetBoolean(std::uint32_t value) {
        // Old.exe CBool::Reset is MOV BYTE PTR [ECX+8],0; RET at 006437c0.
        // Use its original virtual operation, preserving tag and ownership.
        const auto method = ::read(::read(value) + 0x10);
        require(method == 0x006437c0U, "original native boolean reset");
        ::call(method, value);
    }
};
struct BaseTimingOps : IntegerOps {
    std::uint32_t unit(std::uint32_t value) {
        const auto reference = valueRef(value, 0x5c);
        if (!valid(reference, 16))
            return 0;
        std::uint32_t temporary = 0;
        require(host->guest_alloc(host, 16, &temporary) == POP_OK,
                "temporary native agent reference");
        for (unsigned i = 0; i < 16; i += 4)
            write(temporary + i, 0);
        write(temporary + 8, read(reference + 8));
        const auto result = call(0x00625ce0U, temporary, {});
        require(host->guest_free(host, temporary) == POP_OK, "temporary agent reference release");
        return result;
    }
    std::uint32_t action(std::uint32_t value) {
        const auto string = valueRef(value, 0x30);
        if (!valid(string, 12) || !read(string + 8) || read(string + 8) > 128)
            return 0;
        const auto catalog = ::read(0x0071c6bcU);
        return catalog ? call(0x0059c060U, catalog, {read(string)}) : 0;
    }
};
struct WorldQueryOps : BaseTimingOps {
    std::uint32_t point(std::uint32_t value) {
        const auto coordinate = valueRef(value, 0x58);
        if (!valid(coordinate, 8) || read(coordinate + 4) != 7)
            return 0;
        return valueRef(coordinate, 0x3c);
    }
    std::uint32_t unitType(std::uint32_t value) {
        const auto string = valueRef(value, 0x30);
        if (!valid(string, 12) || !read(string + 8) || read(string + 8) > 128)
            return 0;
        const auto catalog = ::read(0x0071c6c8U);
        return catalog ? call(0x0059c060U, catalog, {read(string)}) : 0;
    }
    int attribute(std::uint32_t unit, std::uint32_t id) {
        return MajestyCommunity::NativeSignedInteger(call(0x005a1c40U, unit, {id, 0}));
    }
    int interval(std::uint32_t unit) {
        return MajestyCommunity::NativeSignedInteger(call(0x00430770U, unit, {}));
    }
    bool hasEffector(std::uint32_t unit, std::uint32_t overlay) {
        return call(0x005b4570U, unit, {overlay}) != 0;
    }
    int distance(std::uint32_t unit, int base) {
        return movementScale ? MajestyCommunity::CurrentMovementStep(
                                   *this, unit, base, 0, researchQueryFeatures.movementScales)
                             : base;
    }
};
struct SpellTimingOps : BaseTimingOps {
    std::uint32_t timingDescription(std::uint32_t value, bool spell, int &status) {
        status = MajestyNativeTiming::kInvalid;
        const auto string = valueRef(value, 0x30);
        if (!valid(string, 12) || !read(string + 8) || read(string + 8) > 128)
            return 0;
        const auto catalog = read(spell ? 0x0071c6bcU : 0x0071c6c8U);
        const auto description = catalog ? call(0x0059c060U, catalog, {read(string)}) : 0;
        if (!description || !valid(description, 8))
            return 0;
        const auto &ids = spell ? timingFeatures.timingSpellIds : timingFeatures.timingEffectorIds;
        if (!std::binary_search(ids.begin(), ids.end(), read(description + 4))) {
            status = MajestyNativeTiming::kUndeclared;
            return 0;
        }
        return description;
    }
};
struct ResearchQueryOps : BaseTimingOps {
    std::uint32_t attribute(std::uint32_t unit, std::uint32_t id) {
        return call(0x005a1c40U, unit, {id, 0});
    }
};
std::vector<std::uint32_t> evaluateBuiltinIntegers(const char *symbol,
                                                   std::initializer_list<std::uint32_t> arguments) {
    const auto length = std::strlen(symbol);
    require(length && length < 64 && arguments.size() <= 3, "native integer test signature");
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 256, &memory) == POP_OK, "native integer evaluator storage");
    for (unsigned i = 0; i <= length; ++i)
        require(host->guest_write_u8(host, memory + 128 + i, symbol[i]) == POP_OK,
                "native integer evaluator symbol");
    call(0x004e3520U, memory, {memory + 128});
    const auto evaluator = memory + 32;
    call(0x00629910U, evaluator, {memory});
    call(0x004e3820U, memory);
    const auto binding = read(evaluator + 4);
    require(binding && read(binding + 20) == 0x005a9600U && integerFunctions.count(binding),
            "actual registered native integer binding");
    call(0x00629bf0U, evaluator);
    for (const auto argument : arguments)
        call(0x00629a40U, evaluator, {argument});
    call(0x00629c40U, evaluator);
    const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
    require(begin && end >= begin && end - begin == (arguments.size() + 1) * 4,
            "actual native integer result and mutable argument span");
    IntegerOps ops;
    std::vector<std::uint32_t> values;
    for (unsigned i = 0; i < arguments.size() + 1; ++i) {
        const auto value = read(read(begin + i * 4));
        require(value && read(value + 4) == 1, "actual native integer value tag");
        const auto storage = ops.integer(value);
        require(ops.valid(storage, 4), "actual native integer storage");
        values.push_back(read(storage));
    }
    require(call(0x00629c10U, evaluator) == values[0], "original native integer result accessor");
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "native integer evaluator release");
    std::fprintf(stderr, "[community-integer] symbol=%s result=%u arguments=%u", symbol, values[0],
                 static_cast<unsigned>(arguments.size()));
    for (unsigned i = 1; i < values.size(); ++i)
        std::fprintf(stderr, " argument%u=%u", i, values[i]);
    std::fprintf(stderr, "\n");
    return values;
}
void runControlledIntegers() {
    const auto clock = evaluateBuiltinIntegers("MM_SimulationTime", {});
    require(clock[0] == read(0x0071c6a8U), "raw original simulation clock bits");
    require(evaluateBuiltinIntegers("MM_SimulationElapsed", {clock[0] - 123})[0] == 123,
            "original clock elapsed interval");
    require(evaluateBuiltinIntegers("MM_SimulationElapsed", {})[0] == 0xffffffffU,
            "missing elapsed input retains authored invalid result");
    require(evaluateBuiltinIntegers("MM_KR_CapAdd", {0x7ffffffeU, 500})[0] == 0x7fffffffU,
            "native earned-value overflow cap");
    require(evaluateBuiltinIntegers("MM_KR_CapAdd", {17, 0xffffffffU})[0] == 17,
            "native negative bonus guard");
    const auto award = evaluateBuiltinIntegers("MM_KR_AwardBonus", {7, 15, 95});
    require(award[0] == 2 && award[3] == 0, "authored native award and in/out carry");
    const auto nextAward = evaluateBuiltinIntegers("MM_KR_AwardBonus", {7, 15, award[3]});
    require(nextAward[0] == 1 && nextAward[3] == 5, "authored next award fractional carry");
    const auto invalid = evaluateBuiltinIntegers("MM_KR_AwardBonus", {7, 15, 100});
    require(invalid[0] == 0 && invalid[3] == 100, "invalid native carry is preserved");
    const auto maximum = evaluateBuiltinIntegers("MM_KR_AwardBonus", {0x7fffffffU, 100, 99});
    require(maximum[0] == 0x7fffffffU && maximum[3] == 99, "full native integer earned range");
    controlledIntegersApplied = true;
    host->log(host, "Controlled community integer helpers: original clock, cap, "
                    "bonus and mutable "
                    "carry passed.");
}
std::uint32_t evaluateBuiltinBaseTiming(const char *symbol, const char *name, std::uint32_t unit,
                                        bool agentArgument) {
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 512, &memory) == POP_OK, "base timing evaluator storage");
    const auto putText = [&](std::uint32_t destination, const char *text) {
        const auto length = std::strlen(text);
        require(length < 128, "base timing text bound");
        for (unsigned i = 0; i <= length; ++i)
            require(host->guest_write_u8(host, destination + i, text[i]) == POP_OK,
                    "base timing text write");
    };
    putText(memory + 128, symbol);
    call(0x004e3520U, memory, {memory + 128});
    const auto evaluator = memory + 32;
    call(0x00629910U, evaluator, {memory});
    call(0x004e3820U, memory);
    const auto binding = read(evaluator + 4);
    require(binding && baseTimingFunctions.count(binding) && read(binding + 20) == 0x005a9600U,
            "actual native base timing binding");
    call(0x00629bf0U, evaluator);
    if (agentArgument) {
        call(0x00629a20U, evaluator, {unit});
    } else {
        putText(memory + 256, name);
        call(0x004e3520U, memory + 80, {memory + 256});
        const auto runtime = read(read(0x007218b4U) + 0x10), pool = read(runtime + 0x1c);
        const auto value = call(0x0062a810U, pool, {3});
        require(value && read(value + 4) == 3, "original typed string value allocation");
        const auto string = valueRef(value, 0x30);
        call(0x004e4180U, string, {memory + 80});
        call(0x004e3820U, memory + 80);
        // Native Any-value append takes ownership, exactly as its original
        // list overload does. It also rebuilds the native argument references.
        call(0x00636bf0U, evaluator + 8, {value});
    }
    const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
    require(begin && end >= begin && end - begin == 8 &&
                read(read(read(begin + 4)) + 4) == (agentArgument ? 5U : 3U),
            "original typed timing input reference");
    call(0x00629c40U, evaluator);
    const auto result = call(0x00629c10U, evaluator);
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "base timing evaluator release");
    std::fprintf(stderr, "[community-base-timing] symbol=%s result=%u input-kind=%s\n", symbol,
                 result, agentArgument ? "agent" : "string");
    return result;
}
std::uint32_t evaluateSpellTiming(const char *symbol, const char *name, std::uint32_t unit,
                                  std::uint32_t setupHandler = 0, std::uint32_t duration = 0) {
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 512, &memory) == POP_OK, "spell timing evaluator storage");
    const auto putText = [&](std::uint32_t destination, const char *text) {
        const auto length = std::strlen(text);
        require(length < 128, "spell timing text bound");
        for (unsigned i = 0; i <= length; ++i)
            require(host->guest_write_u8(host, destination + i, text[i]) == POP_OK,
                    "spell timing text write");
    };
    putText(memory + 128, symbol);
    call(0x004e3520U, memory, {memory + 128});
    const auto evaluator = memory + 32;
    call(0x00629910U, evaluator, {memory});
    call(0x004e3820U, memory);
    const auto binding = read(evaluator + 4);
    require(binding && read(binding + 20) == (setupHandler ? setupHandler : 0x005a9600U) &&
                (setupHandler || spellTimingFunctions.count(binding)),
            "original spell timing/setup function identity");
    call(0x00629bf0U, evaluator);
    call(0x00629a20U, evaluator, {unit});
    putText(memory + 256, name);
    call(0x004e3520U, memory + 80, {memory + 256});
    const auto runtime = read(read(0x007218b4U) + 0x10), pool = read(runtime + 0x1c);
    const auto value = call(0x0062a810U, pool, {3});
    require(value && read(value + 4) == 3, "original spell timing string value");
    call(0x004e4180U, valueRef(value, 0x30), {memory + 80});
    call(0x004e3820U, memory + 80);
    call(0x00636bf0U, evaluator + 8, {value});
    if (duration)
        call(0x00629a40U, evaluator, {duration});
    const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
    require(begin && end >= begin && end - begin == (duration ? 16U : 12U) &&
                read(read(read(begin + 4)) + 4) == 5 && read(read(read(begin + 8)) + 4) == 3,
            "original spell timing typed inputs");
    call(0x00629c40U, evaluator);
    const auto result = setupHandler ? 0 : call(0x00629c10U, evaluator);
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "spell timing evaluator release");
    std::fprintf(stderr, "[community-spell-timing] symbol=%s name=%s result=%u\n", symbol, name,
                 result);
    return result;
}
void controlledNativeSpellBirth(std::uint32_t caster, std::uint32_t target) {
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 512, &memory) == POP_OK,
            "controlled spell constructor storage");
    const auto text = [&](std::uint32_t where, const char *value) {
        for (unsigned i = 0; i <= std::strlen(value); ++i)
            require(host->guest_write_u8(host, where + i, value[i]) == POP_OK,
                    "controlled spell constructor text");
    };
    text(memory + 128, "CreateSpellUnit");
    call(0x004e3520U, memory, {memory + 128});
    const auto evaluator = memory + 32;
    call(0x00629910U, evaluator, {memory});
    call(0x004e3820U, memory);
    const auto binding = read(evaluator + 4);
    require(binding && read(binding + 20) == 0x00422ea0U,
            "original CreateSpellUnit handler identity");
    call(0x00629bf0U, evaluator);
    call(0x00629a20U, evaluator, {caster});
    text(memory + 256, "miasma_mist_cloud");
    call(0x004e3520U, memory + 96, {memory + 256});
    const auto runtime = read(read(0x007218b4U) + 0x10), pool = read(runtime + 0x1c);
    const auto value = call(0x0062a810U, pool, {3});
    require(value && read(value + 4) == 3, "controlled spell constructor typed name");
    call(0x004e4180U, valueRef(value, 0x30), {memory + 96});
    call(0x004e3820U, memory + 96);
    call(0x00636bf0U, evaluator + 8, {value});
    call(0x00629a20U, evaluator, {target});
    const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
    require(begin && end >= begin && end - begin == 16 && read(read(read(begin + 4)) + 4) == 5 &&
                read(read(read(begin + 8)) + 4) == 3 && read(read(read(begin + 12)) + 4) == 5,
            "original spell constructor three typed arguments");
    const auto before = controlledOriginCount;
    call(0x00629c40U, evaluator);
    require(controlledOriginCount > before && controlledOriginCaster == 627,
            "actual native birth recorded its original caster before GPL");
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "controlled spell constructor release");
}

// Isolated component fixture only: invoke the creator's actual song body and
// the original stock spell constructor. Never save this controlled world as
// campaign progress. The environment flag is absent from player builds.
void runControlledMarch() {
    const auto world = read(0x0071c68cU), manager = world ? read(world + 4) : 0;
    if (!manager || controlledMarchExpired)
        return;
    const auto dancer = call(0x005a10d0U, manager, {585});
    const auto troubadour = call(0x005a10d0U, manager, {627});
    if (!dancer || !troubadour)
        return;
    require(read(dancer + 0x6c) == 0x31745641U && read(troubadour + 0x6c) == 0x31765641U &&
                read(dancer + 0x70) == 0 && read(troubadour + 0x70) == 0,
            "controlled actual owned Dancer and Troubadour");
    if (!controlledMarchApplied) {
        require(invokeAgentPair("Bards_March_Apply", troubadour, dancer, false),
                "creator March body through original typed GPL evaluator");
        require(evaluateSpellTiming("MM_EffectorRemaining", "Bards_March_Icon", dancer) == 8000,
                "creator March owns its original eight-second native overlay");
        controlledMarchStarted = read(0x0071c6a8U);
        controlledMarchApplied = true;
        controlledNativeSpellBirth(troubadour, dancer);
        host->log(host, "Controlled creator March and original native spell birth applied.");
    } else if (read(0x0071c6a8U) - controlledMarchStarted >= 10000) {
        require(controlledMarchScaled &&
                    evaluateSpellTiming("MM_EffectorRemaining", "Bards_March_Icon", dancer) == 0,
                "actual moving Dancer scaled and original overlay expired");
        controlledMarchExpired = true;
        host->log(host, "Controlled native March: scaled movement witnessed and "
                        "overlay expired.");
    }
}

std::uint32_t evaluateResearchQuery(const char *symbol, std::uint32_t unit, std::uint32_t command) {
    std::uint32_t memory = 0;
    const auto length = std::strlen(symbol);
    require(length < 64 && host->guest_alloc(host, 256, &memory) == POP_OK,
            "research query evaluator storage");
    for (unsigned i = 0; i <= length; ++i)
        require(host->guest_write_u8(host, memory + 128 + i, symbol[i]) == POP_OK,
                "research query symbol");
    call(0x004e3520U, memory, {memory + 128});
    const auto evaluator = memory + 32;
    call(0x00629910U, evaluator, {memory});
    call(0x004e3820U, memory);
    const auto binding = read(evaluator + 4);
    require(binding && researchQueryFunctions.count(binding) && read(binding + 20) == 0x005a9600U,
            "original research query binding");
    call(0x00629bf0U, evaluator);
    call(0x00629a20U, evaluator, {unit});
    call(0x00629a40U, evaluator, {command});
    call(0x00629c40U, evaluator);
    const auto result = call(0x00629c10U, evaluator);
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "research query evaluator release");
    std::fprintf(stderr, "[community-research-query] symbol=%s command=%u result=%u\n", symbol,
                 command, result);
    return result;
}
void runControlledResearchQuery(std::uint32_t palace) {
    require(researchBindings.size() == 1 && researchBindings.front().record.requiredLevel == 3 &&
                researchBindings.front().nativeFamily == 0x00744241U,
            "source-bound original Bards family research relocation");
    const auto command = researchBindings.front().record.actionControlId;
    ActivityOps activity;
    const auto before = activity.capture(palace);
    for (const char *symbol : {"MM_KR_Eligible", "MM_KR_Order"}) {
        require(evaluateResearchQuery(symbol, palace, command) == 0,
                "stock Palace does not acquire Bards research");
        require(evaluateResearchQuery(symbol, 0, command) == 0,
                "null actor does not acquire Bards research");
        require(evaluateResearchQuery(symbol, palace, 0xffffffffU) == 0,
                "invalid signed command refused");
    }
    const auto after = activity.capture(palace);
    require(before.command == after.command && before.startedAt == after.startedAt &&
                before.duration == after.duration,
            "research query does not enqueue or edit activity");
    ResearchOps descriptors;
    if (!(read(0x006d81e0U) & 255))
        call(0x004736a0U, 0);
    const auto &record = researchQueryFeatures.kingdomResearch.front();
    const auto source = descriptors.lookup(record.descriptorTemplateControlId);
    require(source && !descriptors.lookup(command),
            "original research template and vacant private slot");
    const auto originalTime = read(source), originalNotification = read(source + 12);
    require(kingdomResearchDescriptors.prepare(descriptors, researchQueryFeatures.kingdomResearch),
            "original kingdom research descriptor registration");
    const auto descriptor = descriptors.lookup(command);
    require(descriptor && call(0x00474480U, 0, {command}) == descriptor &&
                read(descriptor) == originalTime && read(descriptor + 12) == originalNotification &&
                read(descriptor + 4) == record.requiredLevel &&
                read(descriptor + 8) == record.price &&
                read(descriptor + 16) == record.completionAttribute,
            "original lookup retrieves actual Chronicles level price completion "
            "and stock timing");
    require(descriptors.lookup(record.descriptorTemplateControlId) == source &&
                read(source) == originalTime && read(source + 12) == originalNotification &&
                kingdomResearchDescriptors.prepare(descriptors,
                                                   researchQueryFeatures.kingdomResearch) &&
                descriptors.lookup(command) == descriptor,
            "stock template preserved and repeated registration idempotent");
    std::fprintf(stderr,
                 "[community-research-descriptor] command=%u template=%u "
                 "level=%u price=%u "
                 "completion=%08x native-time=%u notification=%u\n",
                 command, record.descriptorTemplateControlId, read(descriptor + 4),
                 read(descriptor + 8), read(descriptor + 16), originalTime, originalNotification);
    controlledResearchQueryApplied = true;
    host->log(host, "Controlled community research queries: original VM "
                    "bindings, family isolation "
                    "and unchanged Palace activity passed; positive guild/order "
                    "tests pending.");
}
std::uint32_t addControlledNativeAttribute(std::uint32_t unit, const char *name, bool agent) {
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 512, &memory) == POP_OK, "controlled attribute evaluator");
    const auto putText = [&](std::uint32_t destination, const char *text) {
        const auto length = std::strlen(text);
        require(length < 128, "controlled attribute text bound");
        for (unsigned i = 0; i <= length; ++i)
            require(host->guest_write_u8(host, destination + i, text[i]) == POP_OK,
                    "controlled attribute text write");
    };
    putText(memory + 128, "AddAttribute");
    call(0x004e3520U, memory, {memory + 128});
    const auto evaluator = memory + 32;
    call(0x00629910U, evaluator, {memory});
    call(0x004e3820U, memory);
    require(read(evaluator + 4) == attributeFunction, "actual original AddAttribute binding");
    call(0x00629bf0U, evaluator);
    call(0x00629a20U, evaluator, {unit});
    const auto runtime = read(read(0x007218b4U) + 0x10), pool = read(runtime + 0x1c);
    for (const char *text : {name, agent ? "agentref" : "integer"}) {
        putText(memory + 256, text);
        call(0x004e3520U, memory + 80, {memory + 256});
        const auto value = call(0x0062a810U, pool, {3});
        require(value && read(value + 4) == 3, "controlled attribute original string allocation");
        call(0x004e4180U, valueRef(value, 0x30), {memory + 80});
        call(0x004e3820U, memory + 80);
        call(0x00636bf0U, evaluator + 8, {value});
    }
    call(agent ? 0x00629a20U : 0x00629a40U, evaluator, {agent ? unit : 0});
    call(0x00629c40U, evaluator);
    const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
    require(begin && end - begin == 20, "actual controlled attribute arity");
    const auto agentValue = read(read(begin + 4)), input = read(read(begin + 16));
    const auto nativeAgent = call(0x006255e0U, valueRef(agentValue, 0x5c));
    const auto attributeName = valueRef(read(read(begin + 8)), 0x30);
    const auto owned = call(0x006263d0U, nativeAgent, {attributeName});
    require(owned && owned != input && read(owned + 4) == (agent ? 5U : 1U),
            "original agent owns a separately allocated typed attribute");
    if (agent) {
        const auto originalRef = valueRef(input, 0x5c), copyRef = valueRef(owned, 0x5c);
        require(read(originalRef + 8) && read(copyRef + 8) == read(originalRef + 8),
                "original VM assignment copied the live agent identity");
    } else {
        require(read(valueRef(owned, 0x28)) == 0, "controlled zero modifier initializer");
    }
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "controlled attribute evaluator release");
    return owned;
}
void checkControlledSpellExpiry() {
    if (!controlledSpellUnit || read(0x0071c6a8U) - controlledSpellStarted < 8500)
        return;
    require(read(controlledSpellUnit + 0x60) == controlledSpellIdentity,
            "controlled expiry still owns the original actor");
    require(evaluateSpellTiming("MM_EffectorRemaining", "Bards_March_Legacy_Icon",
                                controlledSpellUnit) == 0,
            "original expired effect is absent");
    require(read(controlledSpellSourceValue + 4) == 5 &&
                read(valueRef(controlledSpellSourceValue, 0x5c) + 8) == 0xffffffffU,
            "authored End callback cleared original owned agent reference");
    controlledSpellExpiryApplied = true;
    host->log(host, "Controlled community spell expiry: original authored End "
                    "callback cleared "
                    "owned agentref and expired effect is absent.");
}
void runControlledSpellTiming(std::uint32_t worker, std::uint32_t palace) {
    const char *spell = "Bards_March", *effect = "Bards_March_Legacy_Icon";
    require(read(worker) == 0x0068098cU, "actual original game character worker");
    require(evaluateSpellTiming("MM_CommitSpellCooldown", "Missing_Community_Spell", worker) ==
                0xffffffffU,
            "missing spell rejected");
    require(evaluateSpellTiming("MM_CommitSpellCooldown", "basic_attack", worker) == 0xfffffffcU,
            "undeclared action rejected");
    require(evaluateSpellTiming("MM_CommitSpellCooldown", spell, 0) == 0xffffffffU,
            "null spell owner rejected");
    require(evaluateSpellTiming("MM_CommitSpellCooldown", spell, palace) == 0xfffffffdU,
            "building spell owner unsupported");
    require(evaluateSpellTiming("MM_CommitSpellCooldown", spell, worker) == 0,
            "unlearned authored spell left unchanged");
    evaluateSpellTiming("LearnSpell", spell, worker, 0x004229f0U);
    const auto head = read(worker + 0x154), node = read(head);
    require(node && read(node + 4) == 0x31414d42U && read(worker + 0x15c) == 1,
            "original LearnSpell created authored singly linked spell node");
    std::uint8_t available = 0, afterAvailable = 0;
    require(host->guest_read_u8(host, node + 0x10, &available) == POP_OK,
            "original learned spell availability");
    const auto now = read(0x0071c6a8U);
    require(evaluateSpellTiming("MM_CommitSpellCooldown", spell, worker) == 1 &&
                read(node + 0x0c) == 6000 && read(node + 8) == now,
            "authored spell cooldown committed without casting");
    require(host->guest_read_u8(host, node + 0x10, &afterAvailable) == POP_OK &&
                available == afterAvailable,
            "original learned availability preserved");
    require(evaluateSpellTiming("MM_EffectorRemaining", effect, worker) == 0,
            "declared absent effect has zero remaining");
    // Create the state normally supplied by March application before asking
    // the original engine to own the effect and run its authored End callback.
    // Zero modifiers keep this controlled setup from changing worker rates.
    addControlledNativeAttribute(worker, "BardsMarchMoveDelta", false);
    addControlledNativeAttribute(worker, "BardsMarchActionDelta", false);
    controlledSpellSourceValue = addControlledNativeAttribute(worker, "BardsMarchSource", true);
    controlledSpellUnit = worker;
    controlledSpellIdentity = read(worker + 0x60);
    controlledSpellStarted = read(0x0071c6a8U);
    evaluateSpellTiming("CreateEffector", effect, worker, 0x005a9640U, 8000);
    require(evaluateSpellTiming("MM_EffectorRemaining", effect, worker) == 8000,
            "original created effect reports its actual timeout order");
    controlledSpellTimingApplied = true;
    host->log(host, "Controlled community spell timing: original learned "
                    "cooldown, availability "
                    "and actual effect timeout passed.");
}
struct WorldQueryTestArgument {
    unsigned type = 1;
    std::uint32_t first = 0, second = 0;
    const char *text = nullptr;
};
std::vector<std::array<std::uint32_t, 2>>
evaluateWorldQuery(const char *symbol, std::initializer_list<WorldQueryTestArgument> arguments) {
    require(controlledWorldQueries && arguments.size() <= 5, "owned world-query test only");
    std::uint32_t memory = 0;
    require(host->guest_alloc(host, 512, &memory) == POP_OK, "world-query evaluator storage");
    const auto text = [&](std::uint32_t at, const char *input) {
        require(input && std::strlen(input) < 128, "world-query test text bound");
        for (unsigned i = 0; i <= std::strlen(input); ++i)
            require(host->guest_write_u8(host, at + i, input[i]) == POP_OK,
                    "world-query test text");
    };
    text(memory + 128, symbol);
    call(0x004e3520U, memory, {memory + 128});
    const auto evaluator = memory + 32;
    call(0x00629910U, evaluator, {memory});
    call(0x004e3820U, memory);
    const auto binding = read(evaluator + 4);
    require(binding && worldQueryFunctions.count(binding) && read(binding + 20) == 0x005a9600U,
            "actual registered native world-query binding");
    call(0x00629bf0U, evaluator);
    WorldQueryOps ops;
    for (const auto &arg : arguments) {
        if (arg.type == 1) {
            call(0x00629a40U, evaluator, {arg.first});
        } else if (arg.type == 5) {
            call(0x00629a20U, evaluator, {arg.first});
        } else {
            require(arg.type == 3 || arg.type == 7, "world-query test argument type");
            const auto runtime = read(read(0x007218b4U) + 0x10), pool = read(runtime + 0x1c);
            const auto value = call(0x0062a810U, pool, {arg.type});
            require(value && read(value + 4) == arg.type,
                    "original world-query typed value allocation");
            if (arg.type == 3) {
                text(memory + 256, arg.text);
                call(0x004e3520U, memory + 80, {memory + 256});
                call(0x004e4180U, valueRef(value, 0x30), {memory + 80});
                call(0x004e3820U, memory + 80);
            } else {
                const auto coordinate = ops.point(value);
                require(ops.valid(coordinate, 8), "original coordinate getter ABI");
                write(coordinate, arg.first);
                write(coordinate + 4, arg.second);
            }
            call(0x00636bf0U, evaluator + 8, {value});
        }
    }
    call(0x00629c40U, evaluator);
    const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
    require(begin && end - begin == (arguments.size() + 1) * 4, "native world-query argument span");
    std::vector<std::array<std::uint32_t, 2>> result;
    for (unsigned i = 0; i <= arguments.size(); ++i) {
        const auto value = read(read(begin + i * 4)), kind = read(value + 4);
        if (kind == 1)
            result.push_back({read(ops.integer(value)), 0});
        else if (kind == 7) {
            const auto point = ops.point(value);
            result.push_back({read(point), read(point + 4)});
        } else
            result.push_back({0, 0});
    }
    require(call(0x00629c10U, evaluator) == result[0][0], "native world-query result accessor");
    call(0x006299b0U, evaluator);
    require(host->guest_free(host, memory) == POP_OK, "world-query evaluator release");
    std::fprintf(stderr, "[community-world-query] symbol=%s result=%d\n", symbol,
                 MajestyCommunity::NativeSignedInteger(result[0][0]));
    return result;
}
void runControlledWorldQueries(std::uint32_t worker) {
    WorldQueryOps ops;
    const auto result = [&](const char *name, std::initializer_list<WorldQueryTestArgument> args) {
        return evaluateWorldQuery(name, args)[0][0];
    };
    const auto descriptor = read(worker + 0x44), engine = read(descriptor + 0x14);
    const auto distance = read(engine + 0x10), interval = call(0x00430770U, worker);
    const auto nominal = result("MM_UnitMovementRate", {{5, worker}, {1, 0}});
    require(interval && nominal == (distance << 11) / interval && nominal > 0,
            "worker nominal rate equals original movement getter");
    require(result("MM_UnitMovementRate", {{5, worker}, {1, 1}}) == nominal,
            "unmodified worker effective movement equals nominal");
    // The live actor may use another movement attachment or animation form.
    // Keep its original-getter comparison above independent from the pinned
    // stock Peasant descriptor (122 in the Old engine's integer rate units).
    require(result("MM_UnitTypeMovementRate", {{3, 0, 0, "Peasant"}}) == 122,
            "loaded Peasant descriptor retains its pinned original movement rate");
    require(static_cast<int>(result("MM_UnitTypeMovementRate", {{3, 0, 0, "Healer"}})) > 0,
            "loaded Healer movement attachment is queried");
    require(result("MM_UnitTypeMovementRate", {{3, 0, 0, "Missing_Community_Type_Control"}}) ==
                UINT32_MAX,
            "missing movement type retains invalid result");
    require(result("MM_UnitMovementRate", {{5, 0}, {1, 0}}) == UINT32_MAX &&
                result("MM_UnitMovementRate", {{5, worker}, {1, 2}}) == UINT32_MAX,
            "native invalid movement inputs");
    std::uint32_t position = 0;
    require(host->guest_alloc(host, 8, &position) == POP_OK, "owned worker position storage");
    call(0x005ad740U, worker, {position});
    const auto x = read(position), y = read(position + 4), player = read(worker + 0x70);
    require(host->guest_free(host, position) == POP_OK, "owned worker position release");
    const auto map = read(read(read(0x0071c68cU) + 0x10) + 0x80);
    const auto stride = read(map + 0x38), cells = read(map + 0x4c);
    require(x / 32 < read(map + 0x30) && y / 32 < read(map + 0x34), "actual worker map position");
    const auto mask = read(cells + (y / 32 * stride + x / 32) * 24 + 4);
    require(result("MM_MapFog", {{1, player}, {7, x, y}}) == ((mask >> player) & 1U),
            "native fog query equals original explored cell mask");
    require(result("MM_MapFog", {{1, 32}, {7, x, y}}) == UINT32_MAX &&
                result("MM_MapFog", {{1, player}, {7, UINT32_MAX, y}}) == UINT32_MAX,
            "native map player and coordinate bounds");
    std::uint32_t cursor = 0;
    bool found = false;
    for (unsigned attempt = 0; attempt < 128 && !found; ++attempt) {
        const auto frontier = evaluateWorldQuery(
            "MM_MapNextFrontier", {{1, player}, {7, x, y}, {1, cursor}, {1, 256}, {7, 0, 0}});
        require(frontier[0][0] <= 2 && frontier[3][0] >= cursor && frontier[3][0] - cursor <= 256,
                "bounded native frontier cursor progress");
        cursor = frontier[3][0];
        if (frontier[0][0] == 1) {
            const auto point = frontier[5];
            require(result("MM_MapFog", {{1, player}, {7, point[0], point[1]}}) == 0,
                    "actual frontier result is an unexplored map cell");
            found = true;
        } else if (frontier[0][0] == 2)
            break;
    }
    require(found, "fresh controlled world contains a discoverable frontier");
    const auto invalid = evaluateWorldQuery(
        "MM_MapNextFrontier", {{1, player}, {7, x, y}, {1, 17}, {1, 257}, {7, 101, 202}});
    require(invalid[0][0] == UINT32_MAX && invalid[3][0] == 17 && invalid[5][0] == 101 &&
                invalid[5][1] == 202,
            "invalid native frontier leaves caller cursor/output intact");
    controlledWorldQueriesApplied = true;
    host->log(host,
              "Controlled world queries: original map masks, bounded frontier, native movement "
              "rates and invalid-input controls passed.");
}
void runControlledPrivateIntents() {
    require(controlledPrivateIntents && !privateIntentText.records().empty(),
            "owned private intent control");
    const auto runtime = call(0x00623b20U, 0), table = read(runtime + 0x28);
    require(table != 0, "original active AITX table");
    const auto stock = call(0x004f2040U, 0, {table, 0xffffffffU, 1});
    for (const auto &record : privateIntentText.records()) {
        const auto view = call(0x004f2040U, 0, {table, 0xffffffffU, record.id});
        require(view && view == privateIntentText.view(record.id) &&
                    guestString(view) == record.text,
                "actual original STRT accessor returns private view");
        std::uint32_t copy = 0;
        require(host->guest_alloc(host, 12, &copy) == POP_OK, "native intent copy storage");
        call(0x004e35f0U, copy, {view});
        require(guestString(copy) == record.text && read(copy) != read(view),
                "original TString copy owns separate exact text");
        call(0x004e3820U, copy);
        require(host->guest_free(host, copy) == POP_OK, "native intent copy release");
    }
    require(call(0x004f2040U, 0, {table, 0xffffffffU, 1}) == stock,
            "original stock activity entry remains identical");
    const auto &first = privateIntentText.records().front();
    require(call(0x004f2040U, 0, {0, 0x58544941U, first.id}) == privateIntentText.view(first.id),
            "native AITX resource-ID lookup agrees with table-pointer lookup");
    const auto hits = privateIntentLookups;
    call(0x004f2040U, 0, {0, 0x4e544e55U, first.id}); // UNTN is a separate namespace.
    require(privateIntentLookups == hits, "private activity text never changes unit titles");
    controlledPrivateIntentsApplied = true;
    std::fprintf(
        stderr, "[community-private-intents] records=%zu native-owned-copies=1 stock-unchanged=1\n",
        privateIntentText.records().size());
    host->log(host, "Controlled private intents: original AITX pointer/ID lookup and native string "
                    "copies passed.");
}
void runControlledBaseTiming() {
    const auto manager = call(0x00415b40U, 0), player = read(manager + 0x24);
    const auto palace = call(0x00418b50U, manager, {player});
    require(palace != 0, "actual player Palace for movement control");
    const auto first = read(palace + 0x60), world = read(0x0071c68cU);
    std::uint32_t moving = 0;
    for (unsigned offset = 1; offset <= 1024 && !moving; ++offset) {
        const auto unit = call(0x005a10d0U, read(world + 4), {first + offset});
        if (!unit || read(unit) != 0x0068098cU || read(unit + 0x70) != read(palace + 0x70) ||
            read(read(unit) + 0x158) != 0x00430770U)
            continue;
        const auto description = read(unit + 0x44);
        if (!description || read(description + 8) != 1)
            continue;
        const auto engine = read(description + 0x14);
        if (engine && read(engine) == 0x0068b250U && read(engine + 0x0c) > 0)
            moving = unit;
    }
    // World-ready can precede the native worker-spawn tick. Wait within the
    // existing owned trial deadline; do not assume the first update has one.
    if (!moving)
        return;
    const char actionName[] = "basic_attack";
    std::uint32_t name = 0;
    require(host->guest_alloc(host, sizeof(actionName), &name) == POP_OK,
            "original action comparison name");
    for (unsigned i = 0; i < sizeof(actionName); ++i)
        require(host->guest_write_u8(host, name + i, actionName[i]) == POP_OK,
                "original action comparison text");
    const auto action = call(0x0059c060U, read(0x0071c6bcU), {name});
    require(action != 0, "actual loaded stock basic attack");
    const auto expected = call(0x005a1ae0U, 0, {action});
    require(host->guest_free(host, name) == POP_OK, "action comparison name release");
    require(evaluateBuiltinBaseTiming("MM_ActionBasePeriod", actionName, 0, false) == expected &&
                expected > 0,
            "native action period equals original getter");
    require(evaluateBuiltinBaseTiming("MM_ActionBasePeriod", "Missing_Community_Action_Control", 0,
                                      false) == 0xffffffffU,
            "missing action retains invalid result");

    const auto period = call(0x005a1a30U, moving);
    require(evaluateBuiltinBaseTiming("MM_UnitMovementBasePeriod", nullptr, moving, true) ==
                    period &&
                period > 0,
            "native movement period equals original getter");
    require(evaluateBuiltinBaseTiming("MM_UnitMovementBasePeriod", nullptr, 0, true) == 0xffffffffU,
            "null agent movement remains invalid");
    require(evaluateBuiltinBaseTiming("MM_UnitMovementBasePeriod", nullptr, palace, true) ==
                0xfffffffdU,
            "building without supported movement remains unsupported");
    if (controlledSpellTiming && !controlledSpellTimingApplied)
        runControlledSpellTiming(moving, palace);
    if (controlledResearchQuery && !controlledResearchQueryApplied)
        runControlledResearchQuery(palace);
    if (controlledWorldQueries && !controlledWorldQueriesApplied)
        runControlledWorldQueries(moving);
    if (controlledPrivateIntents && !controlledPrivateIntentsApplied)
        runControlledPrivateIntents();
    if (controlledExpansionPanels && !controlledExpansionPanelsApplied)
        runControlledExpansionPanels(palace);
    controlledBaseTimingApplied = true;
    host->log(host, "Controlled community base timing: original action/worker "
                    "getters and negative "
                    "controls passed.");
}
void addAttribute(std::uint32_t context) {
    AttributeOps ops;
    MajestyCommunity::AttributeEvidence evidence;
    const auto installed = MajestyCommunity::InstallAuthoredAttribute(ops, context, &evidence);
    if (controlledCommunityGplActive && installed == MajestyCommunity::AttributeInstall::Added &&
        evidence.type == 4) {
        require(evidence.arguments == 3 &&
                    (!controlledLedgerAgent || controlledLedgerAgent == evidence.agent),
                "controlled authored list declaration and root ownership");
        controlledLedgerAgent = evidence.agent;
        ++controlledEmptyLists;
    }
    require(installed == MajestyCommunity::AttributeInstall::Added ||
                installed == MajestyCommunity::AttributeInstall::AlreadyExists,
            "authored AddAttribute native argument/type/pool/map contract");
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
    optionalExpansion.reset();
    optionalExpansionSpells.reset();
    optionalSpellFunction = 0;
    optionalEffectorFunction = 0;
    if (communityProcess) {
        prepareName("CheckEffector");
        optionalEffectorFunction = call(0x00631b40U, read(runtime + 8), {scratch + 96});
        require(optionalEffectorFunction &&
                    call(0x00631ba0U, read(runtime + 8), {scratch + 96}) == 6,
                "original CheckEffector boolean binding");
        prepareName("IsSpellAvailable");
        optionalSpellFunction = call(0x00631b40U, read(runtime + 8), {scratch + 96});
        require(optionalSpellFunction && read(optionalSpellFunction + 20) == 0x00422740U &&
                    call(0x00631ba0U, read(runtime + 8), {scratch + 96}) == 6,
                "original IsSpellAvailable boolean binding");
    }
    if (integerHelpers) {
        integerFunctions.clear();
        using Kind = MajestyCommunity::IntegerHelper;
        for (const auto &entry : std::vector<std::pair<const char *, Kind>>{
                 {"MM_SimulationTime", Kind::SimulationTime},
                 {"MM_SimulationElapsed", Kind::SimulationElapsed},
                 {"MM_KR_CapAdd", Kind::CapAdd},
                 {"MM_KR_AwardBonus", Kind::AwardBonus}}) {
            prepareName(entry.first);
            call(0x00631c00U, read(runtime + 8), {scratch + 96, 0x005a9600U, 1, 0, 0});
            require(call(0x00631ba0U, read(runtime + 8), {scratch + 96}) == 1,
                    "community native integer return declaration");
            const auto function = call(0x00631b40U, read(runtime + 8), {scratch + 96});
            require(function && read(function + 20) == 0x005a9600U &&
                        integerFunctions.emplace(function, entry.second).second,
                    "community integer function-scoped dispatch identity");
        }
    }
    if (worldQueryHelpers) {
        worldQueryFunctions.clear();
        using Kind = MajestyCommunity::WorldQuery;
        for (const auto &entry : std::vector<std::pair<const char *, Kind>>{
                 {"MM_MapFog", Kind::Fog},
                 {"MM_MapNextFrontier", Kind::Frontier},
                 {"MM_UnitMovementRate", Kind::UnitMovement},
                 {"MM_UnitTypeMovementRate", Kind::TypeMovement}}) {
            prepareName(entry.first);
            call(0x00631c00U, read(runtime + 8), {scratch + 96, 0x005a9600U, 1, 0, 0});
            require(call(0x00631ba0U, read(runtime + 8), {scratch + 96}) == 1,
                    "native world-query integer return type");
            const auto function = call(0x00631b40U, read(runtime + 8), {scratch + 96});
            require(function && read(function + 20) == 0x005a9600U &&
                        worldQueryFunctions.emplace(function, entry.second).second,
                    "native world-query function identity");
        }
    }
    if (baseTimingHelpers) {
        baseTimingFunctions.clear();
        using Kind = MajestyCommunity::BaseTimingHelper;
        for (const auto &entry : std::vector<std::pair<const char *, Kind>>{
                 {"MM_ActionBasePeriod", Kind::Action},
                 {"MM_UnitMovementBasePeriod", Kind::Movement}}) {
            prepareName(entry.first);
            call(0x00631c00U, read(runtime + 8), {scratch + 96, 0x005a9600U, 1, 0, 0});
            require(call(0x00631ba0U, read(runtime + 8), {scratch + 96}) == 1,
                    "native base timing integer return type");
            const auto function = call(0x00631b40U, read(runtime + 8), {scratch + 96});
            require(function && read(function + 20) == 0x005a9600U &&
                        baseTimingFunctions.emplace(function, entry.second).second,
                    "native base timing function identity");
        }
    }
    if (spellTimingHelpers) {
        spellTimingFunctions.clear();
        using Kind = MajestyCommunity::SpellTimingHelper;
        for (const auto &entry :
             std::vector<std::pair<const char *, Kind>>{{"MM_EffectorRemaining", Kind::Remaining},
                                                        {"MM_CommitSpellCooldown", Kind::Commit}}) {
            prepareName(entry.first);
            call(0x00631c00U, read(runtime + 8), {scratch + 96, 0x005a9600U, 1, 0, 0});
            require(call(0x00631ba0U, read(runtime + 8), {scratch + 96}) == 1,
                    "native spell timing integer return type");
            const auto function = call(0x00631b40U, read(runtime + 8), {scratch + 96});
            require(function && read(function + 20) == 0x005a9600U &&
                        spellTimingFunctions.emplace(function, entry.second).second,
                    "native spell timing function identity");
        }
    }
    if (researchQueryHelpers) {
        researchQueryFunctions.clear();
        using Kind = MajestyCommunity::ResearchQuery;
        for (const auto &entry : std::vector<std::pair<const char *, Kind>>{
                 {"MM_KR_Order", Kind::Order}, {"MM_KR_Eligible", Kind::Eligible}}) {
            prepareName(entry.first);
            call(0x00631c00U, read(runtime + 8), {scratch + 96, 0x005a9600U, 1, 0, 0});
            require(call(0x00631ba0U, read(runtime + 8), {scratch + 96}) == 1,
                    "original research query return declaration");
            const auto function = call(0x00631b40U, read(runtime + 8), {scratch + 96});
            require(function && read(function + 20) == 0x005a9600U &&
                        researchQueryFunctions.emplace(function, entry.second).second,
                    "original research query dispatch identity");
        }
    }
}
#include "research_visual_lifecycle.h"
#include "mechanics_probe.h"
void runControlledExpansionPanels(std::uint32_t palace) {
#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    require(expansionPanels && controlledBaseTiming, "owned expansion controller trial");
    controlledExpansionPanelsApplied = true;
    const auto guild = mechanicsGpl("MM_Expansion_Probe_Spawn",
                                    {{palace}, {0, false, "AdventurerGuild1"}, {0, true}}, true);
    const auto zoo = mechanicsGpl("MM_Expansion_Probe_Spawn",
                                  {{palace}, {0, false, "Restore_Zoo1"}, {0, true}}, true);
    for (const auto actor : {guild, zoo})
        if (actor)
            std::fprintf(stderr,
                         "[community-expansion-birth] unit=%08x id=%u prototype=%08x owner=%u "
                         "factory=%08x global=%08x\n",
                         actor, read(actor + 0x60), read(actor + 0x6c), read(actor + 0x70),
                         read(actor + 0x84), read(read(0x0071c68cU) + 4));
    require(guild && zoo && (read(guild + 0x6c) & 0xffffffU) == 0x00764241U &&
                (read(zoo + 0x6c) & 0xffffffU) == 0x00774241U,
            "actual source-backed new building births");
    const auto manager = call(0x00415b40U, 0);
    const auto open = [&](std::uint32_t unit, std::uint32_t dialog) {
        call(0x00416890U, manager, {dialog, unit, 0, 0});
        const auto controller = majesty_expansion_panel_for_unit(unit, dialog);
        require(controller && call(0x00481ec0U, controller) == unit,
                "actual private native window and parent");
        return controller;
    };
    const auto command = [&](std::uint32_t controller, std::uint32_t id) {
        call(majesty_expansion_panel_bridge(14), 0, {controller, id});
    };
    const auto parent = open(guild, 0x47414743U);
    command(parent, 28929);
    auto child = majesty_expansion_panel_for_unit(guild, 0x51414743U);
    require(child && read(child + 0x28) == read(child + 0x2c),
            "quest board uses zero synthetic agents");
    command(child, 0x1f4dU);
    require(majesty_expansion_panel_for_unit(guild, 0x47414743U) != 0,
            "quest board Back returns its own guild");
    auto zooParent = open(zoo, 0x4d5a4743U);
    command(zooParent, 5001);
    child = majesty_expansion_panel_for_unit(zoo, 0x435a4743U);
    require(child != 0, "native Zoo reward child");
    command(child, 0x1f4dU);
    zooParent = majesty_expansion_panel_for_unit(zoo, 0x4d5a4743U);
    require(zooParent != 0, "reward Back returns its own Zoo");
    command(zooParent, 10800);
    child = majesty_expansion_panel_for_unit(zoo, 0x545a4743U);
    require(child != 0, "native Zoo taming child");
    command(child, 0x1f4dU);
    const auto returnedGuild = open(guild, 0x47414743U);
    command(returnedGuild, 28929);
    host->log(host, "Controlled expansion panels: actual guild/Zoo births and all five native "
                    "panels, own-building Back and data-record list passed.");
    if (controlledExpansionPlay)
        beginControlledExpansionPlay(palace, guild, zoo);
#else
    (void)palace;
    require(false, "expansion trial requires process-lived core");
#endif
}
#include "expansion_play_probe.h"
MechanicsProbe mechanicsProbe;
bool controlledMechanics = false;

void hook(const PopModApi *, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    const auto target = cpu->target, self = cpu->ecx;
    if (singlePlayerOnly && target == 0x0045fd40U) {
        // The original multiplayer service-selection path returns AP29 on
        // cancellation. Keep that return contract without attaching a service.
        require(host->hook_return(host, cpu, 0x39325041U, 0) == POP_OK,
                "original zero-argument multiplayer return discipline");
        return;
    }
    if (singlePlayerOnly && (target == 0x00487c80U || target == 0x00489130U)) {
        const auto dialog = target == 0x00487c80U ? read(cpu->esp + 4) :
            (read(self + 4) ? read(read(self + 4) + 0x2c) : 0);
        const auto hide = [&]() {
            const auto window = read(self + 4);
            if (dialog == 0x39325041U && window) {
                // AP29's original framed Multiplayer button is control5003.
                // Its native visibility API removes drawing and hit testing.
                call(read(read(self) + 0x20), self, {5003, 0});
            }
        };
        if (target == 0x00489130U)
            hide();
        next(inv, cpu);
        if (target == 0x00487c80U && dialog == 0x39325041U) {
            hide();
            host->log(host, "Single-player menu: original Multiplayer control hidden.");
            if (controlledSinglePlayer) {
                const auto window = read(self + 4);
                std::fprintf(stderr, "[single-player-menu] dialog=%08x window=%08x "
                                     "visibility-method=%08x\n", dialog, window,
                             read(read(self) + 0x20));
                require(call(0x0045fd40U, 0) == 0x39325041U,
                        "single-player entry refuses original multiplayer service attachment");
                host->log(host, "Controlled single-player menu: original multiplayer entry "
                                "returns to AP29 without a network service.");
            }
        }
        if (target == 0x00489130U && dialog == 0x39325041U && cpu->eax == 5003)
            cpu->eax = 0;
        return;
    }
    if ((controlledExpansionPlay || traceExpansionGpl) && target == 0x006293e0U) {
        const auto format = read(cpu->esp + 16);
        std::string message;
        for (unsigned i = 0; format && i < 128; ++i) {
            std::uint8_t value = 0;
            if (host->guest_read_u8(host, format + i, &value) != POP_OK || !value)
                break;
            message += value >= 32 && value < 127 ? static_cast<char>(value) : '?';
        }
        std::fprintf(stderr, "[community-expansion-gpl-error] format=%s return=%08x\n",
                     message.c_str(), read(cpu->esp));
        for (const auto &name : expansionPlayGplStack)
            std::fprintf(stderr, "[community-expansion-gpl-stack] %s\n", name.c_str());
        next(inv, cpu);
        return;
    }
    if ((controlledExpansionPlay || traceExpansionGpl) && target == 0x00624850U) {
        std::fprintf(stderr, "[community-expansion-type-error] value=%08x tag=%u return=%08x\n",
                     self, self ? read(self + 4) : ~0U, read(cpu->esp));
        for (const auto &name : expansionPlayGplStack)
            std::fprintf(stderr, "[community-expansion-gpl-stack] %s\n", name.c_str());
        next(inv, cpu);
        return;
    }
    if (privateIntents && target == 0x004f2040U) {
        const auto id = read(cpu->esp + 12);
        if (MajestyIntentText::IsPrivateIntentId(id)) {
            IntentTextOps ops;
            const auto view =
                privateIntentText.lookup(ops, read(cpu->esp + 4), read(cpu->esp + 8), id);
            if (view) {
                ++privateIntentLookups;
                require(host->hook_return(host, cpu, view, 0) == POP_OK,
                        "original private STRT lookup cdecl return");
                return;
            }
        }
        next(inv, cpu);
        return;
    }
#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    if (researchVisuals && target == 0x00416c30U) {
        // Audited Old world entry, called by415e7a after new/load setup.
        // Its tail restores collections and requests phase3 before returning.
        researchWorldReady = false;
        researchWorldVisualPending = true;
        next(inv, cpu);
        researchWorldReady = true;
        syncResearchWorldVisuals();
        return;
    }
    if (researchVisuals && (target == 0x00431130U || target == 0x005a2670U)) {
        const auto argument = read(cpu->esp + 4);
        const auto value = target == 0x00431130U ? read(cpu->esp + 8) : 0;
        const bool relevant =
            std::any_of(researchBindings.begin(), researchBindings.end(), [&](const auto &binding) {
                return !binding.record.activeEffector.empty() &&
                       (read(self + 0x6c) & 0xffffffU) == binding.nativeFamily;
            });
        const auto previousOwner = relevant ? read(self + 0x70) : 0;
        const bool stage =
            target == 0x00431130U && (argument == 0x01425041U || argument == 0x02425041U);
        const bool hadAgent = relevant && stage && argument == 0x01425041U && value != 1 &&
                              call(0x005a1c40U, self, {argument, 0}) == 1;
        next(inv, cpu);
        if (relevant && (stage || (target == 0x005a2670U && previousOwner != argument))) {
            if (controlledMechanics)
                std::fprintf(stderr,
                             "[research-visual-event] target=%08x unit=%u argument=%08x value=%u "
                             "flags=%08x first=%u current=%u agent=%u active=%u busy=%u\n",
                             target, read(self + 0x60), argument, value, read(self + 0x64),
                             call(0x005a1c40U, self, {0x01425041U, 0}),
                             call(0x005a1c40U, self, {0x02425041U, 0}),
                             call(0x005a1c40U, self, {0x4541U, 0}), researchVisualGameActive(),
                             researchVisualBusy);
            syncResearchVisual(self, hadAgent);
        }
        return;
    }
    if (spellOrigin && target == 0x005ae750U && read(cpu->esp) == 0x00422fcaU) {
        // Old CreateSpellUnit keeps the resolved original caster in EBP until
        // this exact birth callback. Record after native initialization and
        // before GPL birth. This avoids a host-thread source cache and its
        // nested-cast/RET cleanup hazards; sovereign births use another site.
        require(recordSpellOrigin(read(cpu->esp + 4), cpu->ebp),
                "original spell caster saved before authored birth callback");
        if (controlledMechanics && read(read(cpu->esp + 4) + 0x6c) == 0x31574850U) {
            mechanicsProbe.stormIdentity = read(read(cpu->esp + 4) + 0x60);
            mechanicsProbe.stormCaster = read(cpu->ebp + 0x60);
        }
        if (controlledMarch && read(cpu->ebp + 0x60) == 627) {
            ++controlledOriginCount;
            controlledOriginCaster = 627;
            std::fprintf(stderr, "[community-spell-origin] original-caster=627 spell=%u stored=1\n",
                         read(read(cpu->esp + 4) + 0x60));
        }
        next(inv, cpu);
        return;
    }
    if (movementScale && target == 0x005b7490U) {
        const auto result = call(movementEntry, self,
                                 {read(cpu->esp + 4), read(cpu->esp + 8), read(cpu->esp + 12)});
        require(host->hook_return(host, cpu, result, 12) == POP_OK,
                "original movement order RET12");
        return;
    }
    if (movementScale && target == 0x005b7360U && read(cpu->esp) == 0x005b75a4U) {
        struct MovementOps : AttributeOps {
            bool hasEffector(std::uint32_t unit, std::uint32_t overlay) {
                return call(0x005b4570U, unit, {overlay}) != 0;
            }
        } ops;
        // Only the private native template replaces MOV ECX,[EBX] here.
        // Its now-dead scalar temporary at original ESP+18 is borrowed for
        // this update. EBX follows that local through comparison, vector
        // math and the final continuation check. Never rewrite order+48,
        // the original unit argument, or any saved movement state.
        const auto base = MajestyCommunity::NativeSignedInteger(read(cpu->ebx));
        const auto step = MajestyCommunity::CurrentMovementStep(
            ops, cpu->ebp, base, read(cpu->esi + 0x34), researchQueryFeatures.movementScales);
        cpu->ecx = static_cast<std::uint32_t>(step);
        if (step != base) {
            const auto temporary = cpu->esp + 4 + MajestyCommunity::kMovementScalarTemporary;
            require(ops.valid(temporary, 4), "original movement scalar temporary");
            write(temporary, cpu->ecx);
            cpu->ebx = temporary;
            if (controlledMarchApplied && !controlledMarchScaled && read(cpu->ebp + 0x60) == 585) {
                require(step > base && read(cpu->esi + 0x48) == static_cast<std::uint32_t>(base),
                        "actual March scaled step leaves original native cache unchanged");
                controlledMarchScaled = true;
                std::fprintf(stderr,
                             "[community-march] unit=585 native-base=%d scaled=%d loan=18 "
                             "cache-unchanged=1\n",
                             base, step);
            }
        }
        require(host->hook_return(host, cpu, cpu->eax, 0) == POP_OK,
                "private movement instruction preserves EAX and flags");
        return;
    }
    if (communityProcess && target == 0x004ca4f0U) {
        const auto args = cpu->esp + 4, requested = read(args);
        if (expansionPanels && majesty_is_expansion_dialog(requested)) {
            const auto result = call(majesty_expansion_panel_bridge(0), self,
                                     {requested, read(args + 4), read(args + 8), read(args + 12)});
            require(host->hook_return(host, cpu, result, 16) == POP_OK,
                    "native expansion factory RET16");
            return;
        }
        static unsigned factoryReports = 0;
        if (std::getenv("RECOMP_COMMUNITY_TRACE_GUILD_UI") && factoryReports++ < 24)
            std::fprintf(stderr,
                         "[community-factory] requested=%08x window=%08x unit=%08x "
                         "flags=%08x\n",
                         requested, read(args + 4), read(args + 8), read(args + 12));
        if (requested == 0x48504743U) { // source-bound CGPH, modern AP07 -> Old AP10
            write(args, 0x30315041U);
            next(inv, cpu);
            write(args, requested);
            require(cpu->eax != 0, "original Phantom guild controller");
            const auto unit = call(0x00481ec0U, cpu->eax);
            require(unit && (read(unit + 0x6c) & 0xffffffU) == 0x00754241U,
                    "private Phantom window retains its actual Haunt");
            return;
        }
        if (communityRecipes.FindPrivateRecruitmentByParent(requested) ||
            communityRecipes.FindPrivateRecruitmentByChild(requested)) {
            const auto entry = majesty_guild_process_bridge(0);
            require(entry != 0, "process-lived private factory entry");
            const auto result =
                call(entry, self, {requested, read(args + 4), read(args + 8), read(args + 12)});
            require(host->hook_return(host, cpu, result, 16) == POP_OK,
                    "original private factory RET16");
            return;
        }
    }
    if (expansionPanels && target == 0x00496990U &&
        majesty_is_expansion_paid_command(read(cpu->esp + 4))) {
        const auto result = call(
            majesty_expansion_panel_bridge(7), self,
            {read(cpu->esp + 4), read(cpu->esp + 8), read(cpu->esp + 12), read(cpu->esp + 16)});
        require(host->hook_return(host, cpu, result, 0) == POP_OK,
                "native expansion paid dispatch cdecl");
        return;
    }
    if (expansionPanels && target == 0x004e3520U && read(cpu->esp) == 0x0049726dU &&
        majesty_expansion_action_symbol()) {
        write(cpu->esp + 4, majesty_expansion_action_symbol());
        next(inv, cpu);
        return;
    }
    if (expansionPanels && target == 0x0043ee80U && call(majesty_expansion_panel_bridge(11), 0)) {
        next(inv, cpu);
        if (cpu->eax)
            cpu->eax = call(majesty_expansion_panel_bridge(10), 0, {cpu->eax});
        return;
    }
    if (expansionPanels && target == 0x0043ef50U && read(cpu->esp) == 0x0043f2fbU &&
        call(majesty_expansion_panel_bridge(11), 0)) {
        const auto argument = cpu->esp + 4, original = read(argument),
                   targetUnit = read(argument + 4);
        require(original == 0x006bdbc4U, "original Fl00 Flag_Attack prototype call site");
        if (!call(majesty_expansion_panel_bridge(10), 0, {targetUnit})) {
            require(host->hook_return(host, cpu, 0, 0) == POP_OK,
                    "private capture rejected before native creation/debit");
            return;
        }
        write(argument, majesty_expansion_capture_prototype());
        next(inv, cpu);
        write(argument, original);
        return;
    }
    if (communityProcess && target == 0x004abf70U) {
        const auto unit = read(cpu->esp + 8);
        if (privateResearch(unit, unit ? call(0x005a1c40U, unit, {0x2c425041U, 0}) : 0)) {
            const auto entry = majesty_guild_process_bridge(2);
            require(entry != 0, "process-lived native research completion");
            const auto result = call(entry, self,
                                     {read(cpu->esp + 4), unit, read(cpu->esp + 12),
                                      read(cpu->esp + 16), read(cpu->esp + 20)});
            require(host->hook_return(host, cpu, result, 0) == POP_OK,
                    "original research completion cdecl");
            return;
        }
    }
#endif
    if ((controlledEquipment || communityProcess) && target == 0x004c0b60U) {
        next(inv, cpu);
        const auto result = cpu->eax;
        EquipmentOps ops;
        require(MajestyCommunity::RegisterEquipment(ops, self, equipmentFeatures.equipment) ==
                    MajestyCommunity::EquipmentRegistration::Installed,
                "original private equipment registration");
        equipmentPresenter = self;
        cpu->eax = result;
        return;
    }
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
    if ((researchBridge || sharedFunctions || communityProcess) && target == 0x00628e60U) {
#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
        if (communityProcess) {
            if (expansionPanels)
                call(majesty_expansion_panel_bridge(9), 0);
            const auto entry = majesty_guild_process_bridge(3);
            require(entry != 0, "process-lived panel reset before original world disposal");
            call(entry, 0);
        }
#endif
        sharedResolved.clear();
        optionalExpansion.reset();
        optionalExpansionSpells.reset();
        optionalSpellFunction = 0;
        optionalEffectorFunction = 0;
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
        controlledCommunityGplApplied = false;
        controlledCommunityGplActive = false;
        controlledEmptyLists = 0;
        controlledMarchApplied = controlledMarchScaled = controlledMarchExpired = false;
        controlledMarchStarted = controlledOriginCount = controlledOriginCaster = 0;
        controlledLedgerAgent = 0;
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
                host->log(host, "Private source and clicked target committed in native "
                                "spell packet.");
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
                    "created private spell must invoke its authored source-target "
                    "callback");
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
        std::fprintf(stderr,
                     "[alchemist-target] callback=%s expected=%s target=%08x "
                     "expected-target=%08x\n",
                     guestString(self).c_str(),
                     targetExecution.action->sourceTargetCallback.c_str(), read(cpu->esp + 8),
                     targetExecution.clicked);
        // The old Character description leaves this stock two-argument script
        // slot empty for the community's paired callback. Its validated MMCR
        // record supplies the name; 629910 resolves that original GPL export.
        require(read(cpu->esp + 8) == targetExecution.clicked && !targetExecution.invoked,
                "native private spell callback and exact clicked target");
        invokeSourceTarget(targetExecution);
        targetExecution.invoked = true;
        host->log(host, "Native spell invoked authored callback with Spell, Lab "
                        "and clicked enemy.");
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
    if ((researchBridge || controlledExpansionReload || controlledCommunityGpl || controlledEquipment || controlledIntegers ||
         controlledBaseTiming) &&
        target == 0x005d9680U) {
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
        if (researchWorldVisualPending)
            syncResearchWorldVisuals();
        if (controlledProfileIo && !controlledProfileIoApplied && state &&
            (read(state) == 3 || read(state) == 7) && !read(state + 4))
            runControlledProfileIo();
        if (controlledIntegers && !controlledIntegersApplied && state &&
            (read(state) == 3 || read(state) == 7) && !read(state + 4))
            runControlledIntegers();
        if (controlledBaseTiming && !controlledBaseTimingApplied && state &&
            (read(state) == 3 || read(state) == 7) && !read(state + 4))
            runControlledBaseTiming();
        if (controlledExpansionPlay && state && (read(state) == 3 || read(state) == 7) &&
            !read(state + 4))
            runControlledExpansionPlay();
        if (controlledExpansionReload && state && (read(state) == 3 || read(state) == 7) &&
            !read(state + 4))
            runControlledExpansionReload();
        if (controlledSpellTiming && controlledSpellTimingApplied &&
            !controlledSpellExpiryApplied && state && (read(state) == 3 || read(state) == 7) &&
            !read(state + 4))
            checkControlledSpellExpiry();
        if (controlledEquipment && !controlledEquipmentApplied && state &&
            (read(state) == 3 || read(state) == 7) && !read(state + 4))
            runControlledEquipment();
        if (controlledMechanics && state && (read(state) == 3 || read(state) == 7) &&
            !read(state + 4))
            mechanicsProbe.tick();
        if (controlledMarch && state && (read(state) == 3 || read(state) == 7) && !read(state + 4))
            runControlledMarch();
        if (controlledCommunityGpl && !controlledCommunityGplApplied && state &&
            (read(state) == 3 || read(state) == 7) && !read(state + 4))
            runControlledCommunityGpl();
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
            host->log(host, "Controlled existing target submitted through original "
                            "spell packet.");
        }
        if (pending && researchActivity.capture(activity, recruitment))
            host->log(host, "Original simulation update installed private research; "
                            "AP10 restored.");
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
        host->log(host, "Original Rage invocation constructed the authored private "
                        "GPL callback.");
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
                     "[alchemist-pool-trace] setter pool=%08x type=%u growth=%u "
                     "boolean=%u\n",
                     self, type, count, read(self + 0xbc));
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
            std::fprintf(stderr,
                         "[alchemist-value-trace] requested=%u actual=%u value=%08x "
                         "vtable=%08x bool-method=%08x allocator=%08x caller=%08x "
                         "instruction=%08x\n",
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
        if (communityProcess && self == optionalEffectorFunction) {
            ExpansionEffectorOps ops;
            if (optionalExpansion.absent(ops, read(cpu->esp + 4) + 0x14)) {
                returned(cpu, 0);
                return;
            }
        }
        if (communityProcess && self == optionalSpellFunction) {
            ExpansionEffectorOps ops;
            if (optionalExpansionSpells.absent(ops, read(cpu->esp + 4) + 0x14)) {
                returned(cpu, 0);
                return;
            }
        }
        const auto worldQuery = worldQueryFunctions.find(self);
        if (worldQueryHelpers && worldQuery != worldQueryFunctions.end()) {
            WorldQueryOps ops;
            require(MajestyCommunity::ExecuteWorldQuery(ops, worldQuery->second,
                                                        read(cpu->esp + 4) + 0x14),
                    "native world-query argument/reference contract");
            returned(cpu, 0);
            return;
        }
        const auto researchQuery = researchQueryFunctions.find(self);
        if (researchQueryHelpers && researchQuery != researchQueryFunctions.end()) {
            ResearchQueryOps ops;
            require(MajestyCommunity::ExecuteResearchQuery(ops, researchBindings, researchFlight,
                                                           researchQuery->second,
                                                           read(cpu->esp + 4) + 0x14),
                    "original research query argument/order accessor contract");
            returned(cpu, 0);
            return;
        }
        const auto spellTiming = spellTimingFunctions.find(self);
        if (spellTimingHelpers && spellTiming != spellTimingFunctions.end()) {
            SpellTimingOps ops;
            require(MajestyCommunity::ExecuteSpellTimingHelper(ops, spellTiming->second,
                                                               read(cpu->esp + 4) + 0x14),
                    "valid native spell timing arguments");
            returned(cpu, 0);
            return;
        }
        const auto timing = baseTimingFunctions.find(self);
        if (baseTimingHelpers && timing != baseTimingFunctions.end()) {
            BaseTimingOps ops;
            require(MajestyCommunity::ExecuteBaseTimingHelper(ops, timing->second,
                                                              read(cpu->esp + 4) + 0x14),
                    "native base timing argument/reference contract");
            returned(cpu, 0);
            return;
        }
        const auto integer = integerFunctions.find(self);
        if (integerHelpers && integer != integerFunctions.end()) {
            IntegerOps ops;
            require(MajestyCommunity::ExecuteIntegerHelper(ops, integer->second,
                                                           read(cpu->esp + 4) + 0x14),
                    "community native integer argument/reference contract");
            returned(cpu, 0);
            return;
        }
        if (attributeCompat && self == attributeFunction) {
            addAttribute(read(cpu->esp + 4) + 0x14);
            returned(cpu, 0);
            return;
        }
        if (traceExpansionGplCalls ||
            ((controlledExpansionPlay || controlledExpansionReload) && ((expansionPlay.phase >= 5 && expansionPlay.phase <= 9) ||
                                        expansionPlay.phase == 19))) {
            require(expansionPlayGplStack.size() < 128, "bounded owned GPL diagnostic stack");
            const auto name = guestString(self);
            const auto lower = [](std::string text) {
                for (auto &c : text)
                    if (c >= 'A' && c <= 'Z')
                        c = char(c + ('a' - 'A'));
                return text;
            };
            const auto normalized = lower(name);
            bool questPayout = false;
            if ((controlledExpansionPlay || controlledExpansionReload) && expansionPlay.phase == 19 &&
                (normalized == "give_gold" || normalized == "mjc_give_gold"))
                for (const auto &caller : expansionPlayGplStack)
                    questPayout |= lower(caller) == "adventurer_guild_complete_return";
            expansionPlayGplStack.push_back(name);
            next(inv, cpu);
            expansionPlayGplStack.pop_back();
            if (questPayout) {
                expansionPlay.questAwarded = true;
                host->log(host, "Observed original Adventurer_Guild_Complete_Return -> give_gold "
                                "normal return; no quest completion or payout was injected.");
            }
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
        for (const auto &r : communityProcess ? communityNames : features.nameGenerators) {
            const auto result =
                MajestyCommunity::RegisterNames(ops, self, read(context + 0x160), r);
            if (result != MajestyCommunity::Registration::Installed)
                std::fprintf(stderr,
                             "[community-names] id=%08x status=%u registry=%08x "
                             "resources=%08x\n",
                             r.generatorId, static_cast<unsigned>(result), self,
                             read(context + 0x160));
            require(result == MajestyCommunity::Registration::Installed,
                    "source-bound native name registration");
        }
        host->log(host, communityProcess
                            ? "All five community name generators installed; stock NM11 "
                              "preserved."
                            : "Alchemist NM18 installed through original generator lifecycle.");
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
                host->log(host, "Private Laboratory upgrade rejected by authored "
                                "research prerequisite.");
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
    const auto *solo = std::getenv("RECOMP_SINGLE_PLAYER_ONLY");
    singlePlayerOnly = solo && !std::strcmp(solo, "1");
    const auto *soloTest = std::getenv("RECOMP_COMMUNITY_TEST_SINGLE_PLAYER");
    controlledSinglePlayer = soloTest && !std::strcmp(soloTest, "20261028");
    require(!controlledSinglePlayer || singlePlayerOnly,
            "single-player menu test requires single-player mode");
    if (singlePlayerOnly) {
        for (const auto address : {0x00487c80U, 0x00489130U, 0x0045fd40U}) {
            std::uint32_t id = 0;
            const auto status = host->hook_install_ex(host, address, 0, hook, POP_HOOK_WRAP,
                                                       POP_HOOK_NO_GAME_VIEW, nullptr, &id);
            if (status != POP_OK)
                return status;
            hooks.push_back(id);
        }
    }
    const char *trace = std::getenv("RECOMP_ALCHEMIST_RECRUIT_TRACE");
    traceRecruitment = trace && !std::strcmp(trace, "1");
    const char *combat = std::getenv("RECOMP_ALCHEMIST_COMBAT_TRACE");
    traceCombat = combat && !std::strcmp(combat, "1");
    const char *attributes = std::getenv("RECOMP_ALCHEMIST_ATTRIBUTE_COMPAT");
    attributeCompat = attributes && !std::strcmp(attributes, "1");
    const char *profileIo = std::getenv("RECOMP_COMMUNITY_TEST_PROFILE_IO");
    controlledProfileIo = profileIo && !std::strcmp(profileIo, "2265");
    const char *integers = std::getenv("RECOMP_COMMUNITY_INTEGER_HELPERS");
    integerHelpers = integers && !std::strcmp(integers, "1");
    require(!integerHelpers || attributeCompat,
            "integer helpers require original registration bridge");
    const char *integerTest = std::getenv("RECOMP_COMMUNITY_TEST_INTEGER_GPL");
    controlledIntegers = integerHelpers && integerTest && !std::strcmp(integerTest, "1938");
    const char *timing = std::getenv("RECOMP_COMMUNITY_BASE_TIMING_HELPERS");
    baseTimingHelpers = timing && !std::strcmp(timing, "1");
    require(!baseTimingHelpers || integerHelpers,
            "base timing helpers require checked integer bridge");
    const char *worldQueries = std::getenv("RECOMP_COMMUNITY_WORLD_QUERY_HELPERS");
    worldQueryHelpers = worldQueries && !std::strcmp(worldQueries, "1");
    require(!worldQueryHelpers || integerHelpers,
            "world queries require checked native registration and integer bridge");
    const char *spellTiming = std::getenv("RECOMP_COMMUNITY_SPELL_TIMING_HELPERS");
    spellTimingHelpers = spellTiming && !std::strcmp(spellTiming, "1");
    require(!spellTimingHelpers || integerHelpers,
            "spell timing helpers require original attribute registration");
    const char *spellTimingTest = std::getenv("RECOMP_COMMUNITY_TEST_SPELL_TIMING_GPL");
    controlledSpellTiming =
        spellTimingHelpers && spellTimingTest && !std::strcmp(spellTimingTest, "1948");

    const char *baseTimingTest = std::getenv("RECOMP_COMMUNITY_TEST_BASE_TIMING_GPL");
    controlledBaseTiming =
        baseTimingHelpers && baseTimingTest && !std::strcmp(baseTimingTest, "1941");
    const char *worldQueryTest = std::getenv("RECOMP_COMMUNITY_TEST_WORLD_QUERIES");
    controlledWorldQueries = worldQueryTest && !std::strcmp(worldQueryTest, "20261028");
    require(!controlledWorldQueries || (worldQueryHelpers && controlledBaseTiming),
            "controlled world queries require an owned native worker timing trial");
    const char *intentFlag = std::getenv("RECOMP_COMMUNITY_PRIVATE_INTENTS");
    privateIntents = intentFlag && !std::strcmp(intentFlag, "1");
    const char *intentTest = std::getenv("RECOMP_COMMUNITY_TEST_PRIVATE_INTENTS");
    controlledPrivateIntents = intentTest && !std::strcmp(intentTest, "20261028");
    require(!controlledPrivateIntents || (privateIntents && controlledBaseTiming),
            "private intent control requires an owned worker timing trial");
    require(!controlledSpellTiming || controlledBaseTiming,
            "controlled spell timing requires the actual worker timing trial");
    const char *researchQueries = std::getenv("RECOMP_COMMUNITY_RESEARCH_QUERY_HELPERS");
    researchQueryHelpers = researchQueries && !std::strcmp(researchQueries, "1");
    require(!researchQueryHelpers || integerHelpers,
            "research queries require original native attribute registration");
    const char *researchQueryTest = std::getenv("RECOMP_COMMUNITY_TEST_RESEARCH_QUERY_GPL");
    controlledResearchQuery =
        researchQueryHelpers && researchQueryTest && !std::strcmp(researchQueryTest, "1960");
    require(!controlledResearchQuery || controlledBaseTiming,
            "controlled research queries require bounded original world setup");
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
    const char *communityTest = std::getenv("RECOMP_COMMUNITY_TEST_SCALAR_GPL");
    controlledCommunityGplReload = communityTest && !std::strcmp(communityTest, "1894-reload");
    controlledCommunityGpl = attributeCompat && communityTest &&
                             (!std::strcmp(communityTest, "1894") || controlledCommunityGplReload);
    const char *equipmentTest = std::getenv("RECOMP_COMMUNITY_TEST_EQUIPMENT");
    controlledEquipment = equipmentTest && !std::strcmp(equipmentTest, "1932");
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
        const auto raw = file("shared-overrides.tsv", 65536);
        require(MajestyCommunity::ParseSharedFunctionRoutes(std::string(raw.begin(), raw.end()),
                                                            sharedAliases),
                "shared function route format/identity/bound");
    }
    const auto n = file("features.bin", 1024 * 1024),
               c = file("controllers.bin", MajestyStockControllers::kMaximumRegistryBytes);
    std::string error;
    if (privateIntents) {
        const auto raw = file("MMMIntentText.bin", MajestyIntentText::kMaximumRegistryBytes);
        IntentTextOps ops;
        require(privateIntentText.initialize(ops, raw.data(), raw.size(), error),
                "source-bound MMTX and original borrowed string views");
        std::uint32_t id = 0;
        const auto status = host->hook_install_ex(host, 0x004f2040U, 0, hook, POP_HOOK_WRAP,
                                                  POP_HOOK_NO_GAME_VIEW, nullptr, &id);
        if (status != POP_OK)
            return status;
        hooks.push_back(id);
    }
    require(n.size() >= 8 && n[4] == 1 && !n[5] && !n[6] && !n[7], "MMFR version");
    require(c.size() >= 8 && c[4] == 20 && !c[5] && !c[6] && !c[7], "MMCR version");
    require(MajestyRuntimeFeatures::ParseRegistry(n.data(), n.size(), &features, &error),
            "original MMFR parser");
    require(MajestyStockControllers::ParseRegistry(c.data(), c.size(), &recipes, &error),
            "original MMCR parser");
    if (researchQueryHelpers) {
        const auto raw = file("research-features.bin", 1024 * 1024);
        const auto bindings = file("research-bindings.bin", 8 + 64 * 24);
        require(MajestyRuntimeFeatures::ParseRegistry(raw.data(), raw.size(),
                                                      &researchQueryFeatures, &error) &&
                    MajestyCommunity::ParseResearchBindings(
                        bindings.data(), bindings.size(), researchQueryFeatures, researchBindings),
                "source-bound original research family relocation");
    }
    if (spellTimingHelpers) {
        const auto raw = file("timing-features.bin", 1024 * 1024);
        require(MajestyRuntimeFeatures::ParseRegistry(raw.data(), raw.size(), &timingFeatures,
                                                      &error) &&
                    timingFeatures.nativeTiming,
                "private source-bound native timing declaration");
    }
    if (controlledEquipment) {
        const auto raw = file("equipment-features.bin", 1024 * 1024);
        require(MajestyRuntimeFeatures::ParseRegistry(raw.data(), raw.size(), &equipmentFeatures,
                                                      &error) &&
                    equipmentFeatures.equipment.size() == 3,
                "controlled actual three-instrument feature registry");
        std::uint32_t id = 0;
        const auto status = host->hook_install_ex(host, 0x004c0b60U, 0, hook, POP_HOOK_WRAP,
                                                  POP_HOOK_NO_GAME_VIEW, nullptr, &id);
        if (status != POP_OK)
            return status;
        hooks.push_back(id);
    }
    const char *processGuilds = std::getenv("RECOMP_COMMUNITY_PROCESS_GUILDS");
    communityProcess = processGuilds && !std::strcmp(processGuilds, "1");
    const char *mechanics = std::getenv("RECOMP_COMMUNITY_TEST_MECHANICS");
    controlledMechanics =
        mechanics && (!std::strcmp(mechanics, "2295") || !std::strcmp(mechanics, "2314") ||
                      !std::strcmp(mechanics, "2347"));
    mechanicsProbe.variant = mechanics && !std::strcmp(mechanics, "2347")   ? 3
                             : mechanics && !std::strcmp(mechanics, "2314") ? 2
                                                                            : 1;
    require(!controlledMechanics || (communityProcess && attributeCompat && spellTimingHelpers),
            "controlled mechanics require the original complete private community core");
    if (communityProcess) {
#if !defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
        require(false, "private guilds require a process-lifetime builtin, not an "
                       "unloadable plugin");
#else
        require(researchQueryHelpers && spellTimingHelpers && majesty_private_templates_ready(),
                "complete source-backed core prerequisites");
        const auto names = file("community-name-bindings.bin", 36);
        require(MajestyCommunity::CommunityNameRecords(researchQueryFeatures, names.data(),
                                                       names.size(), communityNames),
                "source-bound community names and private Phantom alias");
        if (!controlledEquipment) {
            equipmentFeatures = researchQueryFeatures;
            require(equipmentFeatures.equipment.size() == 3,
                    "source-bound instruments for ordinary guild play");
            std::uint32_t id = 0;
            const auto status = host->hook_install_ex(host, 0x004c0b60U, 0, hook, POP_HOOK_WRAP,
                                                      POP_HOOK_NO_GAME_VIEW, nullptr, &id);
            if (status != POP_OK)
                return status;
            hooks.push_back(id);
        }
        const auto raw =
            file("community-controllers.bin", MajestyStockControllers::kMaximumRegistryBytes);
        require(raw.size() >= 8 && raw[4] == 21 && !raw[5] && !raw[6] && !raw[7] &&
                    MajestyStockControllers::ParseRegistry(raw.data(), raw.size(),
                                                           &communityRecipes, &error) &&
                    communityRecipes.privateRecruitments.size() == 1 &&
                    researchBindings.size() == 1,
                "source-bound acquired private recruitment registry");
        const auto *services =
            majesty_configure_guild_gameplay(&communityRecipes, &researchBindings, &researchFlight);
        const MajestyCommunity::RecruitmentPanelBinding binding{
            communityRecipes.privateRecruitments.front().parentDialogId,
            researchBindings.front().nativeFamily};
        require(services &&
                    majesty_configure_recruitment_panels(&communityRecipes, &binding, 1, services),
                "four real private guild services and original AP52 owner");
        const auto *expansionFlag = std::getenv("RECOMP_COMMUNITY_EXPANSION_PANELS");
        expansionPanels = expansionFlag && !std::strcmp(expansionFlag, "1");
        const auto *expansionTest = std::getenv("RECOMP_COMMUNITY_TEST_EXPANSION_PANELS");
        controlledExpansionPanels = expansionTest && !std::strcmp(expansionTest, "20261028");
        const auto *playTest = std::getenv("RECOMP_COMMUNITY_TEST_EXPANSION_PLAY");
        controlledExpansionPlay = playTest && !std::strcmp(playTest, "20261028");
        const auto *reloadTest = std::getenv("RECOMP_COMMUNITY_TEST_EXPANSION_RELOAD");
        controlledExpansionReload = reloadTest && !std::strcmp(reloadTest, "20261028");
        const auto *questRefresh = std::getenv("RECOMP_COMMUNITY_TEST_EXPANSION_QUEST_REFRESH");
        controlledExpansionQuestRefresh = questRefresh && !std::strcmp(questRefresh, "20261028");
        require(!controlledExpansionQuestRefresh || controlledExpansionReload,
                "paid quest refresh requires the isolated saved-world trial");
        require(!controlledExpansionReload || !controlledExpansionPlay,
                "read-only reload trial cannot spawn a second test city");
        const auto *gplTrace = std::getenv("RECOMP_COMMUNITY_EXPANSION_GPL_TRACE");
        traceExpansionGplCalls = gplTrace && !std::strcmp(gplTrace, "20261028");
        traceExpansionGpl = traceExpansionGplCalls || (gplTrace && !std::strcmp(gplTrace, "errors"));
        require(!traceExpansionGpl || expansionPanels, "owned GPL trace requires expansion runtime");
        require(!controlledExpansionPlay || controlledExpansionPanels,
                "owned play trial requires panel controls");
        if (controlledExpansionPlay || controlledExpansionReload || traceExpansionGpl) {
            for (const auto address : {0x00624850U, 0x006293e0U}) {
                std::uint32_t id = 0;
                const auto status = host->hook_install_ex(host, address, 0, hook, POP_HOOK_WRAP,
                                                          POP_HOOK_NO_GAME_VIEW, nullptr, &id);
                if (status != POP_OK)
                    return status;
                hooks.push_back(id);
            }
        }
        require(!controlledExpansionPanels || (expansionPanels && controlledBaseTiming),
                "owned expansion test requires real controllers and native base trial");
        if (expansionPanels) {
            require(privateIntents &&
                        majesty_configure_expansion_panels(&communityRecipes, &privateIntentText),
                    "source-bound native expansion controllers and private texts");
            for (const auto address : {0x00496990U, 0x004e3520U, 0x0043ee80U, 0x0043ef50U}) {
                std::uint32_t id = 0;
                const auto status = host->hook_install_ex(host, address, 0, hook, POP_HOOK_WRAP,
                                                          POP_HOOK_NO_GAME_VIEW, nullptr, &id);
                if (status != POP_OK)
                    return status;
                hooks.push_back(id);
            }
        }
        const char *movementFlag = std::getenv("RECOMP_COMMUNITY_MOVEMENT_SCALE");
        movementScale = movementFlag && !std::strcmp(movementFlag, "1");
        if (movementScale) {
            movementEntry = majesty_community_movement_bridge();
            require(movementEntry && !researchQueryFeatures.movementScales.empty(),
                    "source-bound private movement template and overlay declarations");
            for (const auto target : {0x005b7490U, 0x005b7360U}) {
                std::uint32_t id = 0;
                const auto status = host->hook_install_ex(host, target, 0, hook, POP_HOOK_WRAP,
                                                          POP_HOOK_NO_GAME_VIEW, nullptr, &id);
                if (status != POP_OK)
                    return status;
                hooks.push_back(id);
            }
        }
        const char *originFlag = std::getenv("RECOMP_COMMUNITY_SPELL_ORIGIN");
        spellOrigin = originFlag && !std::strcmp(originFlag, "1");
        const char *marchTest = std::getenv("RECOMP_COMMUNITY_TEST_MARCH");
        controlledMarch = marchTest && !std::strcmp(marchTest, "2216");
        require(!controlledMarch || (movementScale && spellOrigin && researchBridge),
                "controlled March requires both real native adapters");
        if (spellOrigin && !targetBridge) {
            std::uint32_t id = 0;
            const auto status = host->hook_install_ex(host, 0x005ae750U, 0, hook, POP_HOOK_WRAP,
                                                      POP_HOOK_NO_GAME_VIEW, nullptr, &id);
            if (status != POP_OK)
                return status;
            hooks.push_back(id);
        }
        const char *heroUi = std::getenv("RECOMP_COMMUNITY_HERO_UI");
        if (heroUi && !std::strcmp(heroUi, "1")) {
            const auto aliases = file("hero-info-bindings.bin", 12 + 64 * 8);
            const char *compat = std::getenv("RECOMP_COMMUNITY_PHANTOM_UI");
            const bool useCompatibility = compat && !std::strcmp(compat, "1");
            if (useCompatibility) {
                const auto raw = file("hero-info-compat.bin", 16384);
                require(MajestyRuntimeFeatures::ParseRegistry(raw.data(), raw.size(),
                                                              &heroUiCompatibility, &error),
                        "source-bound Phantom presentation rows");
            }
            require(majesty_configure_hero_ui(host, &researchQueryFeatures, aliases.data(),
                                              aliases.size(),
                                              useCompatibility ? &heroUiCompatibility : nullptr),
                    "source-bound original hero information presenters");
        }
        require(read(0x00682f58U) == 0x004ac2f0U, "original Old research execution dispatch slot");
        // Original4ac2f0 is a data-discovered block in this qualified image,
        // not a hookable entry. The creator wraps the original research vtable
        // slot instead. Store a process-lived guest bridge, never a host pointer.
        require(majesty_guild_process_bridge(1) != 0, "process-lived original research dispatcher");
        researchVisuals =
            std::any_of(researchBindings.begin(), researchBindings.end(),
                        [](const auto &binding) { return !binding.record.activeEffector.empty(); });
        if (researchVisuals) {
            require(read(0x00415e7bU) + 0x00415e7fU == 0x00416c30U &&
                        read(0x0041706aU) == 0xcb8b036aU &&
                        read(0x0067f96cU + 0x124) == 0x00431130U &&
                        read(0x0067f96cU + 0x20) == 0x005a2670U,
                    "pinned Old world-ready, building stage and ownership lifecycle");
            for (const auto address : {0x00416c30U, 0x00431130U, 0x005a2670U}) {
                std::uint32_t id = 0;
                const auto status = host->hook_install_ex(host, address, 0, hook, POP_HOOK_WRAP,
                                                          POP_HOOK_NO_GAME_VIEW, nullptr, &id);
                if (status != POP_OK)
                    return status;
                hooks.push_back(id);
            }
        }
        // Commit the slot only after all requested hooks install successfully.
#endif
    }
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
    host->log(host, "Private Alchemist names/factory/setup probe loaded; original AP69 "
                    "method "
                    "eligibility is unchanged. Private dispatch is explicitly opt-in.");
    if (panelBridge) {
        for (const auto address :
             {0x00466110U, 0x004652a0U, 0x0043dfc0U, 0x0043e250U, 0x0043ee80U, 0x005b6670U,
              0x00418660U, 0x0043ddb0U, 0x0043de30U, 0x0043ded0U, 0x0042ee50U}) {
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
        host->log(host, "Private research route enabled through original "
                        "queue/update/event2009.");
    }
    if ((controlledExpansionReload || controlledCommunityGpl || controlledEquipment || controlledIntegers ||
         controlledBaseTiming) &&
        !researchBridge) {
        std::uint32_t id = 0;
        const auto status = host->hook_install_ex(host, 0x005d9680U, 0, hook, POP_HOOK_WRAP,
                                                  POP_HOOK_NO_GAME_VIEW, nullptr, &id);
        if (status != POP_OK)
            return status;
        hooks.push_back(id);
    }
    if (controlledDeath) {
        std::uint32_t id = 0;
        const auto status = host->hook_install_ex(host, 0x005a1c40U, 0, hook, POP_HOOK_WRAP,
                                                  POP_HOOK_NO_GAME_VIEW, nullptr, &id);
        if (status != POP_OK)
            return status;
        hooks.push_back(id);
    }
    if (communityProcess && !researchBridge) {
        require(read(0x006c2028U) == 0x2009U && read(0x006c202cU) == 0x004abf70U,
                "original community research completion dispatch");
        std::uint32_t id = 0;
        const auto status = host->hook_install_ex(host, 0x004abf70U, 0, hook, POP_HOOK_WRAP,
                                                  POP_HOOK_NO_GAME_VIEW, nullptr, &id);
        if (status != POP_OK)
            return status;
        hooks.push_back(id);
    }
    if ((sharedFunctions || communityProcess) && !researchBridge) {
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
#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    if (communityProcess) {
        require(read(0x00682f58U) == 0x004ac2f0U, "original research slot before activation");
        communityResearchEntry = majesty_guild_process_bridge(1);
        write(0x00682f58U, communityResearchEntry);
        host->log(host, "Process-lived community guild services, original AP52 templates and "
                        "research dispatcher installed; paid guild play is not yet qualified.");
    }
#endif
    return POP_OK;
}
extern "C" POP_MOD_EXPORT PopModStatus pop_mod_exit() {
#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    majesty_shutdown_hero_ui();
#endif
    if (communityResearchEntry) {
        require(read(0x00682f58U) == communityResearchEntry,
                "process research dispatcher still owns its original slot");
        write(0x00682f58U, 0x004ac2f0U);
        communityResearchEntry = 0;
    }
    DispatchOps ops;
    privateDispatch.clear(ops);
    for (const auto id : hooks)
        host->hook_remove(host, id);
    hooks.clear();
    IntentTextOps intentOps;
    privateIntentText.clear(intentOps);
    privateIntents = controlledPrivateIntents = controlledPrivateIntentsApplied = false;
    privateIntentLookups = 0;
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
    controlledCommunityGplActive = false;
    controlledCommunityGplApplied = false;
    controlledLedgerAgent = 0;
    controlledEmptyLists = 0;
    controlledEquipmentApplied = false;
    equipmentPresenter = 0;
    equipmentFeatures = {};
    integerFunctions.clear();
    controlledIntegersApplied = false;
    baseTimingFunctions.clear();
    controlledBaseTimingApplied = false;
    spellTimingFunctions.clear();
    timingFeatures = {};
    worldQueryFunctions.clear();
    controlledWorldQueriesApplied = false;
    controlledSpellTimingApplied = false;
    controlledSpellExpiryApplied = false;
    controlledSpellUnit = controlledSpellIdentity = controlledSpellStarted = 0;
    controlledSpellSourceValue = 0;
    researchQueryFunctions.clear();
    researchBindings.clear();
    researchQueryFeatures = {};
    heroUiCompatibility = {};
    controlledMechanics = false;
    researchVisuals = researchWorldReady = researchVisualBusy = researchWorldVisualPending = false;
    mechanicsProbe = {};
    communityNames.clear();
    movementScale = false;
    controlledProfileIo = controlledProfileIoApplied = false;
    movementEntry = 0;
    spellOrigin = false;
    controlledMarch = controlledMarchApplied = controlledMarchScaled = controlledMarchExpired =
        false;
    controlledMarchStarted = controlledOriginCount = controlledOriginCaster = 0;
    researchFlight = {};
    controlledResearchQueryApplied = false;
    return POP_OK;
}
