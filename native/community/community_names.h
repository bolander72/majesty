#pragma once
#include "RuntimeFeatureRegistry.h"
#include <cstring>
#include <set>
#include <utility>

namespace MajestyCommunity {
// The acquired Phantom uses stock NM11's four-part recipe, replacing only
// HN41/HN42. The native collection moves those two tables and the generator;
// stock NM11 and its original fragments must remain owned by the stock game.
inline bool CommunityNameRecords(const MajestyRuntimeFeatures::Registry &source,
                                 const unsigned char *bytes, std::size_t size,
                                 std::vector<MajestyRuntimeFeatures::NameGeneratorRecord> &out) {
    if (!bytes || size != 36 || std::memcmp(bytes, "MNB1", 4))
        return false;
    const auto word = [&](unsigned at) {
        return std::uint32_t(bytes[at]) | (std::uint32_t(bytes[at + 1]) << 8) |
               (std::uint32_t(bytes[at + 2]) << 16) | (std::uint32_t(bytes[at + 3]) << 24);
    };
    if (word(4) != 1 || word(8) != 1 || word(12) != 0x31314d4eU || word(16) != 0x48504d4eU ||
        word(20) != 0x30504e48U || word(24) != 0x31504e48U || word(28) != 0x33344e48U ||
        word(32) != 0x34344e48U)
        return false;
    const std::set<std::uint32_t> expected{0x38314d4eU, 0x44424d4eU, 0x53424d4eU, 0x54424d4eU};
    std::set<std::uint32_t> ids;
    for (const auto &record : source.nameGenerators)
        if (!expected.count(record.generatorId) || !ids.insert(record.generatorId).second)
            return false;
    if (ids != expected)
        return false;
    auto result = source.nameGenerators;
    MajestyRuntimeFeatures::NameGeneratorRecord phantom{};
    phantom.generatorId = word(16);
    for (unsigned i = 0; i < 4; ++i)
        phantom.namePartIds[i] = word(20 + i * 4);
    result.push_back(phantom);
    out = std::move(result);
    return true;
}
} // namespace MajestyCommunity
