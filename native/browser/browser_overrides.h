/* Game-specific adapter for the pinned DirectDraw executable. */
#ifndef MAJESTY_BROWSER_OVERRIDES_H
#define MAJESTY_BROWSER_OVERRIDES_H

void fn_004890f0(X86 *c);
void fn_004882e0(X86 *c);
void majesty_browser_network_construct(X86 *c);
#define FN_00497a00 majesty_browser_network_construct
void majesty_browser_gpl_agent_construct(X86 *c);
#define FN_00625e70 majesty_browser_gpl_agent_construct
void majesty_browser_view_construct(X86 *c);
#define FN_004384b0 majesty_browser_view_construct
void majesty_browser_connected_store(X86 *c);
#define FN_00428d70 majesty_browser_connected_store

/* SMNU/AP42 from the owned Gold HD layouts adds storefront radio buttons
 * 1000 and 1001. FUN_0045fee0 recognizes only provider IDs 7..10; accepting
 * another ID returns it as the next menu state, which FUN_004639c0 cannot
 * dispatch. Its caller then spins without pumping messages or presenting.
 * Disable these two controls through the original UI property setter (10),
 * as the original protocol handler does for unavailable modem/serial/LAN.
 * The native wrapper leaves the constructor's registers and return intact.
 */
static inline void majesty_browser_menu_construct(X86 *c) {
  const uint32_t menu = rd32(c->r[R_ESP] + 4);
  const uint32_t self = c->r[R_ECX];
  fn_004890f0(c);
  if (menu != 0x32345041u)
    return;
  for (uint32_t control = 1000; control <= 1001; ++control) {
    X86 extra = *c;
    extra.r[R_ECX] = self;
    /* thiscall: (control, property, disabled, reserved), callee pops 16. */
    const uint32_t args[4] = {control, 10, 1, 0};
    for (int i = 3; i >= 0; --i) {
      extra.r[R_ESP] -= 4;
      wr32(extra.r[R_ESP], args[i]);
    }
    extra.r[R_ESP] -= 4;
    wr32(extra.r[R_ESP], extra.eip);
    fn_004882e0(&extra);
  }
}
#define FN_004890f0 majesty_browser_menu_construct
/* 00416890 creates the SMNU window first, then 004ca4f0 selects a native
 * controller by a fixed switch on its resource ID. A new resource alone
 * otherwise returns null and its caller faults at 004168fc. Reuse the
 * measured AP47 guild controller for APw1; its already-created window and
 * string group retain the independent Trail Lodge resource identity.
 * Only the factory's four-argument stdcall selector is borrowed. Preserve
 * the original caller stack bytes and every returned register.
 */
void fn_004ca4f0(X86 *c);
static inline void majesty_browser_dialog_factory(X86 *c) {
  const uint32_t argument = c->r[R_ESP] + 4;
  const uint32_t dialog = rd32(argument);
  if (dialog == 0x31775041u)
    wr32(argument, 0x37345041u);
  fn_004ca4f0(c);
  if (dialog == 0x31775041u)
    wr32(argument, dialog);
}
#define FN_004ca4f0 majesty_browser_dialog_factory
void majesty_browser_preferences(X86 *c);
void majesty_browser_frame(X86 *c);
void majesty_browser_frontier_tick(X86 *c);
void majesty_browser_coop_rebuild(X86 *c);
void majesty_browser_frontier_menu(X86 *c);
void majesty_browser_frontier_generation_settings(X86 *c);
void majesty_browser_frontier_generate(X86 *c);
void majesty_browser_menu_frame(X86 *c);
void majesty_browser_ui_frame(X86 *c);
void majesty_browser_resolution(X86 *c);
void majesty_browser_resolution_menu(X86 *c);
void majesty_browser_resolution_label(X86 *c);
void majesty_browser_input_boundary(X86 *c);
#define FN_004b9180 majesty_browser_preferences
#define FN_00415dd0 majesty_browser_frame
#define FN_00417730 majesty_browser_frontier_tick
#define FN_00416c30 majesty_browser_coop_rebuild
#define FN_00490fc0 majesty_browser_frontier_menu
#define FN_004aef20 majesty_browser_frontier_generation_settings
#define FN_004b23d0 majesty_browser_frontier_generate
#define FN_00489150 majesty_browser_menu_frame
#define FN_004da450 majesty_browser_ui_frame
#define FN_00462b30 majesty_browser_resolution
#define FN_00463170 majesty_browser_resolution_menu
#define FN_004f5a80 majesty_browser_resolution_label
#define FN_004f49d0 majesty_browser_input_boundary
void majesty_browser_network_log(X86 *c);
#define FN_004de6d0 majesty_browser_network_log
void majesty_browser_loading_poll(X86 *c);
#define FN_004f6080 majesty_browser_loading_poll
void majesty_browser_local_player(X86 *c);
#define FN_004169a0 majesty_browser_local_player
void majesty_browser_named_read(X86 *c);
#define FN_00435940 majesty_browser_named_read
void majesty_browser_file_receive(X86 *c);
#define FN_004588d0 majesty_browser_file_receive
void majesty_browser_dispatch_receive(X86 *c);
#define FN_00454560 majesty_browser_dispatch_receive
void majesty_browser_streaming_write(X86 *c);
void majesty_browser_streaming_read(X86 *c);
void majesty_browser_streaming_unit_read(X86 *c);
void majesty_browser_streaming_unit_write(X86 *c);
#define FN_00435610 majesty_browser_streaming_write
#define FN_004354d0 majesty_browser_streaming_read
#define FN_005bfe50 majesty_browser_streaming_unit_read
#define FN_005c0bd0 majesty_browser_streaming_unit_write
void majesty_browser_multiplayer_start(X86 *c);
#define FN_004bbb90 majesty_browser_multiplayer_start
void majesty_browser_campaign_condition(X86 *c);
void majesty_browser_campaign_start(X86 *c);
void majesty_browser_campaign_modifier(X86 *c);
void majesty_browser_campaign_result(X86 *c);
#define FN_004918e0 majesty_browser_campaign_condition
#define FN_00423060 majesty_browser_campaign_start
#define FN_00491900 majesty_browser_campaign_modifier
#define FN_00482c50 majesty_browser_campaign_result
void majesty_browser_inventory_register(X86 *c);
#define FN_00424f10 majesty_browser_inventory_register
#endif
