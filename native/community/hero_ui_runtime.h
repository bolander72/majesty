#pragma once
#include "RuntimeFeatureRegistry.h"
#include "pop_mod_api.h"
#include "runtime/x86.h"
#include <cstdint>

extern "C" void majesty_collect_private_hero_ui(const RecompModule *);
extern "C" std::uint32_t majesty_community_hero_ui_bridge(unsigned kind);
extern "C" bool majesty_configure_hero_ui(const PopModApi *,
                                          const MajestyRuntimeFeatures::Registry *,
                                          const unsigned char *, std::size_t,
                                          const MajestyRuntimeFeatures::Registry * = nullptr);
extern "C" void majesty_shutdown_hero_ui();
