// Compose the three independently observed outdoor-hero effect clock plans.
// A caller must still import their UNIT/orders and migrate hero navigation.
import {checkpointUnitAgentLinks} from './checkpoint.mjs';
import {checkpointOutdoorMarkerClockPlan} from './outdoor-marker-clock.mjs';
import {checkpointWaitEffectClockPlan} from './wait-effect-clock.mjs';
export const MAX_HERO_EFFECT_CLOCK_CHILDREN = 16;

export async function checkpointOutdoorHeroEffectClocks(source, heroUnitId, clocks) {
  if (!Number.isInteger(heroUnitId) || heroUnitId <= 0 || heroUnitId > 0xffffffff)
    throw Error('Invalid outdoor hero effect owner');
  let hero; const children = [], seen = new Set();
  for await (const unit of checkpointUnitAgentLinks(source)) {
    if (unit.unitId === heroUnitId) {
      if (hero) throw Error('Duplicate outdoor hero effect owner'); hero = unit;
    }
    if (unit.parentUnitId !== heroUnitId) continue;
    if (children.length >= MAX_HERO_EFFECT_CLOCK_CHILDREN || seen.has(unit.unitId))
      throw Error('Outdoor hero effect child budget or identity violation');
    seen.add(unit.unitId); children.push(unit);
  }
  if (!hero || hero.family !== 'VHCL' || !hero.agentId || hero.parentUnitId || hero.stateFlags & 4)
    throw Error('Missing living outdoor hero effect owner');
  // No nested graph, unknown effect, missing effect or duplicate class is
  // covered by this exact original state. Keep those admission failures explicit.
  const expected = new Set([0x32485241, 0x31475241, 0x33475241]);
  if (children.length !== 3) throw Error('Unqualified outdoor hero effect set');
  for (const child of children)
    if (!expected.delete(child.description)) throw Error('Unqualified outdoor hero effect class');
  for await (const unit of checkpointUnitAgentLinks(source))
    if (seen.has(unit.parentUnitId)) throw Error('Unqualified nested outdoor hero effect');
  const effects = [], patches = [];
  for (const child of children) {
    const plan = await (child.description === 0x32485241 ? checkpointOutdoorMarkerClockPlan :
      checkpointWaitEffectClockPlan)(source, child, clocks);
    effects.push(Object.freeze({unitId: child.unitId, description: child.description,
      parentUnitId: child.parentUnitId, offset: child.offset, size: child.size, plan}));
    for (const patch of plan.patches) patches.push(patch);
  }
  patches.sort((a, b) => a.offset - b.offset);
  for (let i = 1; i < patches.length; ++i)
    if (patches[i - 1].offset + patches[i - 1].size > patches[i].offset)
      throw Error('Outdoor hero effect clock patches overlap');
  return Object.freeze({scope: 'original-outdoor-hero-attached-effect-clocks', heroUnitId,
    sourceClockMs: clocks.sourceClockMs, destinationClockMs: clocks.destinationClockMs,
    effects: Object.freeze(effects), patches: Object.freeze(patches),
    originalProjectedEffectLifetimesQualified: effects.every(e => e.plan.originalProjectedClockLifetimeQualified),
    completeOrderMigration: false, destinationImportQualified: false});
}
