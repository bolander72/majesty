// Execute the actual private translations against refusing, bounded native
// service fixtures. This does not simulate a mission or qualify live gameplay.
#include "private_template_bank.h"
#include "runtime/guest.h"
#include "template_return_addresses.h"
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <map>
#include <vector>

namespace {
constexpr std::uint32_t controller = HEAP_BASE + 0x1000, window = HEAP_BASE + 0x2000;
constexpr std::uint32_t windowTable = HEAP_BASE + 0x3000, unit = HEAP_BASE + 0x4000;
constexpr std::uint32_t countCall = HEAP_BASE + 0x5000, visibleCall = HEAP_BASE + 0x5010;
constexpr std::uint32_t integerCall = HEAP_BASE + 0x5020, messageCall = HEAP_BASE + 0x5030;
constexpr std::uint32_t stack = STACK_TOP - 0x4000;
std::vector<const RecompModule *> published;
std::map<std::uint32_t, std::uint32_t> visible, numbers;
std::vector<unsigned> indices;
unsigned callbacks = 0, baseSetups = 0, baseEvents = 0, progressMessages = 0;
bool complete = false, busy = false;
const char *phase = "initialization";

void check(bool value) {
    if (!value)
        std::abort();
}
bool knownReturn(std::uint32_t address) {
    return std::binary_search(templateReturnAddresses.begin(), templateReturnAddresses.end(),
                              address);
}
void returned(X86 *cpu, unsigned arguments, std::uint32_t value = 0) {
    const auto target = rd32(cpu->r[R_ESP]);
    check(target == GUEST_RETURN_SENTINEL || knownReturn(target));
    cpu->r[R_ESP] += 4 + arguments * 4;
    cpu->r[R_EAX] = value;
    cpu->eip = target;
    recomp_return(cpu);
}
X86 entry(std::initializer_list<std::uint32_t> args = {}) {
    X86 cpu{};
    cpu.r[R_ECX] = controller;
    cpu.r[R_EBX] = 101;
    cpu.r[R_EBP] = 102;
    cpu.r[R_ESI] = 103;
    cpu.r[R_EDI] = 104;
    cpu.r[R_ESP] = stack;
    cpu.fs_base = TEB_BASE;
    wr32(TEB_BASE, 0xffffffff);
    wr32(stack, GUEST_RETURN_SENTINEL);
    unsigned offset = 4;
    for (auto value : args) {
        wr32(stack + offset, value);
        offset += 4;
    }
    return cpu;
}
void checkExit(const X86 &cpu, unsigned arguments) {
    check(cpu.r[R_ESP] == stack + 4 + arguments * 4 && cpu.eip == GUEST_RETURN_SENTINEL);
    check(cpu.r[R_EBX] == 101 && cpu.r[R_EBP] == 102 && cpu.r[R_ESI] == 103 && cpu.r[R_EDI] == 104);
    check(rd32(TEB_BASE) == 0xffffffff);
}
} // namespace

extern "C" {
std::uint8_t *g_mem = nullptr;
RecompDirty g_dirty[RECOMP_DIRTY_SLOTS]{};
std::uint32_t g_dirty_count = 0, g_watch_base = 0, g_watch_len = 0, recomp_frame_watch = 0;
const int recomp_profile_enabled = 0, recomp_resumable_stacks = 0;
void recomp_module_register(const RecompModule *module) {
    published.push_back(module);
}
std::uint32_t recomp_module_count() {
    return static_cast<std::uint32_t>(published.size());
}
const RecompModule *recomp_module_at(std::uint32_t index) {
    return published.at(index);
}
int recomp_is_call_return(std::uint32_t target) {
    return knownReturn(target);
}
int recomp_module_is_call_return(std::uint32_t) {
    return 0;
}
std::int32_t recomp_index_of(std::uint32_t) {
    return -1;
}
std::int32_t recomp_module_lookup(std::uint32_t) {
    return -1;
}
void recomp_callback_return(X86 *cpu) {
    check(cpu->eip == GUEST_RETURN_SENTINEL);
    ++callbacks;
}
void recomp_watch_hit(std::uint32_t, std::uint32_t, std::uint64_t) {
    std::abort();
}
void recomp_frame_changed(X86 *, std::uint32_t, std::uint32_t, std::uint32_t) {
    std::abort();
}
void recomp_call(X86 *cpu, std::uint32_t target) {
    const auto sp = cpu->r[R_ESP];
    if (!published.empty() && target >= published[0]->base && target < published[0]->end) {
        const auto *module = published[0];
        check((target - module->base) % 16 == 0);
        module->base_ptrs[(target - module->base) / 16](cpu);
    } else if (target == 0x00481ec0) {
        check(cpu->r[R_ECX] == controller);
        returned(cpu, 0, unit);
    } else if (target == 0x005a1c40) {
        check(cpu->r[R_ECX] == unit && rd32(sp + 4) == 0x01425041 && !rd32(sp + 8));
        returned(cpu, 2, complete ? 1 : 0);
    } else if (target == 0x00497990) {
        check(rd32(sp + 4) == 915);
        returned(cpu, 1, unit);
    } else if (target == 0x0049f640) {
        check(cpu->r[R_ECX] == unit);
        returned(cpu, 0, busy ? 2 : 0);
    } else if (target == visibleCall) {
        check(cpu->r[R_ECX] == window);
        visible[rd32(sp + 4)] = rd32(sp + 8);
        returned(cpu, 2);
    } else if (target == integerCall) {
        check(cpu->r[R_ECX] == window && !rd32(sp + 12));
        numbers[rd32(sp + 4)] = rd32(sp + 8);
        returned(cpu, 3);
    } else if (target == countCall) {
        const auto index = rd32(sp + 4);
        check(cpu->r[R_ECX] == controller && index < 3);
        indices.push_back(index);
        returned(cpu, 1, index + 2);
    } else if (target == messageCall) {
        check(cpu->r[R_ECX] == window && rd32(sp + 4) == 0x1f56);
        ++progressMessages;
        returned(cpu, 4);
    } else if (target == 0x00465aa0) {
        check(cpu->r[R_ECX] == controller);
        ++baseSetups;
        returned(cpu, 0);
    } else if (target == 0x00466110) {
        check(cpu->r[R_ECX] == controller && rd32(sp + 4) == 11 && rd32(sp + 8) == 22 &&
              rd32(sp + 16) == 44);
        ++baseEvents;
        returned(cpu, 4);
    } else {
        std::fprintf(stderr,
                     "Unexpected native template service %08x return=%08x this=%08x phase=%s\n",
                     target, rd32(sp), cpu->r[R_ECX], phase);
        std::abort();
    }
}
void majesty_template_common_fn_0047e8f0(X86 *);
} // extern C

// Only the callback bookkeeping is a fixture here. The target instructions,
// stack writes, registers and native branches execute from the real generated
// modules. Live callback/SEH integration remains an in-engine test.
std::uint32_t guest_call(X86 *cpu, std::uint32_t target, const std::uint32_t *args, int count) {
    const auto savedEsp = cpu->r[R_ESP], savedEip = cpu->eip;
    for (int i = count - 1; i >= 0; --i) {
        cpu->r[R_ESP] -= 4;
        wr32(cpu->r[R_ESP], args[i]);
    }
    cpu->r[R_ESP] -= 4;
    wr32(cpu->r[R_ESP], GUEST_RETURN_SENTINEL);
    recomp_call(cpu, target);
    check(cpu->r[R_ESP] == savedEsp && cpu->eip == GUEST_RETURN_SENTINEL);
    cpu->r[R_ESP] = savedEsp;
    cpu->eip = savedEip;
    return cpu->r[R_EAX];
}

int main() {
    check(majesty_private_templates_ready() && published.empty());
    g_mem = static_cast<std::uint8_t *>(std::calloc(GUEST_SIZE, 1));
    check(g_mem && majesty_install_private_template_bridges(HEAP_BASE));
    check(published.size() == 1 && published[0]->base == HEAP_BASE);
    const auto *bridges = published[0];
    wr32(controller + 0x14, window);
    wr32(window, windowTable);
    wr32(unit + 0x60, 915);
    wr32(windowTable + 0x20, visibleCall);
    wr32(windowTable + 0x5c, integerCall);
    wr32(windowTable + 0x68, messageCall);
    const auto controllerTable = HEAP_BASE + 0x6000;
    wr32(controller, controllerTable);
    wr32(controllerTable + 0x38, countCall);
    wr32(controllerTable + 0x34, majesty_private_template_bridge(9));
    wr32(controllerTable + 0x40, majesty_private_template_bridge(6));
    phase = "availability";
    auto cpu = entry({HEAP_BASE + 0x7000, HEAP_BASE + 0x7010});
    majesty_template_common_fn_0047e8f0(&cpu);
    check(rd32(HEAP_BASE + 0x7000) == 1 && rd32(HEAP_BASE + 0x7010) == 1);
    checkExit(cpu, 2);
    phase = "counts";
    cpu = entry();
    bridges->base_ptrs[6](&cpu);
    checkExit(cpu, 0);
    check(indices == std::vector<unsigned>({1, 2, 0}));
    check(numbers[0x1f0d] == 3 && numbers[0x1f1b] == 2 && numbers[0x1f1c] == 4);
    for (unsigned i = 0; i < 3; ++i) {
        const auto command = std::array<std::uint32_t, 3>{0x1f48, 0x1389, 0x1388}[i];
        const auto price = std::array<std::uint32_t, 3>{0x1752, 0x1f51, 29441}[i];
        phase = "construction";
        complete = false;
        busy = false;
        visible.clear();
        cpu = entry();
        bridges->base_ptrs[i * 2](&cpu);
        checkExit(cpu, 0);
        check(visible == std::map<std::uint32_t, std::uint32_t>{
                             {command, 0}, {price, 0}, {0x1f56, 0}, {0x1f57, 0}});
        phase = "pending-queue";
        complete = true;
        busy = true;
        visible.clear();
        cpu = entry();
        bridges->base_ptrs[i * 2](&cpu);
        checkExit(cpu, 0);
        check(visible.count(command) && visible.count(price) && visible[command] == 0 &&
              visible[price] == 0 && visible[0x1f56] == 1);
    }
    check(progressMessages == 3);
    phase = "base-setup";
    cpu = entry();
    bridges->base_ptrs[7](&cpu);
    checkExit(cpu, 0);
    check(baseSetups == 1);
    phase = "base-event";
    for (auto notification : {0x00505041U, 0x01435358U, 0x00435358U, 0x02435358U, 0x00425041U}) {
        cpu = entry({11, 22, notification, 44});
        bridges->base_ptrs[8](&cpu);
        checkExit(cpu, 4);
    }
    check(baseEvents == 5 && callbacks >= 14);
    std::free(g_mem);
    g_mem = nullptr;
    return 0;
}
