#pragma once
#include "runtime/x86.h"
#include <cstdint>

// The separately translated native order is collected, never registered at
// original PE addresses. A process-lived import gateway owns its callback.
extern "C" void majesty_collect_private_movement(const RecompModule *);
extern "C" std::uint32_t majesty_community_movement_bridge();
