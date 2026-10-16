#pragma once
#include "runtime/x86.h"
#include <array>
#include <cstdint>
#include <cstring>

namespace MajestyCommunity {
enum class PrivateTemplateBridge : unsigned {
    Recruit0,
    Tooltip0,
    Recruit1,
    Tooltip1,
    Recruit2,
    Tooltip2,
    Counts,
    Setup,
    Event,
    RefreshAll
};
constexpr unsigned privateTemplateBridgeCount = 10;
constexpr std::uint32_t privateTemplateBridgeBytes = privateTemplateBridgeCount * 16;
// Patched stock code is private data, not an alternate global image. Host
// pointers stay typed inside this bank; only separately allocated bridge
// addresses may be written into guest controller tables.
class PrivateTemplateBank {
    std::array<const RecompModule *, 4> modules{};

  public:
    static constexpr std::array<const char *, 4> names = {
        "majesty_private_recruit0", "majesty_private_recruit1", "majesty_private_recruit2",
        "majesty_private_common"};
    static bool permitted(unsigned slot, std::uint32_t address) {
        if (slot < 3)
            return address >= 0x00465510 && address < 0x00465bf0;
        return (address >= 0x0047e680 && address < 0x0047e830) ||
               (address >= 0x0047e8f0 && address < 0x0047e9c0) ||
               (address >= 0x0047f1b0 && address < 0x0047f270) ||
               (address >= 0x0047f530 && address < 0x0047f640);
    }
    bool add(const RecompModule *module) {
        if (!module || !module->name || module->base != 0x00400000 || module->end != 0x00726000 ||
            !module->func_addrs || !module->base_ptrs || module->func_count < 2 ||
            module->func_count > 16)
            return false;
        unsigned slot = 0;
        while (slot < names.size() && std::strcmp(module->name, names[slot]))
            ++slot;
        if (slot == names.size() || modules[slot])
            return false;
        for (unsigned i = 0; i < module->func_count; ++i)
            if (!module->base_ptrs[i] || !permitted(slot, module->func_addrs[i]) ||
                (i && module->func_addrs[i - 1] >= module->func_addrs[i]))
                return false;
        const auto has = [&](std::uint32_t address) {
            for (unsigned i = 0; i < module->func_count; ++i)
                if (module->func_addrs[i] == address)
                    return true;
            return false;
        };
        if (slot < 3 ? !has(0x00465510) || !has(0x00465ac0)
                     : !has(0x0047e680) || !has(0x0047e8f0) || !has(0x0047f1b0) || !has(0x0047f530))
            return false;
        modules[slot] = module;
        return true;
    }
    bool ready() const {
        for (const auto *module : modules)
            if (!module)
                return false;
        return true;
    }
    void (*find(unsigned slot, std::uint32_t address) const)(X86 *) {
        if (slot >= modules.size() || !modules[slot])
            return nullptr;
        const auto *module = modules[slot];
        for (unsigned i = 0; i < module->func_count; ++i)
            if (module->func_addrs[i] == address)
                return module->base_ptrs[i];
        return nullptr;
    }
};
} // namespace MajestyCommunity

// Generated constructors call this collector through a compile definition,
// never recomp_module_register. It performs no guest-memory access.
extern "C" void majesty_collect_private_template(const RecompModule *);
extern "C" bool majesty_private_templates_ready();
// A process-lifetime builtin owns the backing guest allocation until process
// exit (privateTemplateBridgeBytes bytes). A dynamically unloadable plugin is
// refused at compile configuration. This is not per-panel allocation.
extern "C" bool majesty_install_private_template_bridges(std::uint32_t base);
extern "C" std::uint32_t majesty_private_template_bridge(unsigned slot);
