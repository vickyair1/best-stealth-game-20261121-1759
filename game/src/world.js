// NIGHTJAR — the world. One clear job: own the level state and step it.
// Movement, light and shadow, noise, smoke, loot, the relic, the exit,
// tripwires and the alarm all meet here; guard brains live in guards.js.
import { TILE, PLAYER, GUARD, HOUND, CAMERA, LAMP_RADIUS, ALARM, STEP } from './config.js';
import { LEVELS } from './levels.js';
import { makeGuard, makeCamera, stepGuard, stepCamera, hearNoise, STATE } from './guards.js';
import { makePlayer, stepPlayer, tileUnder, canStand } from './player.js';
import { distToSegment, crossedSegment } from './vision.js';
import * as sfx from './audio.js';

export const EVENT = {
  OVER: 1,
  ESCAPED: 2,
};

function tileCentre(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function scanGrid(grid, want) {
  const found = [];
  grid.forEach((row, ty) => {
    for (let tx = 0; tx < row.length; tx += 1) {
      if (row[tx] === want) found.push({ tx, ty });
    }
  });
  return found;
}

/** Fresh world state for level `index` (0-based). */
export function createWorld(index) {
  const def = LEVELS[index];
  const grid = def.grid.slice();
  const start = scanGrid(grid, 'P')[0];
  const relicTile = scanGrid(grid, 'R')[0];
  const exitTile = scanGrid(grid, 'E')[0];
  const loot = scanGrid(grid, 'o').map(({ tx, ty }) => ({ ...tileCentre(tx, ty), taken: false, bob: Math.random() * 6 }));
  const lamps = (def.lamps ?? []).map(([tx, ty]) => tileCentre(tx, ty));
  return {
    levelIndex: index,
    def,
    grid,
    player: makePlayer(start.tx * TILE + TILE / 2, start.ty * TILE + TILE / 2),
    guards: def.guards.map((g) => makeGuard(g, 'guard')),
    hounds: (def.hounds ?? []).map((h) => makeGuard(h, 'hound')),
    cameras: (def.cameras ?? []).map((c) => makeCamera(c)),
    tripwires: (def.tripwires ?? []).map((t) => {
      const a = tileCentre(t.a[0], t.a[1]);
      const b = tileCentre(t.b[0], t.b[1]);
      return { ax: a.x, ay: a.y, bx: b.x, by: b.y, tripped: false, pulse: 0 };
    }),
    lamps,
    loot,
    lootTotal: loot.length,
    lootGot: 0,
    relic: { ...tileCentre(relicTile.tx, relicTile.ty), taken: false },
    exit: { ...tileCentre(exitTile.tx, exitTile.ty) },
    coins: [], // thrown coins in flight / lying
    smokes: [], // {x,y,r,left}
    noises: [], // expanding rings {x,y,r,max}
    alarm: ALARM.QUIET,
    alarmLeft: 0,
    spotted: 0,
    time: 0,
    over: false,
    escaped: false,
    events: [],
    lastSeen: null,
    whistleCooldown: 0,
    hint: '',
    hintLeft: 0,
  };
}

/** Is (x,y) inside any lamp's warm pool? */
function lampAt(state, x, y) {
  for (const lamp of state.lamps) {
    if (Math.hypot(x - lamp.x, y - lamp.y) < LAMP_RADIUS) return true;
  }
  return false;
}

/** Refresh the player's light / shadow / cover flags from the floor. */
export function refreshSenses(state) {
  const p = state.player;
  const tile = tileUnder(state.grid, p);
  p.inLight = lampAt(state, p.x, p.y) && tile !== ',';
  p.inShadow = tile === ',' || !lampAt(state, p.x, p.y);
  p.inCover = tile === 'C';
  p.inSmoke = state.smokes.some((s) => Math.hypot(p.x - s.x, p.y - s.y) < s.r);
}

function emitNoise(state, x, y, radius) {
  state.noises.push({ x, y, r: 8, max: radius });
  for (const g of [...state.guards, ...state.hounds]) {
    const hearR = g.kind === 'hound' ? radius * HOUND.hearMult : radius;
    hearNoise(g, x, y, hearR);
  }
}

function setAlarm(state, level) {
  if (level === ALARM.ALARM) {
    state.alarm = ALARM.ALARM;
    state.alarmLeft = 8;
    sfx.playAlarm();
  } else if (level === ALARM.WARY && state.alarm === ALARM.QUIET) {
    state.alarm = ALARM.WARY;
  }
}

/**
 * Step the world one tick. `input` is {mx,my,sneak,sprint,click,useSmoke,
 * whistle}. Returns a bitmask of EVENT flags; per-tick happenings land in
 * state.events (drained by the caller).
 */
export function stepWorld(state, input, dt = STEP) {
  state.events = [];
  if (state.over || state.escaped) return 0;
  state.time += dt;
  const p = state.player;

  // --- player movement -------------------------------------------------
  const prevX = p.x;
  const prevY = p.y;
  const moved = stepPlayer(p, state.grid, input.mx, input.my, dt, { sneak: input.sneak, sprint: input.sprint });
  refreshSenses(state);

  // Footsteps: sprinting is loud, walking is a whisper, sneaking is silent.
  if (p.moving && moved > 0) {
    const interval = p.sprinting ? 0.34 : 0.52;
    if (state.time - p.lastStepAt > interval) {
      p.lastStepAt = state.time;
      const pan = Math.max(-1, Math.min(1, (p.x - state.player.x) / 300));
      sfx.playStep(p.sprinting, 0);
      if (p.sprinting) emitNoise(state, p.x, p.y, PLAYER.noiseSprint);
    }
  }

  // Guard footsteps: the tell that something is near.
  for (const g of [...state.guards, ...state.hounds]) {
    if (g.state === STATE.PATROL || g.state === STATE.SEARCH) {
      if (!g.stepAt) g.stepAt = 0;
      if (state.time - g.stepAt > 0.55) {
        g.stepAt = state.time;
        const d = Math.hypot(g.x - p.x, g.y - p.y);
        if (d < 420) sfx.playGuardStep(Math.max(-1, Math.min(1, (g.x - p.x) / 300)), d);
      }
    }
  }

  // --- gadgets ----------------------------------------------------------
  if (input.whistle && state.whistleCooldown <= 0) {
    state.whistleCooldown = 6;
    emitNoise(state, p.x, p.y, 130);
    sfx.playClink();
    state.hint = 'Whistle — they heard that.';
    state.hintLeft = 2;
  }
  state.whistleCooldown = Math.max(0, state.whistleCooldown - dt);

  if (input.click && p.coins > 0) {
    const tx = Math.max(0, Math.min(999, input.click.x));
    const ty = Math.max(0, Math.min(719, input.click.y));
    const dx = tx - p.x;
    const dy = ty - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const range = Math.min(d, PLAYER.coinRange);
    const lx = p.x + (dx / d) * range;
    const ly = p.y + (dy / d) * range;
    p.coins -= 1;
    p.throwAnim = 0.4;
    state.coins.push({ sx: p.x, sy: p.y, x: p.x, y: p.y, tx: lx, ty: ly, t: 0, dur: 0.45, landed: false });
    sfx.playCoin();
  }
  if (input.useSmoke && p.smoke > 0) {
    p.smoke -= 1;
    p.smokeAnim = 0.5;
    state.smokes.push({ x: p.x, y: p.y, r: PLAYER.smokeRadius, left: PLAYER.smokeSeconds });
    sfx.playSmoke();
    state.hint = 'Smoke — their cones cannot see through it.';
    state.hintLeft = 2.5;
  }

  // Thrown coins fly, land with a clink, and pull guards over.
  for (const coin of state.coins) {
    if (coin.landed) continue;
    coin.t += dt;
    const k = Math.min(1, coin.t / coin.dur);
    coin.x = coin.sx + (coin.tx - coin.sx) * k;
    coin.y = coin.sy + (coin.ty - coin.sy) * k - Math.sin(k * Math.PI) * 26;
    if (k >= 1) {
      coin.landed = true;
      coin.landedAt = state.time;
      emitNoise(state, coin.tx, coin.ty, PLAYER.coinNoise);
      sfx.playClink();
    }
  }
  state.coins = state.coins.filter((c) => !c.landed || state.time - c.landedAt < 6);

  // Smoke drifts and fades.
  for (const s of state.smokes) s.left -= dt;
  state.smokes = state.smokes.filter((s) => s.left > 0);

  // Noise rings expand and fade.
  for (const n of state.noises) n.r += dt * 260;
  state.noises = state.noises.filter((n) => n.r < n.max);

  // --- tripwires --------------------------------------------------------
  for (const wire of state.tripwires) {
    wire.pulse = (wire.pulse + dt) % 1.4;
    if (!wire.tripped && crossedSegment(prevX, prevY, p.x, p.y, wire.ax, wire.ay, wire.bx, wire.by)) {
      wire.tripped = true;
      setAlarm(state, ALARM.ALARM);
      state.events.push({ type: 'tripwire' });
      sfx.playTripwire();
      state.hint = 'Tripwire! Every guard is coming to look.';
      state.hintLeft = 3;
      for (const g of [...state.guards, ...state.hounds]) {
        g.investigate = { x: (wire.ax + wire.bx) / 2, y: (wire.ay + wire.by) / 2 };
        if (g.state === STATE.PATROL || g.state === STATE.RETURN) {
          g.state = STATE.SEARCH;
          g.searchLeft = GUARD.searchSeconds;
        }
      }
    }
  }

  // --- loot, relic, exit -------------------------------------------------
  for (const loot of state.loot) {
    if (!loot.taken && Math.hypot(p.x - loot.x, p.y - loot.y) < 26) {
      loot.taken = true;
      state.lootGot += 1;
      state.events.push({ type: 'loot' });
      sfx.playPickup();
    }
  }
  if (!state.relic.taken && Math.hypot(p.x - state.relic.x, p.y - state.relic.y) < 30) {
    state.relic.taken = true;
    state.events.push({ type: 'relic' });
    sfx.playRelic();
    state.hint = `You have ${state.def.relic}. Now reach the EXIT, unseen.`;
    state.hintLeft = 4;
  }
  const exitD = Math.hypot(p.x - state.exit.x, p.y - state.exit.y);
  if (exitD < 30) {
    if (state.relic.taken) {
      state.escaped = true;
      state.events.push({ type: 'escaped' });
      sfx.playEscape();
      return EVENT.ESCAPED;
    }
    if (state.hintLeft <= 0) {
      state.hint = `The exit is locked until you take ${state.def.relic}.`;
      state.hintLeft = 2.5;
    }
  }

  // --- guards and cameras ------------------------------------------------
  const ctx = { grid: state.grid, player: p, time: state.time };
  let caught = false;
  for (const g of [...state.guards, ...state.hounds]) {
    const evs = stepGuard(g, dt, ctx);
    for (const ev of evs) {
      if (ev.type === 'spotted') {
        state.spotted += 1;
        state.events.push(ev);
        sfx.playSuspicious();
      } else if (ev.type === 'alarm') {
        setAlarm(state, ALARM.ALARM);
        state.events.push(ev);
      } else if (ev.type === 'caught') {
        caught = true;
      }
    }
    if (g.meter > 0.35) state.lastSeen = g.lastSeen;
  }
  for (const cam of state.cameras) {
    const evs = stepCamera(cam, dt, ctx);
    for (const ev of evs) {
      if (ev.type === 'camera') {
        state.spotted += 1;
        state.events.push(ev);
        for (const g of [...state.guards, ...state.hounds]) {
          g.investigate = { x: p.x, y: p.y };
          if (g.state !== STATE.ALERT) { g.state = STATE.SEARCH; g.searchLeft = GUARD.searchSeconds; }
        }
      } else if (ev.type === 'alarm') {
        setAlarm(state, ALARM.ALARM);
        state.events.push(ev);
      }
    }
  }

  // Alarm decays when nobody is actively hunting.
  const hunting = [...state.guards, ...state.hounds].some((g) => g.state === STATE.ALERT || g.state === STATE.SEARCH);
  if (state.alarm === ALARM.ALARM) {
    state.alarmLeft -= dt;
    if (state.alarmLeft <= 0 && !hunting) state.alarm = ALARM.WARY;
  } else if (state.alarm === ALARM.WARY && !hunting) {
    state.alarm = ALARM.QUIET;
  } else if (hunting && state.alarm === ALARM.QUIET) {
    state.alarm = ALARM.WARY;
  }

  if (state.hintLeft > 0) state.hintLeft -= dt;
  if (p.throwAnim > 0) p.throwAnim -= dt;
  if (p.smokeAnim > 0) p.smokeAnim -= dt;

  if (caught) {
    state.over = true;
    state.events.push({ type: 'caught' });
    sfx.playCaught();
    return EVENT.OVER;
  }
  return 0;
}

/** Rating for a finished level: GHOST (never spotted) / SHADOW / SEEN. */
export function rateLevel(state) {
  const time = state.time;
  const par = state.def.par;
  let stars = 1;
  if (state.spotted === 0) stars = 3;
  else if (state.spotted <= 1 && time <= par * 1.3) stars = 2;
  if (state.lootGot === state.lootTotal && stars < 3 && state.spotted === 0) stars = 3;
  const rating = state.spotted === 0 ? 'GHOST' : state.spotted <= 1 ? 'SHADOW' : 'SEEN';
  return { stars, rating, time, par, lootGot: state.lootGot, lootTotal: state.lootTotal, spotted: state.spotted };
}

/** Format seconds as MM:SS. */
export function fmtTime(t) {
  const s = Math.max(0, Math.floor(t));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Distance from the player to the nearest guard (for the HUD "nearest" tell). */
export function nearestGuard(state) {
  let best = null;
  let bestD = Infinity;
  for (const g of [...state.guards, ...state.hounds]) {
    const d = Math.hypot(g.x - state.player.x, g.y - state.player.y);
    if (d < bestD) { bestD = d; best = g; }
  }
  return best ? { guard: best, dist: bestD } : null;
}
