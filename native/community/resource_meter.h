#pragma once
#include "StockControllerRegistry.h"
#include <cstdint>

namespace MajestyCommunity {
template <class Ops>
bool PresentResourceMeter(Ops &ops, std::uint32_t controller,
                          const MajestyStockControllers::ResourceMeterRecord &meter) {
    const auto unit = ops.unit(controller);
    const auto window = ops.window(controller);
    if (!unit || !window)
        return false;
    const auto value = ops.attribute(unit, meter.attributeId);
    ops.visible(window, meter.labelControlId, true);
    ops.visible(window, meter.countControlId, true);
    // Use the authored numeric binding (not the surrounding text control), as
    // the original AP22 quantity presenter does. Reading never spends reagents.
    ops.integer(window, meter.bindingControlId, value < 0 ? 0 : value);
    return true;
}
} // namespace MajestyCommunity
