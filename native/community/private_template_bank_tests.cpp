#include "private_template_bank.h"
#include "runtime/guest.h"
#include <cstdlib>
#include <stdexcept>
#include <vector>

extern "C" {
std::uint8_t *g_mem = nullptr;
RecompDirty g_dirty[RECOMP_DIRTY_SLOTS]{};
std::uint32_t g_dirty_count = 0, g_watch_base = 0, g_watch_len = 0;
const int recomp_resumable_stacks = 0;
void recomp_watch_hit(std::uint32_t, std::uint32_t, std::uint64_t) {
    std::abort();
}
}
namespace {
std::vector<const RecompModule *> published;
std::vector<std::uint32_t> presenterCalls;
void check(bool value) {
    if (!value)
        throw std::runtime_error("private native template bank failed");
}
template <unsigned Slot> void body(X86 *cpu) {
    cpu->r[R_EAX] = Slot + 100;
}
} // namespace
extern "C" void recomp_module_register(const RecompModule *module) {
    published.push_back(module);
}
extern "C" std::uint32_t recomp_module_count() {
    return static_cast<std::uint32_t>(published.size());
}
extern "C" const RecompModule *recomp_module_at(std::uint32_t index) {
    return published.at(index);
}
extern "C" int recomp_is_call_return(std::uint32_t) {
    return 0;
}
extern "C" int recomp_module_is_call_return(std::uint32_t) {
    return 0;
}
extern "C" std::int32_t recomp_index_of(std::uint32_t) {
    return -1;
}
extern "C" std::int32_t recomp_module_lookup(std::uint32_t) {
    return -1;
}
extern "C" void recomp_callback_return(X86 *) {}
extern "C" void recomp_call(X86 *, std::uint32_t) {
    std::abort();
}
std::uint32_t guest_call(X86 *cpu, std::uint32_t address, const std::uint32_t *, int count) {
    check(!count && cpu->r[R_ECX] == 1234);
    presenterCalls.push_back(address);
    const auto *module = published[0];
    const auto slot = (address - module->base) / 16;
    module->base_ptrs[slot](cpu);
    return cpu->r[R_EAX];
}

int main() {
    const std::uint32_t recruitEntries[] = {0x00465510, 0x00465ac0};
    const std::uint32_t commonEntries[] = {0x0047e680, 0x0047e8f0, 0x0047f1b0, 0x0047f530};
    void (*const r0[])(X86 *) = {body<0>, body<1>};
    void (*const r1[])(X86 *) = {body<2>, body<3>};
    void (*const r2[])(X86 *) = {body<4>, body<5>};
    void (*const common[])(X86 *) = {body<6>, body<99>, body<7>, body<8>};
    RecompModule modules[] = {{"majesty_private_recruit0", 0x00400000, 0x00726000, recruitEntries,
                               2, r0, nullptr, nullptr, nullptr, 0, nullptr},
                              {"majesty_private_recruit1", 0x00400000, 0x00726000, recruitEntries,
                               2, r1, nullptr, nullptr, nullptr, 0, nullptr},
                              {"majesty_private_recruit2", 0x00400000, 0x00726000, recruitEntries,
                               2, r2, nullptr, nullptr, nullptr, 0, nullptr},
                              {"majesty_private_common", 0x00400000, 0x00726000, commonEntries, 4,
                               common, nullptr, nullptr, nullptr, 0, nullptr}};
    MajestyCommunity::PrivateTemplateBank local;
    check(!local.ready() && !local.add(nullptr));
    auto invalid = modules[0];
    invalid.end += 16;
    check(!local.add(&invalid));
    invalid = modules[0];
    invalid.name = "stock_global_replacement";
    check(!local.add(&invalid));
    const std::uint32_t wrongEntries[] = {0x00465510, 0x004ca4f0};
    invalid = modules[0];
    invalid.func_addrs = wrongEntries;
    check(!local.add(&invalid));
    for (const auto &module : modules) {
        check(local.add(&module));
        check(!local.add(&module));
        majesty_collect_private_template(&module);
    }
    check(local.ready() && majesty_private_templates_ready());
    check(published.empty()); // Original-address templates were never registered.
    check(!local.find(4, 0x00465510) && !local.find(0, 0x004ca4f0));
    check(!majesty_private_template_bridge(0));
    g_mem = static_cast<std::uint8_t *>(std::calloc(GUEST_SIZE, 1));
    check(g_mem);
    check(!majesty_install_private_template_bridges(IMAGE_BASE));
    check(!majesty_install_private_template_bridges(HEAP_BASE + 1));
    check(!majesty_install_private_template_bridges(HEAP_LIMIT - 16));
    RecompModule occupied{};
    occupied.base = HEAP_BASE;
    occupied.end = HEAP_BASE + 144;
    published.push_back(&occupied);
    check(!majesty_install_private_template_bridges(HEAP_BASE));
    published.clear();
    check(majesty_install_private_template_bridges(HEAP_BASE));
    check(majesty_install_private_template_bridges(HEAP_BASE));
    check(!majesty_install_private_template_bridges(HEAP_BASE + 160));
    check(published.size() == 1);
    const auto *bridges = published[0];
    check(bridges->func_count == 10 && bridges->base == HEAP_BASE &&
          bridges->end == HEAP_BASE + 160);
    for (unsigned i = 0; i < 9; ++i) {
        check(bridges->func_addrs[i] == majesty_private_template_bridge(i));
        X86 cpu{};
        cpu.r[R_ECX] = 1234;
        cpu.r[R_ESP] = STACK_TOP - 1024;
        bridges->base_ptrs[i](&cpu);
        check(cpu.r[R_EAX] == i + 100 && cpu.r[R_ECX] == 1234 && cpu.r[R_ESP] == STACK_TOP - 1024);
        // Dispatch keys are separately allocated guest addresses; the source
        // entry PC belongs to the private compiled body, never a host pointer.
        check(cpu.eip >= IMAGE_BASE && cpu.eip < 0x00726000);
    }
    X86 refresh{};
    refresh.r[R_ECX] = 1234;
    refresh.r[R_ESP] = STACK_TOP - 1024;
    wr32(refresh.r[R_ESP], GUEST_RETURN_SENTINEL);
    bridges->base_ptrs[9](&refresh);
    check(refresh.r[R_ESP] == STACK_TOP - 1020 && refresh.eip == GUEST_RETURN_SENTINEL);
    check(presenterCalls ==
          std::vector<std::uint32_t>({HEAP_BASE, HEAP_BASE + 32, HEAP_BASE + 64}));
    check(!majesty_private_template_bridge(10));
    std::free(g_mem);
    g_mem = nullptr;
    return 0;
}
