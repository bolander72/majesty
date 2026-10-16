#include "recruitment_panel_runtime.h"
#include "runtime/guest.h"
#include "runtime/memory.h"
#include <cstdio>
#include <cstdlib>
#include <initializer_list>
#include <utility>

extern "C" void fn_004ca4f0(X86 *);

namespace {
using namespace MajestyCommunity;
const MajestyStockControllers::Registry *recipes = nullptr;
const RecruitmentPanelServices *services = nullptr;
RecruitmentPanelOwner *owner = nullptr;
std::map<std::uint32_t, std::uint32_t> families;
std::array<std::uint32_t, recruitmentPanelEntryCount> addresses{};
std::array<std::uint8_t, recruitmentPanelEntryCount> hooked{};
bool installed = false;

[[noreturn]] void fail(const char *reason) {
    std::fprintf(stderr, "[community-recruitment] refused: %s\n", reason);
    std::abort();
}
void require(bool value, const char *reason) {
    if (!value)
        fail(reason);
}
std::uint32_t read(std::uint32_t address) {
    require(gm_valid(address, 4), "guest read");
    return rd32(address);
}
void returned(X86 *cpu, unsigned arguments, std::uint32_t value = 0) {
    cpu->eip = read(cpu->r[R_ESP]);
    cpu->r[R_ESP] += 4 + 4 * arguments;
    cpu->r[R_EAX] = value;
    recomp_return(cpu);
}
struct Ops {
    X86 *source;
    bool valid(std::uint32_t address, std::uint32_t bytes) {
        return address && gm_valid(address, bytes);
    }
    std::uint32_t read(std::uint32_t address) {
        return ::read(address);
    }
    void write(std::uint32_t address, std::uint32_t value) {
        require(gm_valid(address, 4), "guest write");
        wr32(address, value);
    }
    std::uint32_t allocate(std::uint32_t bytes) {
        return heap_alloc(bytes, true);
    }
    void release(std::uint32_t address) {
        require(heap_free(address), "private vtable release");
    }
    std::uint32_t call(std::uint32_t target, std::uint32_t self,
                       std::initializer_list<std::uint32_t> args = {}) {
        X86 extra = *source;
        extra.r[R_ESP] -= 512;
        extra.r[R_ECX] = self;
        return guest_call(&extra, target, args.begin(), static_cast<int>(args.size()));
    }
    std::uint32_t unit(std::uint32_t controller) {
        return call(0x00481ec0U, controller);
    }
    bool researchBusy(std::uint32_t unit) {
        return services->researchBusy(source, unit);
    }
    bool researchCommand(const RecruitmentPanelSession &s, std::uint32_t command) {
        return services->researchCommand(source, &s, command);
    }
    std::uint32_t toggle(const RecruitmentPanelSession &s, std::uint32_t command) {
        return services->toggle(source, &s, command);
    }
    void extras(const RecruitmentPanelSession &s) {
        services->extras(source, &s);
    }
    void visible(const RecruitmentPanelSession &s, std::uint32_t control, bool shown) {
        call(read(read(s.window) + 0x20), s.window, {control, shown ? 1U : 0U});
    }
    void disable(const RecruitmentPanelSession &s, std::uint32_t control) {
        call(read(read(s.window) + 0x68), s.window, {control, 0x0a, 1, 0});
    }
    void present(const RecruitmentPanelSession &s, PrivateTemplateBridge bridge) {
        const auto address = majesty_private_template_bridge(static_cast<unsigned>(bridge));
        require(address != 0, "private original presenter unavailable");
        call(address, s.controller);
    }
    std::uint32_t openChild(const RecruitmentPanelSession &s) {
        return call(0x0047c5c0U, s.controller, {s.recipe->childDialogId, 0});
    }
    std::uint32_t returnParent(const RecruitmentPanelSession &s) {
        const auto manager = call(0x00415b40U, 0);
        // Native window close can destroy this controller. Only captured
        // values are used afterwards; the child's own unit supplies context.
        call(read(read(s.window) + 0x14), s.window);
        call(0x00416890U, manager, {s.recipe->parentDialogId, s.unit, 0, 0});
        return 1;
    }
    std::uint32_t stockControl(const RecruitmentPanelSession &s, std::uint32_t command) {
        return call(PrivateControllerDispatch::recruitmentVtable[3], s.controller, {command});
    }
    std::uint32_t describe(const RecruitmentPanelSession &s, unsigned index, std::uint32_t command,
                           std::uint32_t argument, std::uint32_t text) {
        const auto slot = static_cast<unsigned>(PrivateTemplateBridge::Tooltip0) + index * 2;
        return call(majesty_private_template_bridge(slot), s.controller, {command, argument, text});
    }
    std::uint32_t stockTooltip(const RecruitmentPanelSession &s, std::uint32_t command,
                               std::uint32_t argument, std::uint32_t text) {
        return call(PrivateControllerDispatch::recruitmentVtable[2], s.controller,
                    {command, argument, text});
    }
    void nativeEvent(const RecruitmentPanelSession &s, const std::array<std::uint32_t, 4> &args) {
        call(majesty_private_template_bridge(static_cast<unsigned>(PrivateTemplateBridge::Event)),
             s.controller, {args[0], args[1], args[2], args[3]});
    }
    std::uint32_t stockDestroy(const RecruitmentPanelSession &s, std::uint32_t flags) {
        return call(PrivateControllerDispatch::recruitmentVtable[0], s.controller, {flags});
    }
};

template <RecruitmentPanelEntry Entry> void invoke(X86 *cpu) {
    require(owner != nullptr, "private owner unavailable");
    Ops ops{cpu};
    const auto self = cpu->r[R_ECX];
    const auto sp = cpu->r[R_ESP];
    require(owner->find(self).recipe != nullptr, "private panel lost ownership");
    if constexpr (Entry == RecruitmentPanelEntry::Destroy) {
        returned(cpu, 1, owner->destroy(ops, self, read(sp + 4)));
    } else if constexpr (Entry == RecruitmentPanelEntry::Setup) {
        owner->setup(ops, self);
        returned(cpu, 0);
    } else if constexpr (Entry == RecruitmentPanelEntry::Tooltip) {
        returned(cpu, 3, owner->tooltip(ops, self, read(sp + 4), read(sp + 8), read(sp + 12)));
    } else if constexpr (Entry == RecruitmentPanelEntry::Control) {
        returned(cpu, 1, owner->control(ops, self, read(sp + 4)));
    } else if constexpr (Entry == RecruitmentPanelEntry::Event) {
        owner->event(ops, self, {read(sp + 4), read(sp + 8), read(sp + 12), read(sp + 16)});
        returned(cpu, 4);
    } else if constexpr (Entry == RecruitmentPanelEntry::Refresh) {
        owner->refresh(ops, self);
        returned(cpu, 0);
    } else {
        owner->counts(ops, self);
        returned(cpu, 0);
    }
}
void (*const bodies[recruitmentPanelEntryCount])(X86 *) = {
    invoke<RecruitmentPanelEntry::Destroy>, invoke<RecruitmentPanelEntry::Setup>,
    invoke<RecruitmentPanelEntry::Tooltip>, invoke<RecruitmentPanelEntry::Control>,
    invoke<RecruitmentPanelEntry::Event>,   invoke<RecruitmentPanelEntry::Refresh>,
    invoke<RecruitmentPanelEntry::Counts>};
void hookedBody(X86 *cpu, std::uint32_t index) {
    require(index < recruitmentPanelEntryCount, "private bridge index");
    bodies[index](cpu);
}
RecompHookFn hooks[recruitmentPanelEntryCount] = {hookedBody, hookedBody, hookedBody, hookedBody,
                                                  hookedBody, hookedBody, hookedBody};
[[maybe_unused]] RecompModule bridges{"majesty_recruitment_panel_owners",
                                      0,
                                      0,
                                      addresses.data(),
                                      recruitmentPanelEntryCount,
                                      bodies,
                                      hooks,
                                      hooked.data(),
                                      nullptr,
                                      0,
                                      nullptr};

bool ensureBridges() {
#if !defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    return false;
#else
    if (installed)
        return true;
    if (!majesty_private_templates_ready())
        return false;
    if (!majesty_private_template_bridge(0)) {
        const auto base = heap_alloc(privateTemplateBridgeBytes, true);
        if (!base)
            return false;
        if (!majesty_install_private_template_bridges(base)) {
            heap_free(base);
            return false;
        }
    }
    const auto base = heap_alloc(recruitmentPanelEntryCount * 16, true);
    if (!base)
        return false;
    for (unsigned i = 0; i < recruitmentPanelEntryCount; ++i)
        addresses[i] = base + i * 16;
    bridges.base = base;
    bridges.end = base + recruitmentPanelEntryCount * 16;
    recomp_module_register(&bridges);
    installed = true;
    return true;
#endif
}
} // namespace

extern "C" bool
majesty_configure_recruitment_panels(const MajestyStockControllers::Registry *registry,
                                     const RecruitmentPanelBinding *bindings, unsigned count,
                                     const RecruitmentPanelServices *callbacks) {
#if !defined(RECOMP_PRIVATE_TEMPLATE_PROCESS_LIFETIME)
    (void)registry;
    (void)bindings;
    (void)count;
    (void)callbacks;
    return false;
#else
    if (owner || !registry || registry->privateRecruitments.empty() || !bindings || !callbacks ||
        !callbacks->researchBusy || !callbacks->researchCommand || !callbacks->toggle ||
        !callbacks->extras || count != registry->privateRecruitments.size() || count > 32)
        return false;
    std::map<std::uint32_t, std::uint32_t> checked;
    for (unsigned i = 0; i < count; ++i) {
        const auto &binding = bindings[i];
        const auto *recipe = registry->FindPrivateRecruitmentByParent(binding.parentDialogId);
        if (!recipe || recipe->thirdPriceControlId != 29441 || !binding.buildingFamily ||
            binding.buildingFamily > 0xffffffU ||
            !checked.emplace(binding.parentDialogId, binding.buildingFamily).second)
            return false;
    }
    families = std::move(checked);
    recipes = registry;
    services = callbacks;
    owner = new RecruitmentPanelOwner(*recipes);
    return true;
#endif
}

extern "C" bool majesty_recruitment_dialog_factory(X86 *cpu) {
    if (!owner)
        return false;
    const auto args = cpu->r[R_ESP] + 4;
    const auto requested = read(args);
    const auto selected = owner->selector(requested);
    if (selected == requested)
        return false;
    require(ensureBridges(), "process-lifetime presenter installation");
    const auto window = read(args + 4), context = read(args + 8);
    wr32(args, selected);
    fn_004ca4f0(cpu);
    wr32(args, requested);
    const auto *recipe = recipes->FindPrivateRecruitmentByParent(requested);
    if (!recipe)
        recipe = recipes->FindPrivateRecruitmentByChild(requested);
    require(recipe != nullptr, "private factory recipe");
    Ops ops{cpu};
    require(owner->attach(ops, cpu->r[R_EAX], requested, window, context,
                          families.at(recipe->parentDialogId), addresses),
            "native AP52 capture and actor association");
    return true;
}

extern "C" void majesty_reset_recruitment_panels(X86 *cpu) {
    if (owner) {
        Ops ops{cpu};
        owner->clear(ops);
    }
}

extern "C" void majesty_refresh_recruitment_for_unit(X86 *cpu, std::uint32_t unit) {
    if (!owner)
        return;
    Ops ops{cpu};
    for (const auto &session : owner->forUnit(unit)) {
        if (!owner->alive(ops, session))
            continue;
        owner->refresh(ops, session.controller);
        if (!owner->alive(ops, session))
            continue;
        owner->counts(ops, session.controller);
        if (owner->alive(ops, session))
            ops.extras(session);
    }
}
