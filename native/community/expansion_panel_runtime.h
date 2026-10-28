#pragma once
#include "expansion_panel_owner.h"
#include "private_intent_text.h"
#include "runtime/guest.h"

// Process-lived Old controller adapters. All references outlive world teardown;
// only presentation state lives here. Actors, offers and gold remain native.
extern "C" bool majesty_configure_expansion_panels(const MajestyStockControllers::Registry *,
                                                   const MajestyCommunity::PrivateIntentText *);
extern "C" std::uint32_t majesty_expansion_panel_bridge(unsigned);
extern "C" bool majesty_is_expansion_dialog(std::uint32_t);
extern "C" bool majesty_is_expansion_paid_command(std::uint32_t);
extern "C" std::uint32_t majesty_expansion_action_symbol();
extern "C" std::uint32_t majesty_expansion_panel_for_unit(std::uint32_t, std::uint32_t);
extern "C" std::uint32_t majesty_expansion_capture_prototype();
extern "C" void majesty_reset_expansion_panels(X86 *);
