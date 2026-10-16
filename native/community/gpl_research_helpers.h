#pragma once
#include "RuntimeFeatureRegistry.h"
#include "gpl_integer_helpers.h"
#include <algorithm>
#include <cstring>
#include <vector>

namespace MajestyCommunity {
struct ResearchBinding {
    MajestyRuntimeFeatures::KingdomResearchRecord record;
    std::uint32_t nativeFamily = 0;
};

// Source-bound relocation metadata, separate from the creator's unmodified
// feature registry: MJR1, count, then identity[16]/sourceFamily/nativeFamily.
inline bool ParseResearchBindings(const std::uint8_t *data, std::size_t size,
                                  const MajestyRuntimeFeatures::Registry &source,
                                  std::vector<ResearchBinding> &output) {
    if (!data || size < 8 || std::memcmp(data, "MJR1", 4))
        return false;
    const auto word = [&](std::size_t at) {
        return std::uint32_t(data[at]) | std::uint32_t(data[at + 1]) << 8 |
               std::uint32_t(data[at + 2]) << 16 | std::uint32_t(data[at + 3]) << 24;
    };
    const auto count = word(4);
    if (!count || count > 64 || count != source.kingdomResearch.size() || size != 8 + count * 24)
        return false;
    std::vector<ResearchBinding> result;
    for (unsigned i = 0; i < count; ++i) {
        const auto at = 8 + i * 24;
        std::string identity;
        for (unsigned j = 0; j < 16; ++j) {
            identity += "0123456789abcdef"[data[at + j] >> 4];
            identity += "0123456789abcdef"[data[at + j] & 15];
        }
        const auto found =
            std::find_if(source.kingdomResearch.begin(), source.kingdomResearch.end(),
                         [&](const auto &r) { return r.identity == identity; });
        const auto original = word(at + 16), native = word(at + 20);
        if (found == source.kingdomResearch.end() || original != found->buildingFamily || !native ||
            native > 0xffffffU || std::any_of(result.begin(), result.end(), [&](const auto &r) {
                return r.record.identity == identity || r.nativeFamily == native ||
                       r.record.actionControlId == found->actionControlId;
            }))
            return false;
        for (unsigned shift = 0; shift < 24; shift += 8)
            if (((native >> shift) & 255) < 0x21 || ((native >> shift) & 255) > 0x7e)
                return false;
        result.push_back({*found, native});
    }
    output = std::move(result);
    return true;
}

struct ResearchInFlight {
    std::uint32_t unit = 0, command = 0;
};
// A reentrant call-stack guard only. No heap ownership, scheduler or purchase
// persistence lives here; the original saved order and GPL ledger own those.
class ResearchFlight {
    ResearchInFlight &state_;
    ResearchInFlight previous_;

  public:
    ResearchFlight(ResearchInFlight &state, std::uint32_t unit, std::uint32_t command)
        : state_(state), previous_(state) {
        state_ = {unit, command};
    }
    ~ResearchFlight() {
        state_ = previous_;
    }
    ResearchFlight(const ResearchFlight &) = delete;
    ResearchFlight &operator=(const ResearchFlight &) = delete;
};

enum class ResearchQuery { Eligible, Order };

template <class Ops>
bool ExecuteResearchQuery(Ops &ops, const std::vector<ResearchBinding> &bindings,
                          const ResearchInFlight &flight, ResearchQuery helper,
                          std::uint32_t context) {
    NativeIntegerArguments arguments;
    if (!arguments.read(ops, context))
        return false;
    std::uint32_t result = 0;
    const auto agent = arguments.values[1];
    if (agent && ops.read(agent + 4) == 5 && arguments.integers[2]) {
        const auto command = ops.read(arguments.integers[2]);
        const auto record = std::find_if(bindings.begin(), bindings.end(), [&](const auto &r) {
            return command && command <= 0x7fffffffU && r.record.actionControlId == command;
        });
        if (record != bindings.end()) {
            const auto unit = ops.unit(agent);
            if (unit && ops.valid(unit, 0x70)) {
                const auto kind = ops.read(unit + 0x6c);
                if ((kind & 0xffffffU) == record->nativeFamily) {
                    if (helper == ResearchQuery::Eligible) {
                        // Literal Old AP99 level selection: 2/3 explicitly,
                        // every other stock high byte means level1.
                        const auto level = kind >> 24 == '2' ? 2U : kind >> 24 == '3' ? 3U : 1U;
                        result = level >= record->record.requiredLevel &&
                                 ops.attribute(unit, 0x01425041U) == 1 &&
                                 ops.attribute(unit, 0x02425041U) == 1;
                    } else if (flight.unit == unit && flight.command == command) {
                        result = 1;
                    } else if (ops.attribute(unit, 0x2c425041U) == command) {
                        const auto table = ops.read(unit);
                        if (!ops.valid(table + 0x180, 4) || ops.read(table + 0x180) != 0x005b2e10U)
                            return false; // Declared native shape must not silently disable research.
                        result = ops.call(0x005b2e10U, unit, {1, 0x4005}) != 0;
                    }
                }
            }
        }
    }
    ops.write(arguments.integers[0], result);
    return true;
}
} // namespace MajestyCommunity
