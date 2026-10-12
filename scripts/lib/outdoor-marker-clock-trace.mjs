// Ordered original dispatch/animation/callback evidence; no import qualification.
export function originalOutdoorMarkerClockTrace(log) {
  if (typeof log !== 'string' || log.length > 1024 * 1024 || !log.includes('all expectations met') ||
      /result=fail|SIGSEGV|abort from|undeliverable call(?!s: none)/i.test(log))
    throw Error('Incomplete or failed outdoor marker trace');
  const lines = log.split('\n').filter(line => line.startsWith('[streaming] Outdoor marker ') ||
    line.startsWith('[streaming] Marker callback '));
  const begin = lines.shift()?.match(/^\[streaming\] Outdoor marker begin phase=(baseline|rebased) source=57650 destination=24250 actual=(\d+) unit=527 hero=504 callback=4101 age=50 serialized-equal=1$/);
  if (!begin || Number(begin[2]) !== 57650) throw Error('Missing exact outdoor marker start');
  const phase = begin[1], base = phase === 'baseline' ? 57650 : 24250;
  const last = lines.pop()?.match(/^\[streaming\] Outdoor marker complete phase=(baseline|rebased) steps=(\d+) leaves=(\d+) callbacks=2 completion=1 cleanup=1 original-leaf=1 original-callback=1 clock-restored=1 hooks-removed=1 hero-transfer=0 result=pass$/);
  if (!last || last[1] !== phase) throw Error('Missing outdoor marker retirement');
  const steps = [], callbacks = []; let complete = false;
  for (const line of lines) {
    const callback = line.match(/^\[streaming\] Marker callback clock=(\d+) reason=(\d+) id=4101 original-delegated=1$/);
    if (callback) {
      if (complete || callbacks.length >= 2 || Number(callback[2]) !== (callbacks.length ? 1 : 2))
        throw Error('Invalid outdoor marker callback');
      callbacks.push({clock: Number(callback[1]), reason: Number(callback[2])}); continue;
    }
    const match = line.match(/^\[streaming\] Outdoor marker step index=(\d+) advance=(\d+) clock=(\d+) active=([01]) leaves=(\d+) callbacks=(\d+) completion=([01]) cleanup=([01]) flags=(\d+) clock-restored=1$/);
    if (!match || complete || steps.length >= 129) throw Error('Invalid outdoor marker step');
    const [index, advance, clock, active, leaves, count, completion, cleanup, flags] = match.slice(1).map(Number);
    if (index !== steps.length || advance !== index * 50 || clock !== base + advance ||
        leaves !== Math.floor((advance + 50) / 100) || count !== callbacks.length ||
        count !== completion * 2 || completion !== Number(!active) || cleanup !== completion ||
        flags !== (active ? 2592 : 2596) || callbacks.some(c => c.clock !== clock))
      throw Error('Outdoor marker clock/frame/callback chronology differs');
    steps.push({index, advance, clock, active, leaves, callbacks: count, completion, cleanup, flags});
    complete = !active;
  }
  const end = steps.at(-1);
  if (!complete || !end || !end.leaves || callbacks.length !== 2 || Number(last[2]) !== steps.length ||
      Number(last[3]) !== end.leaves) throw Error('Outdoor marker original lifetime did not complete');
  return {phase, baseClock: base, actualClock: 57650, steps, callbacks,
    completionAdvance: end.advance, leaves: end.leaves};
}
