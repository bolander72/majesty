#pragma once
#include <map>
#include <sstream>
#include <string>

namespace MajestyCommunity {
// Lookup redirection happens before the VM creates a call frame. The newer
// three-guild library needs more than the old Alchemist-only 128 routes; keep
// that old format's bound and prefix intact rather than changing its meaning.
inline bool ParseSharedFunctionRoutes(const std::string &raw,
                                      std::map<std::string, std::string> &result) {
    if (raw.size() > 65536 || raw.find('\0') != std::string::npos)
        return false;
    std::istringstream input(raw);
    std::string line, prefix;
    if (!std::getline(input, line))
        return false;
    const bool legacy = line == "majesty-alchemist-shared-gpl-v1";
    if (!legacy && line != "majesty-community-shared-gpl-v2")
        return false;
    if (legacy && raw.size() > 32768)
        return false;
    prefix = legacy ? "MJA_" : "MJC_";
    std::map<std::string, std::string> parsed;
    while (std::getline(input, line)) {
        const auto tab = line.find('\t');
        if (tab == std::string::npos || tab == 0 || tab > 100)
            return false;
        auto name = line.substr(0, tab);
        const auto alias = line.substr(tab + 1);
        if (alias != prefix + name || alias.size() >= 128 ||
            name.find_first_not_of(
                "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_0123456789") !=
                std::string::npos)
            return false;
        for (auto &c : name)
            if (c >= 'A' && c <= 'Z')
                c = static_cast<char>(c + ('a' - 'A'));
        if (!parsed.emplace(name, alias).second || parsed.size() > (legacy ? 128U : 256U))
            return false;
    }
    if (parsed.empty())
        return false;
    result = std::move(parsed);
    return true;
}
} // namespace MajestyCommunity
