// NIGHTJAR — the thief. One clear job: how Wren moves, sneaks, sprints
// and uses gadgets (thrown coins, smoke). Collision with walls and tall
// crates lives here; sight and hearing live in guards.js / world.js.
import { PLAYER, TILE } from './config.js';

/** Build the player at the level's start tile. */
export function makePlayer(x, y) {
  return {
    x, y,
    radius: PLAYER.radius,
    facing: 0,
    sneaking: false,
    sprinting: false,
    moving: false,
    speed: 0,
    coins: 3,
    smoke: PLAYER.smokeCount,
    stepPhase: 0,
    lastStepAt: 0,
    throwAnim: 0,
    smokeAnim: 0,
    inLight: false,
    inShadow: false,
    inCover: false,
    inSmoke: false,
  };
}

function solidAt(grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true;
  const ch = grid[ty][tx];
  return ch === '#' || ch === 'X';
}

/** Circle-vs-tile collision: can the player stand at (x,y)? */
export function canStand(grid, x, y, r) {
  const minTx = Math.floor((x - r) / TILE);
  const maxTx = Math.floor((x + r) / TILE);
  const minTy = Math.floor((y - r) / TILE);
  const maxTy = Math.floor((y + r) / TILE);
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      if (!solidAt(grid, tx, ty)) continue;
      const cx = Math.max(tx * TILE, Math.min(x, tx * TILE + TILE));
      const cy = Math.max(ty * TILE, Math.min(y, ty * TILE + TILE));
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) < r * r) return false;
    }
  }
  return true;
}

/**
 * Move the player by the input vector for one step. Axis-separated so the
 * thief slides along walls. Returns the distance actually moved.
 */
export function stepPlayer(p, grid, dx, dy, dt, opts) {
  const speed = opts.sneak ? PLAYER.sneak : opts.sprint ? PLAYER.sprint : PLAYER.walk;
  const len = Math.hypot(dx, dy);
  p.moving = len > 0.01;
  p.sneaking = !!opts.sneak;
  p.sprinting = !!opts.sprint && p.moving;
  if (!p.moving) { p.speed = 0; return 0; }
  const nx = dx / len;
  const ny = dy / len;
  p.facing = Math.atan2(ny, nx);
  let moved = 0;
  const tryX = p.x + nx * speed * dt;
  if (canStand(grid, tryX, p.y, p.radius)) { moved += Math.abs(tryX - p.x); p.x = tryX; }
  const tryY = p.y + ny * speed * dt;
  if (canStand(grid, p.x, tryY, p.radius)) { moved += Math.abs(tryY - p.y); p.y = tryY; }
  p.speed = moved / dt;
  p.stepPhase += (moved / 26) * Math.PI;
  return moved;
}

/** Tile character under the player's feet. */
export function tileUnder(grid, p) {
  const tx = Math.floor(p.x / TILE);
  const ty = Math.floor(p.y / TILE);
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return '#';
  return grid[ty][tx];
}
