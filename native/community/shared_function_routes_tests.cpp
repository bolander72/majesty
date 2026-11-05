#include "shared_function_routes.h"
#include <fstream>
#include <iterator>
#include <stdexcept>

namespace {
void check(bool value) {
    if (!value)
        throw std::runtime_error("shared function route contract failed");
}
std::string file(const char *path) {
    std::ifstream stream(path, std::ios::binary);
    check(bool(stream));
    return {(std::istreambuf_iterator<char>(stream)), {}};
}
} // namespace

int main(int argc, char **argv) {
    check(argc == 4);
    std::map<std::string, std::string> routes;
    check(MajestyCommunity::ParseSharedFunctionRoutes(file(argv[1]), routes));
    check(routes.size() == 130 && routes.at("give_exp") == "MJC_give_exp");
    check(MajestyCommunity::ParseSharedFunctionRoutes(file(argv[2]), routes));
    check(routes.size() == 107 && routes.at("give_exp") == "MJC_give_exp");
    // Actual currently deployed Alchemist file retains its original format.
    check(MajestyCommunity::ParseSharedFunctionRoutes(file(argv[3]), routes));
    check(!routes.empty());
    for (const auto &entry : routes)
        check(entry.second.substr(0, 4) == "MJA_");
    const auto legacy = routes;
    for (const auto &bad :
         {"majesty-community-shared-gpl-v2\n", "majesty-community-shared-gpl-v3\nheal\tMJC_heal\n",
          "majesty-community-shared-gpl-v2\nheal\tMJA_heal\n",
          "majesty-alchemist-shared-gpl-v1\nheal\tMJC_heal\n",
          "majesty-community-shared-gpl-v2\nheal\tMJC_heal\nHEAL\tMJC_HEAL\n",
          "majesty-community-shared-gpl-v2\nheal\tMJC_heal\textra\n",
          "majesty-community-shared-gpl-v2\nheal;\tMJC_heal;\n"}) {
        check(!MajestyCommunity::ParseSharedFunctionRoutes(bad, routes));
        check(routes == legacy); // Refused files cannot partially publish routes.
    }
    std::string rows;
    for (unsigned i = 0; i < 257; ++i) {
        if (i == 128) {
            check(MajestyCommunity::ParseSharedFunctionRoutes(
                "majesty-alchemist-shared-gpl-v1\n" + rows, routes));
        }
        const auto name = "F" + std::to_string(i);
        rows += name + "\tMJA_" + name + "\n";
        if (i == 128)
            check(!MajestyCommunity::ParseSharedFunctionRoutes(
                "majesty-alchemist-shared-gpl-v1\n" + rows, routes));
    }
    for (std::size_t pos = 0; (pos = rows.find("MJA_", pos)) != std::string::npos; pos += 4)
        rows.replace(pos, 4, "MJC_");
    check(!MajestyCommunity::ParseSharedFunctionRoutes("majesty-community-shared-gpl-v2\n" + rows,
                                                       routes));
    rows.erase(rows.find("F256\t"));
    check(MajestyCommunity::ParseSharedFunctionRoutes("majesty-community-shared-gpl-v2\n" + rows,
                                                      routes));
    check(routes.size() == 256);
    check(!MajestyCommunity::ParseSharedFunctionRoutes(std::string(65537, 'x'), routes));
    auto nul = "majesty-community-shared-gpl-v2\n" + rows;
    nul.push_back('\0');
    check(!MajestyCommunity::ParseSharedFunctionRoutes(nul, routes));
    return 0;
}
