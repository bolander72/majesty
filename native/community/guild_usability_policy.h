#pragma once
#include <cstdint>
// Never offer retired More Heroes prototypes, including under build-anything.
// Definitions stay registered so saved actors and quest references still load.
inline constexpr bool MajestyRetiredGuild(std::uint32_t type) {
    const auto family=type&0xffffffU;
    return family==0x304241U || family==0x314241U ||
           family==0x334241U || family==0x344241U || family==0x354241U ||
           family==0x364241U || family==0x374241U || family==0x384241U ||
           family==0x394241U || family==0x494241U || family==0x4b4241U ||
           family==0x5a4241U || family==0x694241U || family==0x794241U;
}
