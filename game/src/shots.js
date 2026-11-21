// NIGHTJAR — screenshot scenes behind ?shot=cover|alarm|search|ghost.
// Each scene builds a real level, then poses the thief, the wardens and
// the alarm in exact positions, so the frame is a genuine moment of play
// and the same seed always gives the same frame. No gameplay rule is
// changed for a shot: the world is only posed, never faked.
import { TILE, ALARM } from './config.js';
import { createWorld, rateLevel, refreshSenses } from './world.js';
import { STATE } from './guards.js';

function place(world, px, py, guardPoses) {
  world.player.x = px * TILE + TILE / 2;
  world.player.y = py * TILE + TILE / 2;
  world.player.sneaking = true;
  world.player.facing = -0.6;
  guardPoses.forEach(([gi, tx, ty, facing, stateName, meter], i) => {
    const g = world.guards[gi] ?? world.hounds[gi - world.guards.length];
    if (!g) return;
    g.x = tx * TILE + TILE / 2;
    g.y = ty * TILE + TILE / 2;
    g.facing = facing;
    g.state = stateName;
    g.meter = meter;
    g.lastSeen = { x: world.player.x, y: world.player.y };
    if (stateName === STATE.ALERT) g.spottedAt = 1;
  });
}

/**
 * Stage the named scene. Returns { world, screen, result } where screen is
 * 'play' or 'complete' and result is the level rating for 'complete'.
 */
export function stageShot(name, seed = 1) {
  void seed;
  if (name === 'alarm') {
    // Night 4, The Clocktower Works: a warden has you, red cone, alarm up.
    const world = createWorld(3);
    world.time = 3;
    world.spotted = 1;
    world.alarm = ALARM.ALARM;
    world.alarmLeft = 8;
    world.loot[0].taken = true;
    world.lootGot = 1;
    place(world, 13, 8, [
      [0, 11, 7, 0.9, STATE.ALERT, 1],
      [1, 17, 4, 2.6, STATE.SUSPICIOUS, 0.7],
      [2, 5, 9, -0.4, STATE.SEARCH, 0.5],
    ]);
    world.lastSeen = { x: world.player.x, y: world.player.y };
    world.hint = 'SPOTTED! Break line of sight and hide.';
    world.hintLeft = 99;
    refreshSenses(world);
    return { world, screen: 'play', result: null };
  }
  if (name === 'search') {
    // Night 2, Ink Market: they are hunting your last spot; you are hidden.
    const world = createWorld(1);
    world.time = 7;
    world.spotted = 1;
    world.alarm = ALARM.WARY;
    world.loot[0].taken = false;
    place(world, 11, 10, [
      [0, 8, 5, 1.9, STATE.SEARCH, 0.55],
      [1, 18, 3, 2.4, STATE.SUSPICIOUS, 0.4],
      [3, 17, 14, -1.2, STATE.PATROL, 0],
    ]);
    world.player.x = 11 * TILE + TILE / 2;
    world.player.y = 10 * TILE + TILE / 2;
    world.lastSeen = { x: 10 * TILE + 20, y: 6 * TILE + 20 };
    world.hint = 'They are hunting your last spot. Stay in the dark.';
    world.hintLeft = 99;
    refreshSenses(world);
    return { world, screen: 'play', result: null };
  }
  if (name === 'ghost') {
    // Night 3 complete: GHOST, three stars, the level-select payoff.
    const world = createWorld(2);
    world.time = 97;
    world.spotted = 0;
    world.lootGot = world.lootTotal;
    world.loot.forEach((l) => { l.taken = true; });
    world.relic.taken = true;
    world.escaped = true;
    const result = rateLevel(world);
    refreshSenses(world);
    return { world, screen: 'complete', result };
  }
  // Default: cover. Night 3, The Paper Mill: a suspicious warden, a cone
  // sweeping past the hedge you are crouched behind, relic glowing ahead.
  const world = createWorld(2);
  world.time = 64;
  world.spotted = 0;
  world.alarm = ALARM.WARY;
  world.loot[0].taken = true;
  world.lootGot = 1;
  place(world, 13, 8, [
    [0, 10, 5, 0.8, STATE.SUSPICIOUS, 0.62],
    [1, 18, 4, 2.8, STATE.PATROL, 0],
    [2, 6, 9, 0.3, STATE.PATROL, 0],
    [3, 19, 9, 2.2, STATE.SUSPICIOUS, 0.45],
  ]);
  world.player.x = 13 * TILE + TILE / 2;
  world.player.y = 8 * TILE + TILE / 2;
  world.hint = 'Something caught an eye. Freeze.';
  world.hintLeft = 99;
  refreshSenses(world);
  return { world, screen: 'play', result: null };
}
