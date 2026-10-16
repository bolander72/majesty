#pragma once
#include "gpl_research_helpers.h"
#include "recruitment_panel_runtime.h"

// Configure before opening any private panel. All referenced registry/binding
// storage must have process lifetime. Returns concrete original-engine services.
extern "C" const MajestyCommunity::RecruitmentPanelServices *
majesty_configure_guild_gameplay(const MajestyStockControllers::Registry *,
                                 const std::vector<MajestyCommunity::ResearchBinding> *,
                                 MajestyCommunity::ResearchInFlight *);
// UI caches only; call before original world disposal. No saved gameplay lives here.
extern "C" void majesty_reset_guild_gameplay();

// Registered import gateways for the process-lived core plugin: factory RET16,
// original research execution RET8, completion cdecl, and pre-disposal reset.
// An unloadable module never exposes these entries.
extern "C" std::uint32_t majesty_guild_process_bridge(unsigned);
