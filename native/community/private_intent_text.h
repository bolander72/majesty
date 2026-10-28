#pragma once
#include "IntentTextRegistry.h"
#include <algorithm>
#include <cstdint>
#include <limits>
#include <utility>

namespace MajestyCommunity {
// Old's STRT accessor returns a borrowed 12-byte TString view, not a C string.
// Its data pointer is +0, capacity/encoding flags +4, and character length +8.
// Native copies retain their own allocation. No native destructor owns these
// read-only registry views; release the single backing block only at mod exit.
class PrivateIntentText {
    std::vector<MajestyIntentText::RegistryRecord> records_;
    std::vector<std::uint32_t> views_;
    std::uint32_t backing_ = 0;
    bool initialized_ = false;
    std::size_t index(std::uint32_t id) const {
        const auto found =
            std::lower_bound(records_.begin(), records_.end(), id,
                             [](const auto &row, std::uint32_t value) { return row.id < value; });
        return found != records_.end() && found->id == id
                   ? static_cast<std::size_t>(found - records_.begin())
                   : records_.size();
    }

  public:
    template <class Ops>
    bool initialize(Ops &ops, const unsigned char *bytes, std::size_t size, std::string &error) {
        if (initialized_)
            return false;
        std::vector<MajestyIntentText::RegistryRecord> parsed;
        if (!MajestyIntentText::ParseRegistry(bytes, size, &parsed, &error))
            return false;
        std::uint64_t total = 0;
        for (const auto &row : parsed)
            total += (12U + row.text.size() + 1U + 3U) & ~std::uint64_t(3U);
        if (total > std::numeric_limits<std::uint32_t>::max())
            return false;
        const auto memory = total ? ops.allocate(static_cast<std::uint32_t>(total)) : 0;
        if (total && (!memory || memory > std::numeric_limits<std::uint32_t>::max() - total ||
                      !ops.valid(memory, static_cast<std::uint32_t>(total)))) {
            if (memory)
                ops.release(memory);
            return false;
        }
        std::vector<std::uint32_t> views;
        std::uint32_t at = memory;
        for (const auto &row : parsed) {
            views.push_back(at);
            ops.write(at, at + 12);
            ops.write(at + 4, 0); // Borrowed Windows-1252, no native allocation ownership.
            ops.write(at + 8, static_cast<std::uint32_t>(row.text.size()));
            for (unsigned i = 0; i <= row.text.size(); ++i)
                ops.writeByte(at + 12 + i, static_cast<unsigned char>(row.text.c_str()[i]));
            at += static_cast<std::uint32_t>((12U + row.text.size() + 4U) & ~std::size_t(3U));
        }
        records_ = std::move(parsed);
        views_ = std::move(views);
        backing_ = memory;
        initialized_ = true;
        return true;
    }
    const auto &records() const {
        return records_;
    }
    const std::string *text(std::uint32_t id) const {
        const auto position = index(id);
        return position < records_.size() ? &records_[position].text : nullptr;
    }
    std::uint32_t view(std::uint32_t id) const {
        const auto position = index(id);
        return position < views_.size() ? views_[position] : 0;
    }
    template <class Ops>
    std::uint32_t lookup(Ops &ops, std::uint32_t table, std::uint32_t resourceId,
                         std::uint32_t id) const {
        const auto result = view(id);
        if (!result)
            return 0;
        // 004f2040 has two native forms: (table pointer, language, row) and
        // (resource group, table ID, row). Group zero names the active resources.
        // A FourCC in the first slot is not a table pointer.
        if (!table && resourceId == 0x58544941U)
            return result;
        if (!table || !ops.valid(0x007218b4U, 4))
            return 0;
        const auto root = ops.read(0x007218b4U);
        if (!ops.valid(root, 0x14))
            return 0;
        const auto runtime = ops.read(root + 0x10);
        return ops.valid(runtime, 0x2c) && ops.read(runtime + 0x28) == table ? result : 0;
    }
    template <class Ops> void clear(Ops &ops) {
        if (backing_)
            ops.release(backing_);
        backing_ = 0;
        records_.clear();
        views_.clear();
        initialized_ = false;
    }
};
} // namespace MajestyCommunity
