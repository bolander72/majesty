"""Resource accounting and bounded cleanup for an explicitly approved native pair."""
import asyncio
import os
import signal


def owned_rows(rows, roots, groups=()):
    roots = set(roots)
    known_groups = roots | set(groups)
    owned = roots | {row['pid'] for row in rows if row['group'] in known_groups}
    while True:
        expanded = owned | {row['pid'] for row in rows if row['parent'] in owned}
        if expanded == owned:
            return [row for row in rows if row['pid'] in owned]
        owned = expanded


def stop_reason(rows, roots, elapsed, deadline, log_sizes, limit=512 * 1024 * 1024, groups=(), expected_producers=2):
    if expected_producers not in (1, 2) or len(set(roots)) != expected_producers:
        return 'expected exactly two distinct owned producers'
    if elapsed > deadline:
        return 'paired native deadline'
    owned = owned_rows(rows, roots, groups)
    if sum(row['rssBytes'] for row in owned) > limit:
        return 'paired native aggregate RSS ceiling'
    ids = {row['pid'] for row in owned}
    if any(row['pid'] not in ids and row.get('program') in ['pop_smoke', 'ninja', 'cmake', 'clang', 'clang++', 'wasm-opt', 'wasm-ld'] for row in rows):
        return 'other heavy work appeared during native pair'
    if any(size > 4 * 1024 * 1024 for size in log_sizes):
        return 'paired native log ceiling'
    return None


async def stop_owned(processes, groups, grace=3):
    """Signal only groups created by this supervisor; reap every owned child."""
    for group in set(groups):
        try:
            os.killpg(group, signal.SIGTERM)
        except ProcessLookupError:
            pass
    waits = [asyncio.create_task(process.wait()) for process in processes]
    if waits:
        _, pending = await asyncio.wait(waits, timeout=grace)
        if pending:
            for group in set(groups):
                try:
                    os.killpg(group, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        await asyncio.gather(*waits)
