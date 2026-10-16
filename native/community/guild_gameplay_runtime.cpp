#include "guild_gameplay_runtime.h"
#include "guild_gameplay_services.h"
#include "kingdom_research_descriptors.h"
#include "runtime/guest.h"
#include "runtime/memory.h"
#include <cstdio>
#include <cstdlib>
#include <initializer_list>

extern "C" void fn_004ca4f0(X86 *);
extern "C" void fn_004ac2f0(X86 *);
extern "C" void fn_004abf70(X86 *);

namespace {
using namespace MajestyCommunity;
GuildGameplayServices *gameplay = nullptr;
const std::vector<ResearchBinding> *bindings = nullptr;
KingdomResearchDescriptors descriptors;
std::vector<MajestyRuntimeFeatures::KingdomResearchRecord> descriptorRecords;
ResearchInFlight *flight = nullptr;
[[noreturn]] void fail(const char *reason) {
    std::fprintf(stderr, "[community-guild-gameplay] refused: %s\n", reason);
    std::abort();
}
struct Ops {
    X86 *source;
    std::uint32_t memory;
    explicit Ops(X86 *cpu) : source(cpu), memory(cpu->r[R_ESP] - 256) {
        // Reserve scratch above the separate guest_call stack (ESP-512).
        // The guest baton excludes concurrent writers; nested calls get a
        // lower source stack. Busy/presentation callbacks need no heap churn.
        require(cpu->r[R_ESP] >= 1024 && valid(memory, 256), "original game service scratch");
    }
    void require(bool value, const char *reason) {
        if (!value)
            fail(reason);
    }
    bool valid(std::uint32_t address, std::uint32_t bytes) {
        return address && gm_valid(address, bytes);
    }
    std::uint32_t read(std::uint32_t address) {
        require(valid(address, 4), "original service read");
        return rd32(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        require(valid(address, 4), "original service write");
        wr32(address, value);
    }
    std::uint32_t call(std::uint32_t target, std::uint32_t self,
                       std::initializer_list<std::uint32_t> args = {}) {
        X86 extra = *source;
        extra.r[R_ESP] -= 512;
        extra.r[R_ECX] = self;
        return guest_call(&extra, target, args.begin(), static_cast<int>(args.size()));
    }
    std::uint32_t now() {
        return read(0x0071c6a8U);
    }
    std::uint32_t attribute(std::uint32_t unit, std::uint32_t id) {
        return call(0x005a1c40U, unit, {id, 0});
    }
    void setAttribute(std::uint32_t unit, std::uint32_t id, std::uint32_t value) {
        call(read(read(unit) + 0x124), unit, {id, value});
    }
    const ResearchBinding *binding(std::uint32_t unit, std::uint32_t command) {
        if (!unit || !valid(unit, 0x70))
            return nullptr;
        for (const auto &r : *bindings)
            if (r.nativeFamily == (read(unit + 0x6c) & 0xffffffU) &&
                r.record.actionControlId == command)
                return &r;
        return nullptr;
    }
    bool hasOrder(std::uint32_t unit, std::uint32_t command) {
        if (attribute(unit, 0x2c425041U) != command)
            return false;
        require(read(read(unit) + 0x180) == 0x005b2e10U, "original research order accessor");
        return call(0x005b2e10U, unit, {1, 0x4005}) != 0;
    }
    void rawAttribute(std::uint32_t unit, std::uint32_t id, std::uint32_t value) {
        // Old's non-notifying base setter calls the packed map at unit+4.
        // Avoid the derived +124 setter recursively notifying this presenter.
        call(0x005b46a0U, unit, {id, value});
    }
    std::uint32_t scalar(const std::string &symbol, std::uint32_t unit, std::int32_t operation) {
        require(unit && !symbol.empty() && symbol.size() < 120, "original saved-state signature");
        const auto storage = memory;
        for (unsigned i = 0; i <= symbol.size(); ++i)
            wr8(storage + 128 + i, symbol[i]);
        call(0x004e3520U, storage, {storage + 128});
        const auto evaluator = storage + 32;
        call(0x00629910U, evaluator, {storage});
        call(0x004e3820U, storage);
        const auto function = read(evaluator + 4);
        require(function && read(function + 20) == 0x0061e4c0U,
                "source-bound interpreted saved-state callback");
        call(0x00629bf0U, evaluator);
        call(0x00629a20U, evaluator, {unit});
        call(0x00629a40U, evaluator, {static_cast<std::uint32_t>(operation)});
        call(0x00629c40U, evaluator);
        const auto begin = read(evaluator + 0x20), end = read(evaluator + 0x24);
        require(begin && end >= begin && end - begin >= 4 && end - begin <= 64,
                "original saved-state result span");
        require(read(read(read(begin)) + 4) == 1, "original saved-state integer result");
        const auto result = call(0x00629c10U, evaluator);
        call(0x006299b0U, evaluator);
        return result;
    }
    std::uint32_t lookup(std::uint32_t id) {
        write(memory + 208, id);
        call(0x00475390U, 0x006d81d0U, {memory + 212, memory + 208});
        const auto node = read(memory + 212);
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
        write(memory + 208, id);
        const auto slot = call(0x00475270U, 0x006d81d0U, {memory + 208});
        if (!slot || read(slot))
            return false;
        write(slot, descriptor);
        return lookup(id) == descriptor;
    }
    void prepareResearch() {
        if (!(read(0x006d81e0U) & 255))
            call(0x004736a0U, 0);
        require(descriptors.prepare(*this, descriptorRecords),
                "original private research descriptors");
    }
    bool affordable(std::uint32_t controller, std::uint32_t command) {
        return (call(0x00474c10U, controller, {command}) & 255) != 0;
    }
    void submit(std::uint32_t unit, std::uint32_t command) {
        const auto owner = read(unit + 0x84);
        require(owner && read(unit + 0x60), "original research unit identity and owner");
        call(0x00495900U, 0, {owner, unit, command});
    }
    void visible(const RecruitmentPanelSession &s, std::uint32_t id, bool shown) {
        call(read(read(s.window) + 0x20), s.window, {id, shown ? 1U : 0U});
    }
    void message(const RecruitmentPanelSession &s, std::uint32_t id, std::uint32_t code,
                 std::uint32_t first, std::uint32_t second) {
        call(read(read(s.window) + 0x68), s.window, {id, code, first, second});
    }
    void refreshResearch(const RecruitmentPanelSession &s, std::uint32_t command) {
        call(0x004748c0U, 0, {s.window, s.unit, command});
    }
    void progress(const RecruitmentPanelSession &s, std::uint32_t id, std::uint32_t elapsed,
                  std::uint32_t duration) {
        write(memory, 7);
        write(memory + 4, elapsed);
        write(memory + 8, 0);
        write(memory + 12, duration);
        message(s, id, 0x29, 0, memory);
        message(s, id, 8, 0, 0);
    }
};
bool busy(X86 *cpu, std::uint32_t unit) {
    Ops ops(cpu);
    return gameplay->busy(ops, unit);
}
bool command(X86 *cpu, const RecruitmentPanelSession *s, std::uint32_t control) {
    Ops ops(cpu);
    return gameplay->command(ops, *s, control);
}
std::uint32_t toggle(X86 *cpu, const RecruitmentPanelSession *s, std::uint32_t control) {
    Ops ops(cpu);
    return gameplay->toggle(ops, *s, control);
}
void extras(X86 *cpu, const RecruitmentPanelSession *s) {
    Ops ops(cpu);
    gameplay->extras(ops, *s);
}
const RecruitmentPanelServices callbacks{busy, command, toggle, extras};
#if defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
void returned(X86 *cpu, unsigned count, std::uint32_t value = 0) {
    if (!gm_valid(cpu->r[R_ESP], 4))
        fail("original bridge return");
    cpu->eip = rd32(cpu->r[R_ESP]);
    cpu->r[R_ESP] += 4 + count * 4;
    cpu->r[R_EAX] = value;
    recomp_return(cpu);
}
void factoryBody(X86 *cpu) {
    if (!majesty_recruitment_dialog_factory(cpu))
        fn_004ca4f0(cpu);
}
void executeBody(X86 *cpu) {
    Ops ops(cpu);
    const auto unit = ops.read(cpu->r[R_ESP] + 4), command = ops.read(cpu->r[R_ESP] + 8);
    const auto *r = ops.binding(unit, command);
    if (!r) {
        fn_004ac2f0(cpu);
        return;
    }
    const auto encoded = ops.read(unit + 0x6c) >> 24;
    const auto level = encoded == '2' ? 2U : encoded == '3' ? 3U : 1U;
    if (ops.attribute(unit, 0x0d425041U) != 0 || level < r->record.requiredLevel ||
        ops.attribute(unit, 0x01425041U) != 1 || ops.attribute(unit, 0x02425041U) != 1) {
        returned(cpu, 2);
        return;
    }
    ops.prepareResearch();
    ResearchFlight scope(*flight, unit, command);
    const auto status = ops.scalar(r->record.CallbackSymbol(), unit, 1);
    ops.require(status <= 3, "saved research reservation status");
    if (status != 0) {
        returned(cpu, 2);
        return;
    }
    // Original Old execution alone checks/pays gold, notifies and installs
    // saved4005. Preserve its return registers and original packed tuple.
    fn_004ac2f0(cpu);
    if (!ops.hasOrder(unit, command)) {
        const auto canceled = ops.scalar(r->record.CallbackSymbol(), unit, 3);
        ops.require(canceled <= 3, "saved refused research reservation cancellation");
    }
}
void completeBody(X86 *cpu) {
    Ops ops(cpu);
    const auto unit = ops.read(cpu->r[R_ESP] + 8), reason = ops.read(cpu->r[R_ESP] + 20);
    const auto command = unit ? ops.attribute(unit, 0x2c425041U) : 0;
    const auto *r = ops.binding(unit, command);
    if (!r) {
        fn_004abf70(cpu);
        return;
    }
    ops.prepareResearch();
    ResearchFlight scope(*flight, unit, command);
    fn_004abf70(cpu);
    if (reason == 2) {
        ops.require(ops.attribute(unit, 0x2c425041U) != command &&
                        ops.scalar(r->record.CallbackSymbol(), unit, 2) == 1,
                    "original completion retired the saved reservation");
    } else if (reason == 1) {
        ops.require(ops.scalar(r->record.CallbackSymbol(), unit, 3) <= 3,
                    "saved canceled research reservation");
        ops.setAttribute(unit, 0x2c425041U, 0);
        ops.setAttribute(unit, 0x0d425041U, 0);
    }
    majesty_refresh_recruitment_for_unit(cpu, unit);
}
void resetBody(X86 *cpu) {
    majesty_reset_recruitment_panels(cpu);
    gameplay->reset();
    returned(cpu, 0);
}
std::array<std::uint32_t, 4> addresses{};
std::array<std::uint8_t, 4> hooked{};
void (*const bodies[4])(X86 *) = {factoryBody, executeBody, completeBody, resetBody};
void hookedBody(X86 *cpu, std::uint32_t index) {
    if (index >= 4)
        fail("process bridge index");
    bodies[index](cpu);
}
RecompHookFn hooks[4] = {hookedBody, hookedBody, hookedBody, hookedBody};
RecompModule bridges{"majesty_guild_gameplay",
                     0,
                     0,
                     addresses.data(),
                     4,
                     bodies,
                     hooks,
                     hooked.data(),
                     nullptr,
                     0,
                     nullptr};
bool installed = false;
#endif
} // namespace
extern "C" const MajestyCommunity::RecruitmentPanelServices *
majesty_configure_guild_gameplay(const MajestyStockControllers::Registry *registry,
                                 const std::vector<MajestyCommunity::ResearchBinding> *research,
                                 MajestyCommunity::ResearchInFlight *active) {
    if (gameplay || !registry || !research || research->empty() || !active)
        return nullptr;
    bindings = research;
    for (const auto &binding : *research)
        descriptorRecords.push_back(binding.record);
    flight = active;
    gameplay = new GuildGameplayServices(*registry, *research);
    return &callbacks;
}
extern "C" void majesty_reset_guild_gameplay() {
    if (gameplay)
        gameplay->reset();
}

extern "C" std::uint32_t majesty_guild_process_bridge(unsigned index) {
#if !defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    (void)index;
    return 0;
#else
    if (!gameplay || !flight || index >= 4)
        return 0;
    if (!installed) {
        const auto base = heap_alloc(64, true);
        if (!base)
            fail("process bridge allocation");
        for (unsigned i = 0; i < 4; ++i)
            addresses[i] = base + i * 16;
        bridges.base = base;
        bridges.end = base + 64;
        recomp_module_register(&bridges);
        installed = true;
    }
    return addresses[index];
#endif
}
