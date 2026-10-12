#!/usr/bin/env python3
"""Stage Frontier terrain, campaign UI and native region checkpoint controls."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def bounded_hashing(text):
    if 'const cancelHash = () => contentHasher.close();' in text:
        if (text.count('entries.push(name + "\\0" + await contentHasher.hash(file));') != 1 or
                text.count('signal?.removeEventListener("abort", cancelHash); contentHasher.close();') != 1):
            raise ValueError('Player cancellable hashing changed.')
        return text
    original = '''  for (const [name, handle] of files) {
    const file = await handle.getFile();
    entries.push(name + "\\0" + hex(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())));
  }'''
    bounded = '''  // Stream compatibility hashing off the UI thread; preserve the exact digest.
  const {ContentHasher} = await import("../world/content-hash.mjs");
  const contentHasher = new ContentHasher();
  try {
    for (const [name, handle] of files) {
      const file = await handle.getFile();
      entries.push(name + "\\0" + await contentHasher.hash(file));
    }
  } finally { contentHasher.close(); }'''
    if bounded not in text:
        if text.count(original) != 1:
            raise ValueError('Player compatibility hashing changed; bounded hashing was not staged.')
        text = text.replace(original, bounded)
    return text


def cancellable_startup(text):
    # A departed document must not finish preparation and inject a new game.
    # This guard ends at injection; it never treats pagehide as native shutdown.
    patches = (
        ('async function networkManifest(dir, game) {',
         'async function networkManifest(dir, game, signal) {\n  signal?.throwIfAborted();'),
        ('    for await (const [name, handle] of folder.entries()) {',
         '    for await (const [name, handle] of folder.entries()) {\n      signal?.throwIfAborted();'),
        ('  const contentHasher = new ContentHasher();\n  try {',
         '  signal?.throwIfAborted();\n  const contentHasher = new ContentHasher();\n  const cancelHash = () => contentHasher.close();\n  signal?.addEventListener("abort", cancelHash, {once: true});\n  try {'),
        ('      const file = await handle.getFile();\n      entries.push(name + "\\0" + await contentHasher.hash(file));',
         '      signal?.throwIfAborted();\n      const file = await handle.getFile();\n      signal?.throwIfAborted();\n      entries.push(name + "\\0" + await contentHasher.hash(file));'),
        ('  } finally { contentHasher.close(); }',
         '  } finally { signal?.removeEventListener("abort", cancelHash); contentHasher.close(); }\n  signal?.throwIfAborted();'),
        ('async function start() {',
         'async function start() {\n  const startupController = new AbortController();\n  const signal = startupController.signal;\n  const cancelStartup = () => startupController.abort();\n  addEventListener("pagehide", cancelStartup, {once: true});\n  try {'),
        ('  const games = await fetch("../games.json").then((r) => r.json());',
         '  const games = await fetch("../games.json", {signal}).then((r) => r.json());\n  signal.throwIfAborted();'),
        ('  const contentIdentity = await networkManifest(dir, game);',
         '  signal.throwIfAborted();\n  const contentIdentity = await networkManifest(dir, game, signal);\n  signal.throwIfAborted();'),
        ('  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });',
         '  const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });\n  signal.throwIfAborted();'),
        ('  const device = await adapter.requestDevice({ requiredFeatures, requiredLimits });',
         '  const device = await adapter.requestDevice({ requiredFeatures, requiredLimits });\n  if (signal.aborted) { device.destroy(); signal.throwIfAborted(); }'),
        ('  document.body.append(script);\n}',
         '  document.body.append(script);\n  } finally { removeEventListener("pagehide", cancelStartup); }\n}'),
    )
    if 'const startupController = new AbortController();' in text:
        if any(text.count(new) != 1 for _, new in patches):
            raise ValueError('Player startup cancellation changed.')
        return text
    for old, new in patches:
        if text.count(old) != 1:
            raise ValueError('Player preparation changed; cancellation was not staged.')
        text = text.replace(old, new)
    return text


def stage_player(text):
    text = bounded_hashing(text)
    # Installed Gold HD scripts require the pinned engine's inventory adapter
    # during ordinary play too. Hash the effective rule just as an explicit
    # opt-in would, and keep an explicit opt-out available for legacy content.
    rules = '  const rules = [...new URLSearchParams(location.search)].filter(([k]) => k.startsWith("RECOMP_RULE_"));'
    default_rules = rules + '\n  if (game.id === "majesty" && !rules.some(([key]) => key === "RECOMP_RULE_INVENTORY_COMPAT"))\n    rules.push(["RECOMP_RULE_INVENTORY_COMPAT", "1"]);'
    if default_rules not in text:
        if text.count(rules) != 1:
            raise ValueError('Player rule identity changed; inventory default was not staged.')
        text = text.replace(rules, default_rules)
    original = 'start().catch((e) => status(e.message, true));'
    paired_guard = '''// Frontier paired startup owns its storage lease before native initialization.
(new URLSearchParams(location.search).has("RECOMP_RULE_FRONTIER_TRANSFER")
  ? import("../world/paired-session.mjs").then(({startPairedPlayer}) => startPairedPlayer(start))
  : start()).catch((e) => status(e.message, true));'''
    guarded = '''// Frontier startup owns its storage lease before native initialization.
let frontierProfilePath = null, retainWorldLease = null;
(new URLSearchParams(location.search).has("world")
  ? import("../world/realm-session.mjs").then(({startNativeWorldPlayer}) => startNativeWorldPlayer((profile, retain) => {
      frontierProfilePath = profile; retainWorldLease = retain; return start();
    }))
  : new URLSearchParams(location.search).has("RECOMP_RULE_FRONTIER_TRANSFER")
    ? import("../world/paired-session.mjs").then(({startPairedPlayer}) => startPairedPlayer(start))
    : start()).catch((e) => status(e.message, true));'''
    previous_guarded = guarded
    guarded = guarded.replace('(new URLSearchParams(location.search).has("world")',
        '(new URLSearchParams(location.search).has("world") || new URLSearchParams(location.search).has("RECOMP_RULE_FRONTIER_SESSION")')
    legacy_guarded = guarded
    guarded = guarded.replace('let frontierProfilePath = null, retainWorldLease = null;',
        'let frontierProfilePath = null, retainWorldLease = null, prepareHeroRestore = null;')
    guarded = guarded.replace('(profile, retain) => {', '(profile, retain, prepare) => {')
    guarded = guarded.replace('frontierProfilePath = profile; retainWorldLease = retain; return start();',
        'frontierProfilePath = profile; retainWorldLease = retain; prepareHeroRestore = prepare; return start();')
    guarded = guarded.replace('has("RECOMP_RULE_FRONTIER_SESSION")',
        'has("RECOMP_RULE_FRONTIER_SESSION") || new URLSearchParams(location.search).has("RECOMP_RULE_FRONTIER_HERO_RESTORE")')
    solo_guarded = guarded
    guarded = guarded.replace('let frontierProfilePath = null, retainWorldLease = null, prepareHeroRestore = null;',
        'let frontierProfilePath = null, retainWorldLease = null, prepareHeroRestore = null;\nlet multiplayerProfile = null;')
    guarded = guarded.replace('(new URLSearchParams(location.search).has("world")',
        '''([...new URLSearchParams(location.search)].some(([key]) =>
    ["room", "mode", "role", "RECOMP_RULE_FRONTIER_CHAPTER"].includes(key) || key.startsWith("RECOMP_RULE_COOP_"))
  ? import("../multiplayer/profile-session.mjs").then(({startMultiplayerProfilePlayer}) => startMultiplayerProfilePlayer((profile, retain) => {
      multiplayerProfile = profile; retainWorldLease = retain; return start();
    }))
  : new URLSearchParams(location.search).has("world")''')
    if guarded not in text:
        previous = solo_guarded if solo_guarded in text else legacy_guarded if legacy_guarded in text else previous_guarded if previous_guarded in text else paired_guard if paired_guard in text else original
        if text.count(previous) != 1:
            raise ValueError('Player startup changed; Frontier guard was not staged.')
        text = text.replace(previous, guarded)
    patches = (
        ('      m.ENV.RECOMP_PROFILE_DIR = `/opfs/${id}/profile` + (profile ? `/${profile}` : "");',
         '      m.ENV.RECOMP_PROFILE_DIR = `/opfs/${id}/profile` + (frontierProfilePath ? `/${frontierProfilePath}` : (profile ? `/${profile}` : ""));'),
        ('  const id = await gameId();',
         '  const id = await gameId();\n  if (frontierProfilePath && id !== "majesty") throw new Error("Named worlds require Majesty");'),
        ('  document.body.append(script);',
         '  if (retainWorldLease) retainWorldLease();\n  document.body.append(script);'),
    )
    for old, new in patches:
        if new not in text:
            if text.count(old) != 1:
                raise ValueError('Player profile or injection changed; Frontier guard was not staged.')
            text = text.replace(old, new)
    # Content must be hashed before a custody checkpoint is admitted, while
    # the outer startup world lease still excludes every native game/writer.
    original_content = '  const contentIdentity = await networkManifest(dir, game);'
    ready_content = '  const contentIdentity = await networkManifest(dir, game, signal);\n  signal.throwIfAborted();'
    legacy_preparation = '\n  if (prepareHeroRestore) await prepareHeroRestore(contentIdentity.checkpoint, {signal});\n  signal.throwIfAborted();'
    previous_preparation = '\n  const heroRuntimeBinding = prepareHeroRestore ? (await prepareHeroRestore(contentIdentity.checkpoint, {signal})).runtimeBinding : null;\n  signal.throwIfAborted();'
    preparation = '\n  const heroRestoreReceipt = prepareHeroRestore ? await prepareHeroRestore(contentIdentity.checkpoint, {signal}) : null;\n  const heroRuntimeBinding = heroRestoreReceipt?.runtimeBinding ?? null;\n  const heroHaloBinding = heroRestoreReceipt?.haloBinding ?? null;\n  signal.throwIfAborted();'
    older_preparation = previous_preparation if previous_preparation in text else legacy_preparation
    if older_preparation in text:
        if text.count(older_preparation) != 1:
            raise ValueError('Player hero preparation is ambiguous.')
        text = text.replace(older_preparation, preparation)
    if preparation not in text:
        source = ready_content if ready_content in text else original_content
        if text.count(source) != 1:
            raise ValueError('Player content hashing changed; hero restore was not staged.')
        text = text.replace(source, source + preparation)
    original_extra = '      for (const [k, v] of extra) if (k.startsWith("RECOMP_") && k !== "RECOMP_NETWORK_MANIFEST" && k !== "RECOMP_CONTENT_IDENTITY") m.ENV[k] = v;'
    previous_bound_extra = original_extra.replace('k !== "RECOMP_CONTENT_IDENTITY"',
        'k !== "RECOMP_CONTENT_IDENTITY" && k !== "RECOMP_FRONTIER_HERO_BINDING"') + '\n      if (heroRuntimeBinding) m.ENV.RECOMP_FRONTIER_HERO_BINDING = heroRuntimeBinding;\n      else delete m.ENV.RECOMP_FRONTIER_HERO_BINDING;'
    bound_extra = previous_bound_extra.replace('k !== "RECOMP_FRONTIER_HERO_BINDING"',
        'k !== "RECOMP_FRONTIER_HERO_BINDING" && k !== "RECOMP_FRONTIER_HERO_HALO_BINDING"') + '\n      if (heroHaloBinding) m.ENV.RECOMP_FRONTIER_HERO_HALO_BINDING = heroHaloBinding;\n      else delete m.ENV.RECOMP_FRONTIER_HERO_HALO_BINDING;'
    owner_extra = bound_extra.replace('k !== "RECOMP_FRONTIER_HERO_HALO_BINDING"',
        'k !== "RECOMP_FRONTIER_HERO_HALO_BINDING" && k !== "RECOMP_FRONTIER_HERO_OWNER_MANIFEST"') + '\n      if (heroRestoreReceipt?.ownerManifest) m.ENV.RECOMP_FRONTIER_HERO_OWNER_MANIFEST = heroRestoreReceipt.ownerManifest;\n      else delete m.ENV.RECOMP_FRONTIER_HERO_OWNER_MANIFEST;'
    if owner_extra not in text:
        if bound_extra not in text:
            source_extra = previous_bound_extra if previous_bound_extra in text else original_extra
            if text.count(source_extra) != 1:
                raise ValueError('Player environment changed; verified hero binding was not staged.')
            text = text.replace(source_extra, bound_extra)
        text = text.replace(bound_extra, owner_extra)
    generation_extra = owner_extra + '\n      if (heroHaloBinding) {\n        m.ENV.RECOMP_RULE_FRONTIER_HERO_GENERATION = "v1";\n        m.ENV.RECOMP_RULE_FRONTIER_SEEDED_GENERATION = "1";\n        m.ENV.RECOMP_RULE_FRONTIER_CONNECTED_TERRAIN = "v1";\n      } else delete m.ENV.RECOMP_RULE_FRONTIER_HERO_GENERATION;'
    if generation_extra not in text:
        if text.count(owner_extra) != 1:
            raise ValueError('Player environment changed; hero generation was not staged.')
        text = text.replace(owner_extra, generation_extra)
    inventory_extra = generation_extra + '\n      if (id === "majesty" && !extra.has("RECOMP_RULE_INVENTORY_COMPAT"))\n        m.ENV.RECOMP_RULE_INVENTORY_COMPAT = "1";'
    if inventory_extra not in text:
        if text.count(generation_extra) != 1:
            raise ValueError('Player environment changed; inventory default was not staged.')
        text = text.replace(generation_extra, inventory_extra)
    profile_rules = (
        ('  if (frontierProfilePath && id !== "majesty") throw new Error("Named worlds require Majesty");',
         '  if (frontierProfilePath && id !== "majesty") throw new Error("Named worlds require Majesty");\n  if (multiplayerProfile !== null && id !== "majesty") throw new Error("Multiplayer profiles require Majesty");'),
        ('      const profile = new URLSearchParams(location.search).get("profile") || "";',
         '      const profile = multiplayerProfile !== null ? multiplayerProfile : (new URLSearchParams(location.search).get("profile") || "");'),
        (inventory_extra, inventory_extra + '\n      if (multiplayerProfile !== null)\n        m.ENV.RECOMP_PROFILE_DIR = `/opfs/${id}/profile` + (multiplayerProfile ? `/${multiplayerProfile}` : "");'),
    )
    for old, new in profile_rules:
        if new not in text:
            if text.count(old) != 1:
                raise ValueError('Player multiplayer profile ownership changed.')
            text = text.replace(old, new)
    for module in ('campaign/session.mjs', 'world/native.mjs', 'world/resources.mjs', 'multiplayer/session.mjs'):
        script = f'<script type="module" src="../{module}"></script>'
        if script not in text:
            text = text.replace('</body>', script + '\n</body>')
    return cancellable_startup(text)


def stage(site=None):
    site = Path(site) if site is not None else ROOT / 'upstream/majesty-recomp/build/web-site'
    if not (site / 'index.html').is_file():
        raise SystemExit('Build or stage the Majesty web launcher first.')
    shutil.copytree(ROOT / 'web/world', site / 'world', dirs_exist_ok=True)
    shutil.copytree(ROOT / 'web/campaign', site / 'campaign', dirs_exist_ok=True)
    shutil.copytree(ROOT / 'web/multiplayer', site / 'multiplayer', dirs_exist_ok=True)
    shutil.copytree(ROOT / 'web/backups', site / 'backups', dirs_exist_ok=True)
    page = site / 'index.html'
    text = page.read_text()
    link = '<p><a href="world/">Explore the Frontier streaming experiment</a></p>'
    if link not in text:
        page.write_text(text.replace('</main>', link + '\n</main>'))
    text = page.read_text()
    campaign = '<p><a href="campaign/">Play the Frontier co-op campaign experiment</a></p>'
    if campaign not in text:
        page.write_text(text.replace('</main>', campaign + '\n</main>'))
    text = page.read_text()
    multiplayer = '<p><a href="multiplayer/">Host or join co-op and competitive multiplayer</a></p>'
    if multiplayer not in text:
        page.write_text(text.replace('</main>', multiplayer + '\n</main>'))
    player = site / 'majesty/index.html'
    if player.is_file():
        staged = stage_player(player.read_text())
        restore_guard = '  await import("../backups/storage.mjs").then(({assertNoPlayerRestore}) => assertNoPlayerRestore());\n  signal.throwIfAborted();\n'
        anchor = '  if (!crossOriginIsolated) throw new Error("This page must be served cross-origin isolated (COOP/COEP headers).");'
        if restore_guard not in staged:
            if staged.count(anchor) != 1:
                raise ValueError('Player startup changed; backup recovery guard was not staged.')
            staged = staged.replace(anchor, restore_guard + anchor)
        player.write_text(staged)
    text = page.read_text()
    backup = '<p><a href="backups/">Export or restore a complete player backup</a></p>'
    if backup not in text:
        page.write_text(text.replace('</main>', backup + '\n</main>'))
    print(f'World experiment staged in {site / "world"}')


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site', type=Path, help='Stage into an isolated site instead of the served build')
    stage(parser.parse_args().site)
