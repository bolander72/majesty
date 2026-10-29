// Keep existing solo profiles and world settings while retiring shared sessions.
globalThis.majestySinglePlayerSearch = function (search) {
  const query = new URLSearchParams(search);
  for (const key of new Set(query.keys())) {
    if (["room", "mode", "role", "relay", "RECOMP_RULE_FRONTIER_CHAPTER",
      "RECOMP_SINGLE_PLAYER_ONLY"].includes(key) ||
      /^RECOMP_.*(?:NETWORK|COOP|DIRECTPLAY)/.test(key))
      query.delete(key);
  }
  const value = query.toString();
  return value ? `?${value}` : "";
};
