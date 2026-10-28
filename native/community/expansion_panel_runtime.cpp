#include "expansion_panel_runtime.h"
#include "runtime/memory.h"
#include <cstdio>
#include <cstdlib>
#include <initializer_list>
#include <set>

extern "C" void fn_004ca4f0(X86 *);
extern "C" void fn_00496990(X86 *);

namespace {
using namespace MajestyCommunity;
const MajestyStockControllers::Registry *registry = nullptr;
const PrivateIntentText *texts = nullptr;
ExpansionPanelOwner *owner = nullptr;
constexpr unsigned originalFactoryIndex = expansionPanelEntryCount + 1;
constexpr unsigned paidDispatchIndex = originalFactoryIndex + 1;
constexpr unsigned originalDispatchIndex = paidDispatchIndex + 1;
constexpr unsigned resetIndex = originalDispatchIndex + 1;
constexpr unsigned captureFilterIndex = resetIndex + 1;
constexpr unsigned captureActiveIndex = captureFilterIndex + 1;
constexpr unsigned captureValidatorIndex = captureActiveIndex + 1;
constexpr unsigned questPopulateIndex = captureValidatorIndex + 1;
constexpr unsigned bridgeCount = questPopulateIndex + 1;
std::array<std::uint32_t, bridgeCount> addresses{};
std::array<std::uint8_t, bridgeCount> hooked{};
std::uint32_t executingSymbol = 0;
std::map<std::uint32_t, std::uint32_t> actionSymbols;
struct ToggleCommand {
    const MajestyStockControllers::BuildingOpenToggleRecord *record;
    std::uint32_t value;
};
std::map<std::uint32_t, ToggleCommand> toggleCommands;
const MajestyStockControllers::HostileMonsterFlagRecord *capture = nullptr;
std::uint32_t capturePrototype = 0, captureZoo = 0, captureZooId = 0, captureWorld = 0;
std::uint32_t captureAmount = ~0U;
struct Presentation {
    std::uint64_t generation = 0;
    std::uint32_t revision = ~0U;
};
std::map<std::uint32_t, Presentation> presentations;
[[noreturn]] void fail(const char *why) {
    std::fprintf(stderr, "[community-expansion-panel] refused: %s\n", why);
    std::abort();
}
void require(bool value, const char *why) {
    if (!value)
        fail(why);
}
std::uint32_t read(std::uint32_t address) {
    require(address && gm_valid(address, 4), "guest read");
    return rd32(address);
}
void returned(X86 *cpu, unsigned count, std::uint32_t value = 0) {
    cpu->eip = read(cpu->r[R_ESP]);
    cpu->r[R_ESP] += 4 + count * 4;
    cpu->r[R_EAX] = value;
    recomp_return(cpu);
}
struct Ops {
    X86 *source;
    std::uint32_t scratch;
    explicit Ops(X86 *cpu) : source(cpu), scratch(cpu->r[R_ESP] - 768) {
        require(cpu->r[R_ESP] > 2048 && gm_valid(scratch, 768), "service stack");
    }
    bool valid(std::uint32_t address, std::uint32_t size) {
        return address && gm_valid(address, size);
    }
    std::uint32_t read(std::uint32_t address) {
        return ::read(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        require(valid(address, 4), "guest write");
        wr32(address, value);
    }
    std::uint32_t allocate(std::uint32_t size) {
        return heap_alloc(size, true);
    }
    void release(std::uint32_t address) {
        require(heap_free(address), "private table release");
    }
    std::uint32_t call(std::uint32_t target, std::uint32_t self,
                       std::initializer_list<std::uint32_t> args = {}) {
        X86 extra = *source;
        extra.r[R_ESP] -= 1024;
        extra.r[R_ECX] = self;
        return guest_call(&extra, target, args.begin(), static_cast<int>(args.size()));
    }
    std::uint32_t unit(std::uint32_t controller) {
        return call(0x00481ec0U, controller);
    }
    std::uint32_t method(std::uint32_t object, unsigned offset,
                         std::initializer_list<std::uint32_t> args = {}) {
        return call(read(read(object) + offset), object, args);
    }
    std::uint32_t message(const ExpansionPanelSession &s, std::uint32_t control, std::uint32_t code,
                          std::uint32_t a = 0, std::uint32_t b = 0) {
        return method(s.window, 0x68, {control, code, a, b});
    }
    void visible(const ExpansionPanelSession &s, std::uint32_t control, bool value) {
        method(s.window, 0x20, {control, value ? 1U : 0U});
    }
    bool captureActive() {
        const auto modeOwner = read(0x006d84b8U);
        if (!capture || !valid(modeOwner, 16))
            return false;
        const auto manager = call(0x00437de0U, modeOwner);
        return valid(manager, 20) && read(manager + 16) == capture->privateMode;
    }
    bool captureAvailable() {
        const auto root = read(0x0071c68cU);
        if (!capture || !captureZoo || !valid(root, 8) || read(root + 4) != captureWorld ||
            call(0x005a10d0U, captureWorld, {captureZooId}) != captureZoo ||
            !valid(captureZoo, 0x84) || read(captureZoo + 0x60) != captureZooId ||
            (read(captureZoo + 0x6c) & 0xffffffU) != (NativeFourCC("ABw1") & 0xffffffU))
            return false;
        return !capture->hasAvailabilityGate ||
               call(0x005a1c40U, captureZoo, {capture->availabilityAttributeId, 0}) != 0;
    }
    bool captureTarget(std::uint32_t actor) {
        // The original classifier retains Monster identity for Hooligans;
        // native ownership independently excludes friendly/controlled units.
        return captureAvailable() && valid(actor, 0xa0) && call(0x004c8fc0U, 0, {actor}) == 4 &&
               read(actor + 0x70) == 7 &&
               !call(0x00599110U, actor + 0x94, {capture->privateFlagId, 1});
    }
    void ensureCaptureMode() {
        const auto modes = call(0x005cd600U, 0);
        auto mode = method(modes, 0x60, {capture->privateMode});
        if (!mode) {
            mode = call(0x0064c616U, 0, {32});
            require(mode != 0, "native reward-mode allocation");
            call(0x005cdd20U, mode,
                 {capture->privateMode, capture->cursorOrdinal, 2, 1,
                  addresses[captureValidatorIndex], 0x0043f140U, 0, 0});
            method(modes, 0x64, {mode});
        }
        require(valid(mode, 32) && read(mode) == capture->privateMode &&
                    read(mode + 4) == capture->cursorOrdinal && read(mode + 8) == 2 &&
                    (read(mode + 12) & 255U) == 1 &&
                    read(mode + 16) == addresses[captureValidatorIndex] &&
                    read(mode + 20) == 0x0043f140U && read(mode + 24) == 0 &&
                    read(mode + 28) == 0 && method(modes, 0x60, {capture->privateMode}) == mode,
                "original private reward-mode registry");
    }
    void armCapture(const ExpansionPanelSession &s) {
        captureZoo = s.unit;
        captureZooId = s.identity;
        captureWorld = read(read(0x0071c68cU) + 4);
        if (!captureAvailable())
            return;
        ensureCaptureMode();
        call(0x004380c0U, read(0x006d84b8U), {capture->privateMode, captureAmount});
        require(captureActive(), "native private reward cursor selected");
    }
    std::uint32_t original(const ExpansionPanelSession &s, unsigned slot,
                           std::initializer_list<std::uint32_t> args = {}) {
        if (s.plan.kind != ExpansionPanelKind::Rewards)
            return call(s.plan.profile->methods[slot], s.controller, args);
        // AP41 retains its number formatting, limits and affordability. Its
        // temporary quote never replaces the ordinary Attack Flag's value.
        const auto oldAmount = read(0x006d81f4U);
        write(0x006d81f4U, captureAmount);
        const auto result = call(s.plan.profile->methods[slot], s.controller, args);
        captureAmount = read(0x006d81f4U);
        write(0x006d81f4U, oldAmount);
        return result;
    }
    void string(std::uint32_t value, const std::string &text) {
        require(text.size() < 512, "bounded native string");
        for (unsigned i = 0; i <= text.size(); ++i)
            wr8(scratch + 192 + i, text.c_str()[i]);
        call(0x004e3520U, value, {scratch + 192});
    }
    std::uint32_t scalar(const std::string &symbol, std::uint32_t actor, bool argument = false,
                         std::uint32_t value = 0) {
        require(actor && !symbol.empty() && symbol.size() < 128, "GPL query signature");
        string(scratch, symbol);
        const auto evaluator = scratch + 32;
        call(0x00629910U, evaluator, {scratch});
        call(0x004e3820U, scratch);
        const auto function = read(evaluator + 4);
        require(function && read(function + 20) == 0x0061e4c0U, "source-bound GPL query");
        call(0x00629bf0U, evaluator);
        call(0x00629a20U, evaluator, {actor});
        if (argument)
            call(0x00629a40U, evaluator, {value});
        call(0x00629c40U, evaluator);
        const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
        require(begin && end >= begin + 4 && end - begin <= 64 && read(read(read(begin)) + 4) == 1,
                "integer GPL query result");
        const auto result = call(0x00629c10U, evaluator);
        call(0x006299b0U, evaluator);
        return result;
    }
    std::uint32_t gold() {
        const auto player = call(0x00416980U, call(0x00415b40U, 0));
        return method(player, 0x20, {0x00505041U});
    }
    std::uint32_t selected(const ExpansionPanelSession &s) {
        const auto index = message(s, 5000, 0x22);
        const auto begin = read(s.controller + 0x28), end = read(s.controller + 0x2c);
        if (end < begin || (end - begin) % 4 || end - begin > 4096 || index >= (end - begin) / 4)
            return 0;
        const auto actor = read(begin + index * 4);
        return valid(actor, 0x84) && read(actor + 0x60) ? actor : 0;
    }
    void toggles(const ExpansionPanelSession &s) {
        for (const auto &r : registry->buildingOpenToggles) {
            if (r.parentDialogId != s.dialog || r.panelDialogId)
                continue;
            const auto state = r.stateAttribute.empty()
                                   ? call(0x005a1c40U, s.unit, {0x044d4541U, 0})
                                   : scalar(r.stateAccessorSymbol, s.unit, true, ~0U);
            require(state <= 1, "saved building open state");
            visible(s, r.openCommandId, !state);
            visible(s, r.closeCommandId, state);
            message(s, state ? r.closeCommandId : r.openCommandId, 10);
        }
    }
    bool toggle(const ExpansionPanelSession &s, std::uint32_t command) {
        for (const auto &r : registry->buildingOpenToggles) {
            if (r.parentDialogId != s.dialog || r.panelDialogId ||
                (command != r.openCommandId && command != r.closeCommandId))
                continue;
            const auto value = command == r.openCommandId ? 1U : 0U;
            for (const auto &queued : toggleCommands)
                if (queued.second.record == &r && queued.second.value == value) {
                    // Both peers apply the original state mutation at the
                    // simulation command boundary, rather than a local UI click.
                    call(0x004974b0U, 0, {queued.first, s.identity, s.identity, 0});
                    return true;
                }
            fail("declared queued building toggle");
        }
        return false;
    }
    std::string literal(std::uint32_t id) {
        const auto *text = texts->text(id);
        require(text && !text->empty() && text->size() <= 96, "declared quest literal");
        return *text;
    }
    void quote(const ExpansionPanelSession &s) {
        const auto *board = registry->FindLiveAgentListByChild(s.dialog);
        const auto *occupants = registry->FindOccupantPanelByChild(s.dialog);
        const auto actor = board ? s.unit : selected(s);
        visible(s, 5003, true);
        visible(s, 8006, actor != 0);
        if (!actor) {
            message(s, 5003, 10, 1);
            return;
        }
        const auto cost =
            scalar(board ? board->actionCostCallbackSymbol : occupants->costCallbackSymbol, actor);
        require(cost <= 0x7fffffffU, "bounded original paid action quote");
        message(s, 5003, 10, gold() < cost ? 1U : 0U);
        string(scratch + 112, std::to_string(cost));
        method(s.window, 0x50, {8006, scratch + 112});
        call(0x004e3820U, scratch + 112);
    }
    void emptyRecordVector(const ExpansionPanelSession &s) {
        const auto begin = read(s.controller + 0x28), end = read(s.controller + 0x2c),
                   capacity = read(s.controller + 0x30);
        require((!begin && !end && !capacity) ||
                    (begin && end >= begin && capacity >= end && (capacity - begin) % 4 == 0 &&
                     capacity - begin <= 65536 &&
                     valid(begin, capacity > begin ? capacity - begin : 4)),
                "native non-owning unit vector bounds");
        // Literal Old48f090 clear prefix: raw Unit pointers own no references.
        // Keep its allocated begin/capacity for the original native destructor.
        write(s.controller + 0x2c, begin);
    }
    void records(const ExpansionPanelSession &s) {
        const auto *board = registry->FindLiveAgentListByChild(s.dialog);
        require(board && board->dataRecordRows, "source quest record binding");
        emptyRecordVector(s);
        const auto revision = scalar(board->revisionCallbackSymbol, s.unit);
        auto &cache = presentations[s.controller];
        if (cache.generation == s.generation && cache.revision == revision)
            return;
        const auto dialog = read(s.window + 4);
        const auto list = call(0x004df260U, dialog, {5000});
        require(valid(list, 0x68), "native quest text list");
        message(s, 5000, 7); // Remove only the stock Unit-specific painter.
        const auto send = [&](std::uint32_t code, std::uint32_t a = 0, std::uint32_t b = 0) {
            return method(list, 0x9c, {code, a, b});
        };
        const auto oldCount = send(0x18), selectedIndex = send(0x22), top = read(list + 0x64);
        require(oldCount <= 64, "bounded native quest list");
        std::uint32_t selectedKey = 0, topKey = 0;
        if (selectedIndex < oldCount) {
            send(0x37, selectedIndex, scratch + 136);
            selectedKey = read(scratch + 136);
        }
        if (top < oldCount) {
            send(0x37, top, scratch + 136);
            topKey = read(scratch + 136);
        }
        const auto count = scalar(board->rowCountCallbackSymbol, s.unit);
        require(count <= 64, "bounded quest offer count");
        std::vector<std::pair<std::uint32_t, std::string>> rows;
        std::set<std::uint32_t> keys;
        for (std::uint32_t i = 1; i <= count; ++i) {
            const auto key = scalar(board->rowAgentIdCallbackSymbol, s.unit, true, i);
            require(key && key <= 0x7fffffffU && keys.insert(key).second,
                    "distinct saved quest keys");
            const auto variant = scalar(board->rowVariantCallbackSymbol, s.unit, true, i);
            require(variant && variant <= board->rowVariants.size(), "declared quest variant");
            const auto &v = board->rowVariants[variant - 1];
            const auto value = scalar(board->rowValueCallbackSymbol, s.unit, true, i);
            require(value <= 0x7fffffffU, "bounded quest reward");
            auto text = std::string("\x01"
                                    "FFFFFF") +
                        literal(v.rowTitleIntentId) +
                        "\n\x01"
                        "A550AA" +
                        literal(v.rowTextIntentId) +
                        "\n\x01"
                        "FFFF00" +
                        std::to_string(value) + literal(board->rowValueSuffixIntentId);
            require(text.size() < 512, "bounded quest row text");
            rows.emplace_back(key, std::move(text));
        }
        for (std::uint32_t i = 0; i < oldCount; ++i)
            send(0x27);
        require(!send(0x18), "stock list cleared");
        write(list + 0x50, 40);
        write(list + 0x58, 0);
        std::uint32_t newSelected = ~0U, newTop = 0;
        for (const auto &row : rows) {
            const auto index = method(s.window, 0x34, {5000, ~0U, 0});
            require(index < 64, "stock list insertion");
            string(scratch + 112, row.second);
            send(0x60, index, scratch + 112);
            call(0x004e3820U, scratch + 112);
            send(0x25, index, row.first);
            if (row.first == selectedKey)
                newSelected = index;
            if (row.first == topKey)
                newTop = index;
        }
        send(0x1b, newSelected);
        send(0x21, newTop, 1);
        method(s.window, 0x28, {5010, 5000, 1, 0});
        cache = {s.generation, revision};
    }
    void refresh(const ExpansionPanelSession &s) {
        if (!owner->alive(*this, s))
            return;
        if (s.plan.kind == ExpansionPanelKind::QuestRecords) {
            records(s);
            quote(s);
        } else if (s.plan.kind == ExpansionPanelKind::Occupants)
            quote(s);
        else
            toggles(s);
    }
    void submit(const ExpansionPanelSession &s) {
        const auto *board = registry->FindLiveAgentListByChild(s.dialog);
        const auto *occupants = registry->FindOccupantPanelByChild(s.dialog);
        const auto actor = board ? s.unit : selected(s);
        if (!actor)
            return;
        const auto cost =
            scalar(board ? board->actionCostCallbackSymbol : occupants->costCallbackSymbol, actor);
        require(cost <= 0x7fffffffU, "bounded submitted action quote");
        if (gold() < cost)
            return;
        // Native four-word queue owns validation, gold debit and simulation order.
        call(0x004974b0U, 0,
             {board ? board->actionCommandId : occupants->actionCommandId, read(s.unit + 0x60),
              read(actor + 0x60), cost});
    }
};

template <ExpansionPanelEntry Entry> void panelBody(X86 *cpu) {
    Ops ops(cpu);
    const auto s = owner->find(cpu->r[R_ECX]);
    require(s.plan.profile != nullptr, "panel ownership");
    const auto sp = cpu->r[R_ESP];
    if constexpr (Entry == ExpansionPanelEntry::Destroy) {
        const auto flags = read(sp + 4);
        presentations.erase(s.controller);
        require(owner->detach(ops, s.controller, s.generation), "retire exact panel generation");
        returned(cpu, 1, ops.call(s.plan.profile->methods[0], s.controller, {flags}));
    } else {
        require(owner->alive(ops, s), "live panel actor association");
        if constexpr (Entry == ExpansionPanelEntry::Setup) {
            ops.original(s, 1);
            ops.refresh(s);
            returned(cpu, 0);
        } else if constexpr (Entry == ExpansionPanelEntry::Control) {
            const auto command = read(sp + 4);
            if (const auto child = owner->child(s, command))
                returned(cpu, 1, ops.call(0x0047c5c0U, s.controller, {child, 0}));
            if (ops.toggle(s, command))
                returned(cpu, 1);
            if (s.plan.child() && command == 0x1f4dU) {
                if (s.plan.kind == ExpansionPanelKind::Rewards)
                    ops.call(0x004380c0U, ops.read(0x006d84b8U), {NativeFourCC("Sele"), 0});
                const auto manager = ops.call(0x00415b40U, 0);
                ops.method(s.window, 0x14);
                ops.call(0x00416890U, manager, {s.plan.parentDialog, s.unit, 0, 0});
                returned(cpu, 1, 1);
            }
            if (s.plan.kind == ExpansionPanelKind::Rewards) {
                if (command == 5002) {
                    ops.armCapture(s);
                    returned(cpu, 1);
                }
                const auto result = ops.original(s, 3, {command});
                if ((command == 10 || command == 11) && ops.captureActive())
                    ops.armCapture(s);
                returned(cpu, 1, result);
            }
            if (s.plan.kind == ExpansionPanelKind::QuestRecords ||
                s.plan.kind == ExpansionPanelKind::Occupants) {
                if (command == 5003) {
                    ops.submit(s);
                    returned(cpu, 1);
                }
                if (command == 5000) {
                    ops.quote(s);
                    returned(cpu, 1);
                }
            }
            returned(cpu, 1, ops.call(s.plan.profile->methods[3], s.controller, {command}));
        } else if constexpr (Entry == ExpansionPanelEntry::Event) {
            ops.original(s, 8, {read(sp + 4), read(sp + 8), read(sp + 12), read(sp + 16)});
            ops.refresh(s);
            returned(cpu, 4);
        } else {
            if (s.plan.kind != ExpansionPanelKind::QuestRecords)
                ops.call(s.plan.profile->methods[14], s.controller);
            ops.refresh(s);
            returned(cpu, 0);
        }
    }
}
void originalFactory(X86 *cpu) {
    fn_004ca4f0(cpu);
}
void originalDispatch(X86 *cpu) {
    fn_00496990(cpu);
}
void resetBody(X86 *cpu) {
    majesty_reset_expansion_panels(cpu);
    returned(cpu, 0);
}
void questPopulate(X86 *cpu) {
    Ops ops(cpu);
    const auto s = owner->find(cpu->r[R_ECX]);
    require(s.plan.kind == ExpansionPanelKind::QuestRecords && owner->alive(ops, s),
            "owned data-record population");
    ops.emptyRecordVector(s);
    presentations.erase(s.controller);
    returned(cpu, 0);
}
void captureFilter(X86 *cpu) {
    Ops ops(cpu);
    const auto actor = read(cpu->r[R_ESP] + 4);
    returned(cpu, 0, ops.captureTarget(actor) ? actor : 0);
}
void captureActive(X86 *cpu) {
    Ops ops(cpu);
    returned(cpu, 0, ops.captureActive() ? 1U : 0U);
}
void captureValidator(X86 *cpu) {
    Ops ops(cpu);
    const auto context = read(cpu->r[R_ESP] + 4);
    const auto stock = ops.call(0x0043efc0U, 0, {context});
    returned(cpu, 0, stock ? stock : ops.captureTarget(ops.read(context + 0x48)) ? 0U : 1U);
}
void factory(X86 *cpu) {
    Ops ops(cpu);
    const auto sp = cpu->r[R_ESP], dialog = read(sp + 4), window = read(sp + 8),
               actor = read(sp + 12);
    const std::uint32_t args[] = {owner->selector(dialog), window, actor, read(sp + 16)};
    const auto controller = guest_call(cpu, addresses[originalFactoryIndex], args, 4);
    std::array<std::uint32_t, expansionPanelEntryCount> panelEntries{};
    for (unsigned i = 0; i < expansionPanelEntryCount; ++i)
        panelEntries[i] = addresses[i + 1];
    require(owner->attach(ops, controller, dialog, window, actor, panelEntries,
                          addresses[questPopulateIndex]),
            "native controller capture");
    std::fprintf(stderr, "[community-expansion-panel] attached dialog=%08x actor=%u\n", dialog,
                 read(actor + 0x60));
    returned(cpu, 4, controller);
}
void paidDispatch(X86 *cpu) {
    Ops ops(cpu);
    const auto sp = cpu->r[R_ESP], command = read(sp + 4), parent = read(sp + 8);
    const auto queuedToggle = toggleCommands.find(command);
    if (queuedToggle != toggleCommands.end()) {
        const auto &t = queuedToggle->second;
        const auto root = read(0x0071c68cU), world = read(root + 4);
        const auto actor = ops.call(0x005a10d0U, world, {parent});
        const auto family = t.record->parentDialogId == NativeFourCC("CGAG")
                                ? NativeFourCC("ABv1") & 0xffffffU
                                : NativeFourCC("ABw1") & 0xffffffU;
        if (actor && parent == read(sp + 12) && !read(sp + 16) && ops.valid(actor, 0x84) &&
            ops.read(actor + 0x60) == parent && (ops.read(actor + 0x6c) & 0xffffffU) == family) {
            if (t.record->stateAttribute.empty())
                ops.method(actor, 0x124, {0x044d4541U, t.value});
            else
                require(ops.scalar(t.record->stateAccessorSymbol, actor, true, t.value) == t.value,
                        "queued source-backed building state");
            for (const auto &s : owner->forUnit(actor))
                ops.refresh(s);
        }
        returned(cpu, 0);
    }
    const auto symbol = actionSymbols.find(command);
    require(symbol != actionSymbols.end(), "declared queued paid command");
    const auto previous = executingSymbol;
    executingSymbol = symbol->second;
    const std::uint32_t args[] = {21, parent, read(sp + 12), read(sp + 16)};
    const auto result = guest_call(cpu, addresses[originalDispatchIndex], args, 4);
    executingSymbol = previous;
    // Native callbacks may close or replace a panel. Snapshot its exact owner.
    const auto root = read(0x0071c68cU), world = read(root + 4);
    const auto actor = ops.call(0x005a10d0U, world, {parent});
    if (actor)
        for (const auto &s : owner->forUnit(actor))
            ops.refresh(s);
    returned(cpu, 0, result);
}
void (*const bodies[bridgeCount])(X86 *) = {factory,
                                            panelBody<ExpansionPanelEntry::Destroy>,
                                            panelBody<ExpansionPanelEntry::Setup>,
                                            panelBody<ExpansionPanelEntry::Control>,
                                            panelBody<ExpansionPanelEntry::Event>,
                                            panelBody<ExpansionPanelEntry::Refresh>,
                                            originalFactory,
                                            paidDispatch,
                                            originalDispatch,
                                            resetBody,
                                            captureFilter,
                                            captureActive,
                                            captureValidator,
                                            questPopulate};
void hookedBody(X86 *cpu, std::uint32_t index) {
    require(index < bridgeCount, "bridge index");
    bodies[index](cpu);
}
RecompHookFn hooks[bridgeCount] = {hookedBody, hookedBody, hookedBody, hookedBody, hookedBody,
                                   hookedBody, hookedBody, hookedBody, hookedBody, hookedBody,
                                   hookedBody, hookedBody, hookedBody, hookedBody};
RecompModule module{"majesty_expansion_panels",
                    0,
                    0,
                    addresses.data(),
                    bridgeCount,
                    bodies,
                    hooks,
                    hooked.data(),
                    nullptr,
                    0,
                    nullptr};
} // namespace

extern "C" bool
majesty_configure_expansion_panels(const MajestyStockControllers::Registry *records,
                                   const MajestyCommunity::PrivateIntentText *intentTexts) {
    if (owner || !records || !intentTexts || intentTexts->records().empty())
        return false;
    auto *candidate = new ExpansionPanelOwner(*records);
    for (const auto dialog : {NativeFourCC("CGAG"), NativeFourCC("CGZM"), NativeFourCC("CGAQ"),
                              NativeFourCC("CGZC"), NativeFourCC("CGZT")})
        if (!candidate->plan(dialog).profile) {
            delete candidate;
            return false;
        }
    registry = records;
    texts = intentTexts;
    owner = candidate;
    for (const auto &r : records->buildingOpenToggles)
        if (!r.panelDialogId &&
            (r.parentDialogId == NativeFourCC("CGAG") || r.parentDialogId == NativeFourCC("CGZM")))
            for (const auto value : {0U, 1U})
                toggleCommands.emplace(0x40000U + static_cast<unsigned>(toggleCommands.size()),
                                       ToggleCommand{&r, value});
    if (toggleCommands.size() != 4)
        return false;
    capture = records->FindHostileMonsterFlagByPanel(
        records->FindRewardPanelByChildDialog(NativeFourCC("CGZC"))->panelKey);
    if (!capture || !capture->privateMode || capture->privateMode == NativeFourCC("Fl00") ||
        capture->privateMode == NativeFourCC("Fl01") || capture->flagPrototypeName.empty())
        return false;
    capturePrototype =
        heap_alloc(static_cast<std::uint32_t>(capture->flagPrototypeName.size() + 1), true);
    if (!capturePrototype)
        return false;
    for (unsigned i = 0; i <= capture->flagPrototypeName.size(); ++i)
        wr8(capturePrototype + i, capture->flagPrototypeName.c_str()[i]);
    const auto base = heap_alloc(bridgeCount * 16, true);
    if (!base)
        return false;
    for (unsigned i = 0; i < bridgeCount; ++i)
        addresses[i] = base + i * 16;
    const auto addSymbol = [](std::uint32_t command, const std::string &symbol) {
        require(!symbol.empty() && symbol.size() < 128 && !actionSymbols.count(command),
                "unique paid action symbol");
        const auto memory = heap_alloc(static_cast<std::uint32_t>(symbol.size() + 1), true);
        require(memory != 0, "paid action symbol allocation");
        for (unsigned i = 0; i <= symbol.size(); ++i)
            wr8(memory + i, symbol.c_str()[i]);
        actionSymbols.emplace(command, memory);
    };
    addSymbol(records->FindLiveAgentListByChild(NativeFourCC("CGAQ"))->actionCommandId,
              records->FindLiveAgentListByChild(NativeFourCC("CGAQ"))->actionCallbackSymbol);
    addSymbol(records->FindOccupantPanelByChild(NativeFourCC("CGZT"))->actionCommandId,
              records->FindOccupantPanelByChild(NativeFourCC("CGZT"))->actionCallbackSymbol);
    module.base = base;
    module.end = base + bridgeCount * 16;
    recomp_module_register(&module);
    return true;
}
extern "C" std::uint32_t majesty_expansion_panel_bridge(unsigned index) {
    return owner && index < bridgeCount ? addresses[index] : 0;
}
extern "C" bool majesty_is_expansion_dialog(std::uint32_t dialog) {
    return owner && owner->plan(dialog).profile;
}
extern "C" bool majesty_is_expansion_paid_command(std::uint32_t command) {
    return actionSymbols.count(command) != 0 || toggleCommands.count(command) != 0;
}
extern "C" std::uint32_t majesty_expansion_action_symbol() {
    return executingSymbol;
}
extern "C" std::uint32_t majesty_expansion_capture_prototype() {
    return capturePrototype;
}
extern "C" std::uint32_t majesty_expansion_panel_for_unit(std::uint32_t unit,
                                                          std::uint32_t dialog) {
    if (owner)
        for (const auto &s : owner->forUnit(unit))
            if (s.dialog == dialog)
                return s.controller;
    return 0;
}
extern "C" void majesty_reset_expansion_panels(X86 *cpu) {
    if (owner) {
        Ops ops(cpu);
        owner->clear(ops);
    }
    presentations.clear();
    executingSymbol = 0;
    captureZoo = captureZooId = captureWorld = 0;
    captureAmount = ~0U;
}
