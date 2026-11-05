#include "guild_gameplay_services.h"
#include "community_names.h"
#include <cassert>
#include <map>
#include <stdexcept>
#include <tuple>

struct Ops {
    std::uint32_t kind = 0x33744241, state = 0, hiring = 0, clock = 800;
    std::map<std::uint32_t, std::uint32_t> attributes{{0x01425041, 1}, {0x02425041, 1}};
    std::map<std::uint32_t, bool> visibility;
    unsigned scalarCalls = 0, submissions = 0, preparations = 0, progressCalls = 0, mirrors = 0;
    bool affordableValue = true;
    std::vector<std::tuple<std::uint32_t, std::uint32_t, std::uint32_t, std::uint32_t>> messages;
    bool valid(std::uint32_t address, std::uint32_t bytes) {
        return address == 0x7000 && bytes == 0x70;
    }
    std::uint32_t read(std::uint32_t address) {
        assert(address == 0x706c);
        return kind;
    }
    std::uint32_t attribute(std::uint32_t unit, std::uint32_t id) {
        assert(unit == 0x7000);
        return attributes[id];
    }
    std::uint32_t now() {
        return clock;
    }
    void require(bool value, const char *) {
        if (!value)
            throw std::runtime_error("service contract");
    }
    std::uint32_t scalar(const std::string &name, std::uint32_t unit, std::int32_t operation) {
        assert(unit == 0x7000);
        ++scalarCalls;
        if (name == "MM_Toggle_Hiring") {
            if (operation != -1)
                hiring = operation;
            return hiring;
        }
        assert(name == "MM_KR_00112233445566778899aabbccddeeff" && operation == 0);
        return state;
    }
    void prepareResearch() {
        ++preparations;
    }
    bool affordable(std::uint32_t controller, std::uint32_t command) {
        assert(controller == 0x1000 && command == 29472);
        return affordableValue;
    }
    void submit(std::uint32_t unit, std::uint32_t command) {
        assert(unit == 0x7000 && command == 29472);
        ++submissions;
    }
    void visible(const MajestyCommunity::RecruitmentPanelSession &, std::uint32_t id, bool shown) {
        visibility[id] = shown;
    }
    void message(const MajestyCommunity::RecruitmentPanelSession &, std::uint32_t id,
                 std::uint32_t code, std::uint32_t first, std::uint32_t second) {
        messages.emplace_back(id, code, first, second);
    }
    void rawAttribute(std::uint32_t unit, std::uint32_t id, std::uint32_t value) {
        assert(unit == 0x7000 && id == 0xda878b2c);
        ++mirrors;
        attributes[id] = value;
    }
    void refreshResearch(const MajestyCommunity::RecruitmentPanelSession &, std::uint32_t id) {
        assert(id == 29472);
    }
    void progress(const MajestyCommunity::RecruitmentPanelSession &, std::uint32_t id,
                  std::uint32_t elapsed, std::uint32_t duration) {
        assert(id == 29473 && elapsed == 300 && duration == 10000);
        ++progressCalls;
    }
};
int main() {
    using namespace MajestyCommunity;
    MajestyRuntimeFeatures::Registry sourceNames;
    for (const auto id : {0x38314d4eU, 0x44424d4eU, 0x53424d4eU, 0x54424d4eU})
        sourceNames.nameGenerators.push_back({id, {1, 2, 3, 4}});
    const unsigned char alias[] = "MNB1\1\0\0\0\1\0\0\0NM11NMPHHNP0HNP1HN43HN44";
    std::vector<MajestyRuntimeFeatures::NameGeneratorRecord> names;
    assert(CommunityNameRecords(sourceNames, alias, sizeof(alias) - 1, names));
    assert(names.size() == 5 && names.back().generatorId == 0x48504d4eU &&
           names.back().namePartIds[0] == 0x30504e48U &&
           names.back().namePartIds[2] == 0x33344e48U);
    for (unsigned n = 0; n < 36; ++n) {
        assert(!CommunityNameRecords(sourceNames, alias, n, names));
        assert(names.size() == 5); // Invalid input never leaves partial registration records.
    }
    auto invalid = std::vector<unsigned char>(alias, alias + 36);
    invalid[16] = 'X';
    assert(!CommunityNameRecords(sourceNames, invalid.data(), invalid.size(), names));
    invalid.assign(alias, alias + 36);
    invalid[32] = 'X';
    assert(!CommunityNameRecords(sourceNames, invalid.data(), invalid.size(), names));
    sourceNames.nameGenerators.pop_back();
    assert(!CommunityNameRecords(sourceNames, alias, 36, names));
    sourceNames.nameGenerators.push_back(sourceNames.nameGenerators.front());
    assert(!CommunityNameRecords(sourceNames, alias, 36, names));
    MajestyStockControllers::Registry recipes;
    MajestyStockControllers::PrivateRecruitmentRecord recipe{};
    recipe.parentDialogId = 100;
    recipe.childDialogId = 101;
    recipes.privateRecruitments.push_back(recipe);
    MajestyStockControllers::BuildingOpenToggleRecord toggle{};
    toggle.toggleKey = "Hiring";
    toggle.parentDialogId = 100;
    toggle.panelDialogId = 101;
    toggle.openCommandId = 29504;
    toggle.closeCommandId = 29505;
    toggle.stateAttribute = "Hiring";
    toggle.stateAccessorSymbol = "MM_Toggle_Hiring";
    recipes.buildingOpenToggles.push_back(toggle);
    MajestyRuntimeFeatures::KingdomResearchRecord record{};
    record.identity = "00112233445566778899aabbccddeeff";
    record.actionControlId = 29472;
    record.requiredLevel = 3;
    record.completionAttribute = 0xda878b2c;
    record.progressControlId = 29473;
    record.activeDisplayControlId = 29474;
    std::vector<ResearchBinding> bindings{{record, 0x744241}};
    GuildGameplayServices services(recipes, bindings);
    RecruitmentPanelSession s;
    s.recipe = &recipes.privateRecruitments.front();
    s.unit = 0x7000;
    s.identity = 7;
    s.controller = 0x1000;
    s.window = 0x2000;
    s.dialog = 100;
    s.generation = 1;
    Ops ops;
    assert(!services.busy(ops, s.unit));
    assert(!services.command(ops, s, 29471));
    assert(services.command(ops, s, 29472) && ops.submissions == 1);
    ops.affordableValue = false;
    assert(services.command(ops, s, 29472) && ops.submissions == 1);
    ops.affordableValue = true;
    ops.state = 1;
    assert(services.command(ops, s, 29472) && ops.submissions == 1);
    ops.state = 0;
    ops.attributes[0x0d425041] = 10000;
    assert(services.command(ops, s, 29472) && ops.submissions == 1);
    ops.attributes[0x2c425041] = 29472;
    assert(services.busy(ops, s.unit));
    ops.kind = 0x33754241;
    assert(!services.busy(ops, s.unit) && !services.command(ops, s, 29472));
    ops.kind = 0x33744241;
    ops.attributes[0x38425041] = 500;
    services.extras(ops, s);
    assert(ops.progressCalls == 1 && !ops.visibility[29472] && ops.visibility[29473]);
    assert(ops.visibility[29474] && !ops.visibility[30472]);
    ops.attributes[0x2c425041] = 0;
    ops.attributes[0x0d425041] = 0;
    ops.state = 1;
    services.extras(ops, s);
    assert(ops.visibility[29472] && !ops.visibility[29473] && !ops.visibility[30472]);
    assert(ops.attributes[0xda878b2c] == 1);
    s.child = true;
    s.dialog = 101;
    assert(!services.command(ops, s, 29472));
    const auto mirrors = ops.mirrors, calls = ops.scalarCalls;
    services.extras(ops, s);
    assert(ops.scalarCalls == calls + 1 && ops.mirrors == mirrors);
    assert(ops.visibility[29504] && !ops.visibility[29505]);
    services.extras(ops, s);
    assert(ops.scalarCalls == calls + 1); // Same-context cached query.
    services.toggle(ops, s, 29504);
    assert(ops.hiring == 1 && !ops.visibility[29504] && ops.visibility[29505]);
    services.toggle(ops, s, 29505);
    assert(!ops.hiring && ops.visibility[29504] && !ops.visibility[29505]);
    const auto before = ops.scalarCalls;
    ++s.generation;
    services.extras(ops, s);
    assert(ops.scalarCalls == before + 1);
    services.reset();
    services.extras(ops, s);
    assert(ops.scalarCalls == before + 2);
    for (const auto &message : ops.messages)
        assert(std::get<1>(message) != 0x16);
}
