#include "hero_ui_runtime.h"
#include "hero_info_policy.h"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <initializer_list>
#include <memory>
#include <set>

namespace {
const PopModApi *api = nullptr;
const MajestyRuntimeFeatures::Registry *features = nullptr;
std::vector<MajestyCommunity::HeroSubjectBinding> subjects;
std::unique_ptr<MajestyCommunity::HeroInfoPolicy> policy;
std::vector<std::uint32_t> hookIds;
struct Context {
    unsigned kind;
    std::uint32_t unit, list;
    const MajestyRuntimeFeatures::HeroInfoRecord *row = nullptr;
    const std::string *label = nullptr;
    std::int32_t index = -1;
};
Context *context = nullptr;
void require(bool ok, const char *why) {
    if (!ok) {
        std::fprintf(stderr, "[community-hero-ui] refused: %s\n", why);
        std::abort();
    }
}
std::uint32_t read(std::uint32_t at) {
    std::uint32_t value = 0;
    require(api->guest_read_u32(api, at, &value) == POP_OK, "native UI read");
    return value;
}
void write(std::uint32_t at, std::uint32_t value) {
    require(api->guest_write_u32(api, at, value) == POP_OK, "native UI write");
}
std::uint32_t call(std::uint32_t target, std::uint32_t self,
                   std::initializer_list<std::uint32_t> args = {}) {
    std::uint32_t value = 0;
    require(api->guest_call(api, target, self, args.begin(),
                            static_cast<std::uint32_t>(args.size()), &value) == POP_OK,
            "native UI call");
    return value;
}
void next(PopHookInvocation *inv, pop_cpu_v1 *cpu) {
    require(api->call_next(api, inv, cpu) == POP_OK, "native UI continuation");
}
// Native append and tooltip messages copy this original string object
// synchronously. The owned temporary is destroyed only after those copies.
struct String {
    std::uint32_t memory = 0;
    explicit String(const std::string &text) {
        require(text.size() <= 512 && api->guest_alloc(api, 1024, &memory) == POP_OK,
                "bounded native UI text");
        for (unsigned i = 0; i <= text.size(); ++i)
            require(api->guest_write_u8(api, memory + 64 + i, text.c_str()[i]) == POP_OK,
                    "native UI text bytes");
        call(0x004e3520U, memory, {memory + 64});
    }
    ~String() {
        call(0x004e3820U, memory);
        require(api->guest_free(api, memory) == POP_OK, "native UI text release");
    }
};
void message(std::uint32_t list, std::uint32_t code, std::uint32_t index, std::uint32_t data) {
    call(read(read(list) + 0x9c), list, {code, index, data});
}
void tooltip(const MajestyRuntimeFeatures::HeroInfoRecord *row, std::int32_t index) {
    if (!row || index < 0)
        return;
    String text(row->tooltipText);
    message(context->list, 0x62, static_cast<std::uint32_t>(index), text.memory);
}
void passives() {
    const auto rows = policy->passives(
        read(context->unit + 0x6c),
        static_cast<std::int32_t>(call(0x005a1c40U, context->unit, {0x0b565041U, 0})));
    for (const auto *row : rows) {
        String text(row->displayText);
        const auto index =
            static_cast<std::int32_t>(call(0x00519fe0U, context->list, {0xffffffffU, text.memory}));
        if (index < 0)
            continue;
        std::uint32_t image = 0;
        require(api->guest_alloc(api, 256, &image) == POP_OK, "native passive image storage");
        call(0x00511b30U, image);
        call(0x00511c40U, image, {1});
        call(0x00511c90U, image, {row->imageId});
        call(0x00511ce0U, image, {row->imageSet});
        call(0x00511d00U, image, {0});
        write(image + 0x1c, 0);
        call(0x005125b0U, image, {9});
        message(context->list, 0x24, static_cast<std::uint32_t>(index), image);
        call(0x00511c10U, image);
        require(api->guest_free(api, image) == POP_OK, "native passive image release");
        tooltip(row, index);
    }
}
void hook(const PopModApi *, pop_cpu_v1 *cpu, PopHookInvocation *inv, void *) {
    const auto target = cpu->target, ret = read(cpu->esp);
    if (target == 0x00470c00U || target == 0x00471030U) {
        const unsigned kind = target == 0x00470c00U ? 0 : 1;
        const auto unit = call(0x00481ec0U, cpu->ecx);
        const auto root = read(read(cpu->ecx + 0x14) + 4);
        Context current{kind, unit, call(0x004df260U, root, {kind ? 0x221bU : 0x221aU})};
        require(current.unit && current.list, "original selected hero and native list");
        // Stack-linked contexts retain the outer row through nested refreshes.
        // Guest calls return through the official API; failure aborts above.
        auto *prior = context;
        context = &current;
        const auto result = call(majesty_community_hero_ui_bridge(kind), cpu->ecx);
        context = prior;
        require(api->hook_return(api, cpu, result, 0) == POP_OK, "original AP78 RET0");
        return;
    }
    if (!context) {
        next(inv, cpu);
        return;
    }
    if (target == 0x005b7360U && ret == 0x00470cb1U) {
        unsigned char enabled = 0;
        require(api->guest_read_u8(api, cpu->eax + 0x10, &enabled) == POP_OK,
                "borrowed learned-node flag");
        if (policy->hidden(read(cpu->eax + 4)))
            enabled = 0;
        cpu->ecx = (cpu->ecx & 0xffffff00U) | enabled;
        require(api->hook_return(api, cpu, cpu->eax, 0) == POP_OK, "read-only learned-node gate");
        return;
    }
    if (target == 0x005b7360U && ret == 0x00470feeU) {
        passives();
        cpu->ecx = read(cpu->esi + 0x14);
        require(api->hook_return(api, cpu, cpu->eax, 0) == POP_OK,
                "original passive layout continuation");
        return;
    }
    if (target == 0x005b7360U && ret == 0x00471115U) {
        const auto overlay = read(cpu->ecx + 4);
        context->row = policy->effect(overlay);
        context->label = policy->effectLabel(overlay);
        cpu->eax = context->label ? 0x31305258U : overlay;
        require(api->hook_return(api, cpu, cpu->eax, 0) == POP_OK,
                "original enchantment switch load");
        return;
    }
    if (target == 0x00519fe0U && ret == 0x00470f49U) {
        context->row = policy->spell(read(cpu->edi + 4));
        if (context->row) {
            String text(context->row->displayText);
            write(cpu->esp + 8, text.memory);
            next(inv, cpu);
        } else {
            next(inv, cpu);
        }
        context->index = static_cast<std::int32_t>(cpu->eax);
        return;
    }
    if (target == 0x004e4180U && ret == 0x0047119eU && context->label) {
        String text(*context->label);
        write(cpu->esp + 4, text.memory);
        next(inv, cpu);
        return;
    }
    if (target == 0x00511ce0U && (ret == 0x00470f82U || ret == 0x004717ecU) && context->row) {
        call(0x00511c90U, cpu->ecx, {context->row->imageId});
        write(cpu->esp + 4, context->row->imageSet);
        next(inv, cpu);
        return;
    }
    if (target == 0x00511c10U && (ret == 0x00470fc7U || ret == 0x0047182dU)) {
        tooltip(context->row, context->kind ? static_cast<std::int32_t>(cpu->ebp) : context->index);
        context->row = nullptr;
        next(inv, cpu);
        return;
    }
    next(inv, cpu);
}
} // namespace

extern "C" bool majesty_configure_hero_ui(const PopModApi *host,
                                          const MajestyRuntimeFeatures::Registry *registry,
                                          const unsigned char *bytes, std::size_t size) {
    if (api || !host || !registry || !bytes || size < 12 || std::memcmp(bytes, "MHB1", 4))
        return false;
    const auto word = [&](unsigned at) {
        return std::uint32_t(bytes[at]) | (std::uint32_t(bytes[at + 1]) << 8) |
               (std::uint32_t(bytes[at + 2]) << 16) | (std::uint32_t(bytes[at + 3]) << 24);
    };
    const auto count = word(8);
    if (word(4) != 1 || !count || count > 64 || size != 12 + count * 8 ||
        !majesty_community_hero_ui_bridge(0) || !majesty_community_hero_ui_bridge(1))
        return false;
    std::set<std::uint32_t> nativeIds, sourceIds;
    std::vector<MajestyCommunity::HeroSubjectBinding> parsed;
    for (unsigned i = 0; i < count; ++i) {
        const auto native = word(12 + i * 8), source = word(16 + i * 8);
        if (!nativeIds.insert(native).second || !sourceIds.insert(source).second)
            return false;
        parsed.push_back({native, source});
    }
    for (const auto &row : registry->heroInfoRows)
        if (row.kind == 3 && !sourceIds.count(row.subjectId))
            return false;
    api = host;
    features = registry;
    subjects = std::move(parsed);
    policy = std::make_unique<MajestyCommunity::HeroInfoPolicy>(*features, subjects);
    for (const auto target : {0x00470c00U, 0x00471030U, 0x005b7360U, 0x00519fe0U, 0x004e4180U,
                              0x00511ce0U, 0x00511c10U}) {
        std::uint32_t id = 0;
        if (api->hook_install_ex(api, target, 0, hook, POP_HOOK_WRAP, POP_HOOK_NO_GAME_VIEW,
                                 nullptr, &id) != POP_OK) {
            majesty_shutdown_hero_ui();
            return false;
        }
        hookIds.push_back(id);
    }
    return true;
}
extern "C" void majesty_shutdown_hero_ui() {
    if (api)
        for (auto it = hookIds.rbegin(); it != hookIds.rend(); ++it)
            api->hook_remove(api, *it);
    hookIds.clear();
    subjects.clear();
    policy.reset();
    features = nullptr;
    api = nullptr;
}
