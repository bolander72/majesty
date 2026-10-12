// Read the original-engine observation only; this never declares a victory.
export function treasuryProgress(line, chapter) {
  const target = chapter === 2 ? 30100 : chapter === 3 ? 35000 : chapter === 4 ? 25000 : 0;
  if (!target || typeof line !== 'string' || line.length > 512) return null;
  const match = (chapter === 4
    ? /^\[campaign\] Chapter (4) treasury progress:((?: kingdom [1-4] -?\d+\/\d+; guild=[01] dauros=[01] readable=[01];){2,4}) (gathering gold|objective met)$/
    : /^\[campaign\] Chapter ([23]) treasury progress:((?: kingdom [1-4] -?\d+\/\d+;){2,4}) (gathering gold|objective met)$/).exec(line);
  if (!match || Number(match[1]) !== chapter) return null;
  const kingdoms = [], owners = new Set();
  const entries = chapter === 4
    ? /kingdom ([1-4]) (-?\d+)\/(\d+); guild=([01]) dauros=([01]) readable=([01]);/g
    : /kingdom ([1-4]) (-?\d+)\/(\d+);/g;
  for (const entry of match[2].matchAll(entries)) {
    const owner = Number(entry[1]), gold = Number(entry[2]);
    if (owners.has(owner) || Number(entry[3]) !== target ||
        !Number.isInteger(gold) || gold < -2147483648 || gold > 2147483647) return null;
    owners.add(owner);
    const kingdom = {owner, gold, remaining: Math.max(0, target - gold)};
    if (chapter === 4) Object.assign(kingdom, {
      guild: entry[4] === '1', dauros: entry[5] === '1', readable: entry[6] === '1'
    });
    kingdoms.push(kingdom);
  }
  const ready = kingdoms.every(kingdom => kingdom.remaining === 0 &&
    (chapter !== 4 || (kingdom.readable && kingdom.guild && kingdom.dauros)));
  if (ready !== (match[3] === 'objective met')) return null;
  return {target, kingdoms, ready};
}

export function treasuryText(progress) {
  return progress.kingdoms.map(kingdom => {
    const {owner, gold, remaining} = kingdom;
    const treasury = `Kingdom ${owner}: ${gold.toLocaleString('en-US')} / ${progress.target.toLocaleString('en-US')} gold (${remaining.toLocaleString('en-US')} needed).`;
    if (progress.target !== 25000) return treasury;
    return `${treasury} ${kingdom.readable
      ? `Warriors Guild: ${kingdom.guild ? 'complete' : 'needed'}. Temple to Dauros: ${kingdom.dauros ? 'complete' : 'needed'}.`
      : 'Building state unavailable.'}`;
  }).join(' ');
}
