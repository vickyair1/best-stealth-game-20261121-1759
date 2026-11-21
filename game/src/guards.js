// NIGHTJAR — guard, hound and camera brains. One clear job: the AI state
// machine. States: patrol -> suspicious (meter fills, "?" ) -> alert
// (chase, "!", alarm) -> search (hunt the last seen spot) -> return.
import { GUARD, HOUND, CAMERA, TILE, ALARM } from './config.js';
import { hasLineOfSight } from './vision.js';

export const STATE = { PATROL: 'patrol', SUSPICIOUS: 'suspicious', ALERT: 'alert', SEARCH: 'search', RETURN: 'return' };

function tileCentre(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function moveToward(e, tx, ty, speed, dt) {
  const dx = tx - e.x;
  const dy = ty - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 2) return true;
  const step = Math.min(d, speed * dt);
  e.x += (dx / d) * step;
  e.y += (dy / d) * step;
  e.facing = angleTo(e.x - (dx / d) * step, e.y - (dy / d) * step, e.x, e.y);
  return d - step < 2;
}

/** Build a guard from a level definition entry. */
export function makeGuard(def, kind) {
  const tune = kind === 'hound' ? HOUND : GUARD;
  const first = tileCentre(def.waypoints[0][0], def.waypoints[0][1]);
  const second = tileCentre(def.waypoints[1][0], def.waypoints[1][1]);
  return {
    kind,
    x: first.x,
    y: first.y,
    radius: tune.radius,
    facing: angleTo(first.x, first.y, second.x, second.y),
    waypoints: def.waypoints.map(([tx, ty]) => tileCentre(tx, ty)),
    wpIndex: 1,
    pause: def.pause ?? 1,
    pauseLeft: 0,
    state: STATE.PATROL,
    meter: 0, // 0..1 suspicion; 1 = spotted
    lastSeen: null,
    searchLeft: 0,
    investigate: null, // {x,y} a noise point to check
    hearCooldown: 0,
    spottedAt: -1,
    bob: Math.random() * 6.28,
  };
}

/** Build a sweeping camera from a level definition entry. */
export function makeCamera(def) {
  const at = tileCentre(def.at[0], def.at[1]);
  return {
    x: at.x,
    y: at.y,
    from: def.from,
    to: def.to,
    angle: def.from,
    dir: 1,
    seen: 0, // seconds the player has been continuously visible
    tripped: false,
  };
}

/**
 * Can this watcher see the player right now? Returns 0 when unseen, else
 * a 0..1 visibility factor (1 = clear view in the light).
 * `seer` carries x, y, facing, coneRange, coneHalfAngle; `player` carries
 * x, y, sneaking, inShadow, inSmoke.
 */
export function visibility(grid, seer, player) {
  const dx = player.x - seer.x;
  const dy = player.y - seer.y;
  const dist = Math.hypot(dx, dy);
  let range = seer.coneRange;
  if (player.inShadow) range *= 0.62;
  if (player.sneaking) range *= 0.8;
  if (dist > range) return 0;
  if (dist > 30) {
    const ang = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(ang, seer.facing)) > seer.coneHalfAngle) return 0;
  }
  if (player.inSmoke) return 0;
  if (!hasLineOfSight(grid, seer.x, seer.y, player.x, player.y)) return 0;
  // Hiding in low cover while sneaking breaks the view at any real distance.
  if (player.sneaking && player.inCover && dist > 55) return 0;
  let factor = 1 - (dist / range) * 0.45;
  if (player.inLight) factor *= 1.35;
  if (player.sneaking) factor *= 0.6;
  if (dist < 46) factor = 1.4; // point blank: almost instant
  return Math.min(1.5, Math.max(0.05, factor));
}

/** One guard step. Mutates the guard; returns events for the world. */
export function stepGuard(g, dt, ctx) {
  const tune = g.kind === 'hound' ? HOUND : GUARD;
  const events = [];
  g.bob += dt * 6;
  if (g.hearCooldown > 0) g.hearCooldown -= dt;
  const vis = visibility(ctx.grid, { ...g, coneRange: tune.coneRange, coneHalfAngle: tune.coneHalfAngle }, ctx.player);
  const rate = (g.kind === 'hound' ? HOUND.detectRate : GUARD.detectRate)
    * (ctx.player.inLight ? GUARD.detectLightMult : ctx.player.inShadow ? GUARD.detectShadowMult : 1)
    * (ctx.player.sneaking ? GUARD.detectSneakMult : 1);

  if (vis > 0) {
    g.meter = Math.min(1, g.meter + rate * vis * dt);
    g.lastSeen = { x: ctx.player.x, y: ctx.player.y };
    if (g.meter >= 1 && g.state !== STATE.ALERT) {
      g.state = STATE.ALERT;
      g.searchLeft = GUARD.searchSeconds;
      if (g.spottedAt < 0) {
        g.spottedAt = ctx.time;
        events.push({ type: 'spotted', guard: g });
      }
      events.push({ type: 'alarm', level: ALARM.ALARM });
    } else if (g.meter > 0.35 && g.state === STATE.PATROL) {
      g.state = STATE.SUSPICIOUS;
    }
  } else {
    g.meter = Math.max(0, g.meter - GUARD.detectDecay * dt);
    if (g.state === STATE.SUSPICIOUS && g.meter <= 0.05) {
      g.state = g.investigate ? STATE.SEARCH : STATE.PATROL;
    }
  }

  const speed = g.state === STATE.ALERT ? tune.chaseSpeed : g.state === STATE.SEARCH ? tune.searchSpeed : tune.patrolSpeed;

  if (g.state === STATE.ALERT) {
    if (g.lastSeen) {
      const arrived = moveToward(g, g.lastSeen.x, g.lastSeen.y, speed, dt);
      if (arrived || vis === 0) {
        // Lost the player: sweep the last seen spot, then give up.
        g.state = STATE.SEARCH;
        g.searchLeft = GUARD.searchSeconds;
      }
    }
    if (Math.hypot(ctx.player.x - g.x, ctx.player.y - g.y) < GUARD.catchRadius + 4) {
      events.push({ type: 'caught', guard: g });
    }
  } else if (g.state === STATE.SEARCH) {
    const target = g.investigate ?? g.lastSeen;
    if (target) {
      const arrived = moveToward(g, target.x, target.y, speed, dt);
      if (arrived) {
        g.searchLeft -= dt;
        // Look around while searching.
        g.facing += Math.sin(ctx.time * 1.4 + g.bob) * dt * 1.6;
        if (g.searchLeft <= 0) {
          g.investigate = null;
          g.lastSeen = null;
          g.state = STATE.RETURN;
        }
      }
    } else {
      g.state = STATE.RETURN;
    }
  } else if (g.state === STATE.RETURN) {
    const wp = g.waypoints[g.wpIndex];
    if (moveToward(g, wp.x, wp.y, speed, dt)) {
      g.state = STATE.PATROL;
      g.pauseLeft = g.pause;
    }
  } else if (g.state === STATE.SUSPICIOUS) {
    // Freeze, stare at the last seen spot, then go look.
    if (g.lastSeen) g.facing = angleTo(g.x, g.y, g.lastSeen.x, g.lastSeen.y);
    if (g.meter > 0.85 || vis === 0) {
      g.state = STATE.SEARCH;
      g.investigate = g.lastSeen ? { ...g.lastSeen } : null;
      g.searchLeft = GUARD.searchSeconds;
    }
  } else {
    // PATROL: walk the waypoints, pausing at each.
    if (g.pauseLeft > 0) {
      g.pauseLeft -= dt;
    } else {
      const wp = g.waypoints[g.wpIndex];
      if (moveToward(g, wp.x, wp.y, speed, dt)) {
        g.wpIndex = (g.wpIndex + 1) % g.waypoints.length;
        g.pauseLeft = g.pause;
      }
    }
  }
  return events;
}

/** A guard hears a noise at (x,y) with the given radius. */
export function hearNoise(g, x, y, radius) {
  if (g.state === STATE.ALERT) return false;
  if (g.hearCooldown > 0) return false;
  if (Math.hypot(x - g.x, y - g.y) > radius) return false;
  g.hearCooldown = 1.5;
  g.investigate = { x, y };
  if (g.state === STATE.PATROL || g.state === STATE.RETURN) {
    g.state = STATE.SEARCH;
    g.searchLeft = GUARD.searchSeconds;
  }
  return true;
}

/** One camera step. Returns events for the world. */
export function stepCamera(cam, dt, ctx) {
  const events = [];
  cam.angle += CAMERA.sweepSpeed * cam.dir * dt;
  if (cam.angle > cam.to) { cam.angle = cam.to; cam.dir = -1; }
  if (cam.angle < cam.from) { cam.angle = cam.from; cam.dir = 1; }
  const vis = visibility(ctx.grid, { ...cam, facing: cam.angle, coneRange: CAMERA.coneRange, coneHalfAngle: CAMERA.coneHalfAngle }, ctx.player);
  if (vis > 0) {
    cam.seen += dt;
    if (cam.seen >= CAMERA.triggerSeconds && !cam.tripped) {
      cam.tripped = true;
      events.push({ type: 'camera', camera: cam });
      events.push({ type: 'alarm', level: ALARM.ALARM });
    }
  } else {
    cam.seen = Math.max(0, cam.seen - dt * 2);
    if (cam.seen === 0) cam.tripped = false;
  }
  return events;
}
