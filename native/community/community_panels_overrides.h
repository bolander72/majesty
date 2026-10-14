#pragma once
void majesty_community_dialog_factory(X86 *);
void majesty_community_guild_control(X86 *);
void majesty_community_guild_destroy(X86 *);
void majesty_community_brewing_destroy(X86 *);
void majesty_community_brewing_setup(X86 *);
void majesty_community_brewing_event(X86 *);
// Include after the original browser overrides only in the owned content build.
#undef FN_004ca4f0
#define FN_004ca4f0 majesty_community_dialog_factory
#define FN_00465f00 majesty_community_guild_control
#define FN_00465270 majesty_community_guild_destroy
#define FN_0047a360 majesty_community_brewing_destroy
#define FN_0047a760 majesty_community_brewing_setup
#define FN_0047aae0 majesty_community_brewing_event
