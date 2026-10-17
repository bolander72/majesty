#pragma once
#include "RuntimeFeatureRegistry.h"
#include <algorithm>
#include <cstdint>
#include <string>
#include <vector>

namespace MajestyCommunity {
struct HeroSubjectBinding {
    std::uint32_t nativeId, sourceId;
};

// Presentation reads immutable manager records. Native lists continue to own
// rows, hover, icons and tooltip copies; no learned node or saved stat changes.
class HeroInfoPolicy {
    const MajestyRuntimeFeatures::Registry &registry_;
    const std::vector<HeroSubjectBinding> &subjects_;

  public:
    HeroInfoPolicy(const MajestyRuntimeFeatures::Registry &registry,
                   const std::vector<HeroSubjectBinding> &subjects)
        : registry_(registry), subjects_(subjects) {}
    bool hidden(std::uint32_t action) const {
        const auto &ids = registry_.hiddenInventoryActions;
        return std::binary_search(ids.begin(), ids.end(), action);
    }
    const MajestyRuntimeFeatures::HeroInfoRecord *spell(std::uint32_t action) const {
        return registry_.FindHeroInfo(1, action);
    }
    const MajestyRuntimeFeatures::HeroInfoRecord *effect(std::uint32_t overlay) const {
        return registry_.FindHeroInfo(2, overlay);
    }
    const std::string *effectLabel(std::uint32_t overlay) const {
        if (const auto *row = effect(overlay))
            return &row->displayText;
        const auto *row = registry_.FindEnchantmentRow(overlay);
        return row ? &row->displayText : nullptr;
    }
    std::vector<const MajestyRuntimeFeatures::HeroInfoRecord *>
    passives(std::uint32_t nativeSubject, std::int32_t level) const {
        std::vector<const MajestyRuntimeFeatures::HeroInfoRecord *> out;
        const auto binding = std::find_if(subjects_.begin(), subjects_.end(), [=](const auto &r) {
            return r.nativeId == nativeSubject;
        });
        // Never infer a stock identity or silently apply a custom class's rows.
        if (binding == subjects_.end() || level < 0)
            return out;
        for (const auto &row : registry_.heroInfoRows)
            if (row.kind == 3 && row.subjectId == binding->sourceId &&
                row.unlockLevel <= static_cast<std::uint32_t>(level))
                out.push_back(&row);
        return out;
    }
};
} // namespace MajestyCommunity
