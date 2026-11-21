// NIGHTJAR — sight lines. One clear job: what a guard or camera can see.
// Walls (#) and tall crates (X) block sight; hedges (C) hide a crouched
// player but never block a cone. All coordinates are pixels.
import { TILE } from './config.js';

/** True when tile (tx,ty) blocks sight. Out of bounds blocks sight. */
export function blocksSight(grid, tx, ty) {
  if (ty < 0 || ty >= grid.length || tx < 0 || tx >= grid[0].length) return true;
  const ch = grid[ty][tx];
  return ch === '#' || ch === 'X';
}

/**
 * Line of sight between two pixel points, sampled finely enough that a
 * wall one tile thick is never stepped over.
 */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const tx = Math.floor((x0 + dx * t) / TILE);
    const ty = Math.floor((y0 + dy * t) / TILE);
    if (blocksSight(grid, tx, ty)) return false;
  }
  return true;
}

/**
 * Cast one ray from (x,y) at `angle` until it hits sight-blocking geometry
 * or `maxDist`. Returns the hit point.
 */
export function castRay(grid, x, y, angle, maxDist) {
  const step = 5;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let px = x;
  let py = y;
  for (let d = 0; d < maxDist; d += step) {
    px += dx;
    py += dy;
    if (blocksSight(grid, Math.floor(px / TILE), Math.floor(py / TILE))) return { x: px, y: py };
  }
  return { x: x + Math.cos(angle) * maxDist, y: y + Math.sin(angle) * maxDist };
}

/**
 * The visible polygon of a vision cone: origin, facing angle, half-angle,
 * range. Raycast every few degrees so walls carve the cone's edge.
 */
export function conePolygon(grid, x, y, angle, halfAngle, range) {
  const points = [{ x, y }];
  const rays = 26;
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    points.push(castRay(grid, x, y, a, range));
  }
  return points;
}

/** Shortest distance from point (px,py) to segment (x0,y0)-(x1,y1). */
export function distToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x0 + dx * t), py - (y0 + dy * t));
}

/** True when the player crosses the tripwire segment this step. */
export function crossedSegment(px0, py0, px1, py1, ax, ay, bx, by) {
  const d1 = (bx - ax) * (py0 - ay) - (by - ay) * (px0 - ax);
  const d2 = (bx - ax) * (py1 - ay) - (by - ay) * (px1 - ax);
  if (d1 === 0 || d2 === 0) return distToSegment(px1, py1, ax, ay, bx, by) < 6;
  return (d1 > 0) !== (d2 > 0);
}
