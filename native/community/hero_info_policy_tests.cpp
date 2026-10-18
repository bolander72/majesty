#include "hero_info_policy.h"
#include <cassert>

int main() {
    MajestyRuntimeFeatures::Registry registry;
    registry.hiddenInventoryActions = {10, 20};
    registry.heroInfoRows = {
        {1, 100, 0, 1, 1019, "song", "Marching Song", "Quickens allies."},
        {2, 200, 0, 2, 1019, "effect", "Heroic Refrain", "Rallies allies."},
        {3, 300, 1, 3, 1019, "training", "Duelist Training", "Native passive."},
        {3, 300, 5, 4, 1019, "deflect", "Deflect", "Native missile defense."},
    };
    registry.enchantmentRows = {{200, "Legacy fallback"}, {201, "Legacy only"}};
    const std::vector<MajestyCommunity::HeroSubjectBinding> aliases{{400, 300}};
    const MajestyCommunity::HeroInfoPolicy policy(registry, aliases);
    assert(policy.hidden(10) && policy.hidden(20));
    assert(!policy.hidden(0) && !policy.hidden(11));
    assert(policy.spell(100) && policy.spell(100)->imageSet == 1019);
    assert(!policy.spell(200));
    assert(*policy.effectLabel(200) == "Heroic Refrain");
    assert(*policy.effectLabel(201) == "Legacy only");
    assert(!policy.effectLabel(202));
    assert(policy.passives(400, 0).empty());
    assert(policy.passives(400, 1).size() == 1);
    assert(policy.passives(400, 4).size() == 1);
    assert(policy.passives(400, 5).size() == 2);
    assert(policy.passives(400, -1).empty());
    assert(policy.passives(300, 1000).empty()); // Unbound stock identity stays stock.
    assert(policy.passives(401, 1000).empty());
    assert(registry.hiddenInventoryActions == std::vector<std::uint32_t>({10, 20}));
    MajestyRuntimeFeatures::Registry compatibility;
    compatibility.heroInfoRows = {
        {1, 100, 0, 9, 1019, "shadow", "Must not override", "Unchanged creator row."},
        {1, 101, 0, 8, 1019, "ice-lance", "Ice Lance", "Chills a living target."},
        {2, 202, 0, 7, 1019, "chill", "Chilled", "Movement is slowed."},
    };
    const MajestyCommunity::HeroInfoPolicy supplemented(registry, aliases, &compatibility);
    assert(supplemented.spell(100) == policy.spell(100));
    assert(supplemented.spell(101)->displayText == "Ice Lance");
    assert(!supplemented.spell(102));
    assert(*supplemented.effectLabel(202) == "Chilled");
    assert(supplemented.passives(400, 5) == policy.passives(400, 5));
}
