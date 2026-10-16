#pragma once
#include "recruitment_panel_owner.h"

namespace MajestyCommunity {
struct RecruitmentPanelBinding {
    std::uint32_t parentDialogId, buildingFamily;
};
// All callbacks are mandatory. The content adapter supplies the original
// source-backed research/hiring behavior; an absent implementation cannot
// silently turn a declared mechanic off. Storage has process lifetime.
struct RecruitmentPanelServices {
    bool (*researchBusy)(X86 *, std::uint32_t);
    bool (*researchCommand)(X86 *, const RecruitmentPanelSession *, std::uint32_t);
    std::uint32_t (*toggle)(X86 *, const RecruitmentPanelSession *, std::uint32_t);
    void (*extras)(X86 *, const RecruitmentPanelSession *);
};
} // namespace MajestyCommunity

// Configure only the source-bound content adapter, before any panel opens.
// This does not enable MMCRv21, load assets, or claim gameplay qualification.
extern "C" bool
majesty_configure_recruitment_panels(const MajestyStockControllers::Registry *,
                                     const MajestyCommunity::RecruitmentPanelBinding *, unsigned,
                                     const MajestyCommunity::RecruitmentPanelServices *);
// The normal factory wrapper calls this first. False leaves CPU/arguments
// unchanged. True means the original AP52 factory and private capture ran.
extern "C" bool majesty_recruitment_dialog_factory(X86 *);
// Required before original world disposal, on the guest execution baton.
// This retires UI ownership only; registered bridge storage is process-lived.
extern "C" void majesty_reset_recruitment_panels(X86 *);

// Refresh surviving owned panels after original research completion. Sessions
// are snapshotted because native notifications may close or replace a panel.
extern "C" void majesty_refresh_recruitment_for_unit(X86 *, std::uint32_t);
