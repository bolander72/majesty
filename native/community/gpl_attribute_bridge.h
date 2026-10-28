#pragma once
#include <array>
#include <cstdint>
#include <initializer_list>
#include <string>

namespace MajestyCommunity {
// Native external calls carry references to GPL values. Entry zero is their
// result slot; actual arguments begin at one. Check the real begin/end span
// before reading an optional initializer (the three-argument form has none).
struct NativeAttributeArguments {
    std::array<std::uint32_t, 5> values{};
    unsigned count = 0;
    template <class Ops> bool read(Ops &ops, std::uint32_t context) {
        if (!ops.valid(context, 12))
            return false;
        const auto begin = ops.read(context + 4), end = ops.read(context + 8);
        if (!begin || end < begin || (end - begin != 16 && end - begin != 20) ||
            !ops.valid(begin, end - begin))
            return false;
        count = (end - begin) / 4;
        for (unsigned i = 0; i < count; ++i) {
            const auto ref = ops.read(begin + i * 4);
            if (!ops.valid(ref, 4))
                return false;
            values[i] = ops.read(ref);
            if (!ops.valid(values[i], 8))
                return false;
        }
        // Agent, attribute name and type name, using the pinned Old VM tags.
        return ops.read(values[1] + 4) == 5 && ops.read(values[2] + 4) == 3 &&
               ops.read(values[3] + 4) == 3;
    }
};

enum class AttributeInstall { Added, AlreadyExists, Invalid, AllocationFailed, InsertionFailed };
struct AttributeEvidence {
    std::uint32_t agent = 0, value = 0, type = 0;
    unsigned arguments = 0;
};

// Includes conditional agent-reference attributes used by Bards support,
// hiring and prepared spell-origin tracking, as well as scalar/list state.
// String attributes use the original CStr value and its virtual copy/reset;
// they never retain the caller's temporary string or a host pointer.
// No missing-symbol type10 or invented list representation reaches the pool.
inline std::uint32_t AuthoredAttributeType(const std::string &name) {
    if (name == "integer")
        return 1;
    if (name == "string")
        return 3;
    if (name == "list")
        return 4;
    if (name == "agentref")
        return 5;
    if (name == "boolean")
        return 6;
    if (name == "coord")
        return 7;
    return name == "function" ? 8 : 0;
}

template <class Ops>
AttributeInstall InstallAuthoredAttribute(Ops &ops, std::uint32_t context,
                                          AttributeEvidence *evidence = nullptr) {
    if (evidence)
        *evidence = {};
    NativeAttributeArguments arguments;
    if (!arguments.read(ops, context))
        return AttributeInstall::Invalid;
    const auto agentValue = ops.reference(arguments.values[1], 0x5c);
    const auto agent = ops.call(0x006255e0U, agentValue, {});
    const auto name = ops.reference(arguments.values[2], 0x30);
    std::uint32_t type = 0;
    {
        const auto typeName = ops.text(ops.reference(arguments.values[3], 0x30));
        type = AuthoredAttributeType(typeName);
    }
    const auto input = arguments.count == 5 ? arguments.values[4] : 0;
    if (!agent || !type || (input && ops.read(input + 4) != type))
        return AttributeInstall::Invalid;
    if (ops.call(0x00626440U, agent, {name}) & 0xff)
        return AttributeInstall::AlreadyExists;
    const auto runtime = ops.read(ops.read(0x007218b4U) + 0x10), pool = ops.read(runtime + 0x1c);
    std::array<std::uint32_t, 9> growth;
    for (unsigned i = 0; i < growth.size(); ++i)
        growth[i] = ops.read(pool + 0xa4 + i * 4);
    const auto copy = ops.call(0x0062a810U, pool, {type});
    if (!copy)
        return AttributeInstall::AllocationFailed;
    if (ops.read(copy + 4) != type)
        return AttributeInstall::Invalid;
    if (input) {
        // Original virtual assignment owns deep list/function copies. Never
        // alias an argument value into the agent's saved attribute map.
        ops.call(ops.read(ops.read(copy) + 0x18), copy, {input});
    } else {
        // The native pool's virtual Reset also clears recycled list contents
        // and releases their elements through the original value pool. The
        // list sentinel remains native-owned, including save/load traversal.
        ops.call(ops.read(ops.read(copy) + 0x10), copy, {});
    }
    if (!(ops.call(0x006261c0U, agent, {name, copy}) & 0xff)) {
        ops.call(0x0062aa20U, pool, {copy});
        return AttributeInstall::InsertionFailed;
    }
    if (ops.call(0x006263d0U, agent, {name}) != copy)
        return AttributeInstall::Invalid;
    for (unsigned i = 0; i < growth.size(); ++i)
        if (ops.read(pool + 0xa4 + i * 4) != growth[i])
            return AttributeInstall::Invalid;
    if (evidence)
        *evidence = {agent, copy, type, arguments.count - 1};
    return AttributeInstall::Added;
}
} // namespace MajestyCommunity
