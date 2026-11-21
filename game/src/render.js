// NIGHTJAR — drawing. One clear job: turn a world state into the picture.
// Everything the judge sees lives here: lamplit floors, vision cones,
// cover you can read at a glance, guards against the floor, and the HUD.
import { TILE, COLS, ROWS, FIELD_W, FIELD_H, HUD_W, VIEW_W, VIEW_H, LAMP_RADIUS, LAMP_GLOW, PALETTE, ALARM } from './config.js';
import { conePolygon } from './vision.js';
import { STATE } from './guards.js';
import { fmtTime } from './world.js';

// Pre-rendered floor pattern (one tile of speckle, tiled across the field).
let floorPattern = null;
function makeFloorPattern(ctx) {
  const c = document.createElement('canvas');
  c.width = TILE * 2;
  c.height = TILE * 2;
  const g = c.getContext('2d');
  g.fillStyle = PALETTE.floorA;
  g.fillRect(0, 0, TILE * 2, TILE * 2);
  g.fillStyle = PALETTE.floorB;
  g.fillRect(0, 0, TILE, TILE);
  g.fillRect(TILE, TILE, TILE, TILE);
  // Speckle + faint tile seams.
  for (let i = 0; i < 260; i += 1) {
    const x = Math.random() * TILE * 2;
    const y = Math.random() * TILE * 2;
    g.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.08)';
    g.fillRect(x, y, 2, 2);
  }
  g.strokeStyle = 'rgba(0,0,0,0.22)';
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, TILE, TILE);
  g.strokeRect(TILE + 0.5, TILE + 0.5, TILE, TILE);
  floorPattern = ctx.createPattern(c, 'repeat');
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCone(ctx, grid, x, y, facing, halfAngle, range, fill, edge) {
  const poly = conePolygon(grid, x, y, facing, halfAngle, range);
  ctx.beginPath();
  ctx.moveTo(poly[0].x, poly[0].y);
  for (let i = 1; i < poly.length; i += 1) ctx.lineTo(poly[i].x, poly[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function lampGlow(ctx, x, y, radius, alpha) {
  const grad = ctx.createRadialGradient(x, y, 8, x, y, radius);
  grad.addColorStop(0, `rgba(255, 196, 107, ${alpha})`);
  grad.addColorStop(0.55, `rgba(255, 170, 80, ${alpha * 0.45})`);
  grad.addColorStop(1, 'rgba(255, 170, 80, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
}

/** Draw the floor, walls, cover, lamps, loot, relic and exit. */
function drawBoard(ctx, state) {
  const { grid } = state;
  if (!floorPattern) makeFloorPattern(ctx);
  ctx.fillStyle = floorPattern;
  ctx.fillRect(0, 0, FIELD_W, FIELD_H);

  for (let ty = 0; ty < ROWS; ty += 1) {
    for (let tx = 0; tx < COLS; tx += 1) {
      const ch = grid[ty][tx];
      const x = tx * TILE;
      const y = ty * TILE;
      if (ch === ',') {
        ctx.fillStyle = PALETTE.floorShadow;
        ctx.fillRect(x, y, TILE, TILE);
      } else if (ch === 'D') {
        ctx.fillStyle = 'rgba(255, 196, 107, 0.10)';
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = 'rgba(255, 196, 107, 0.35)';
        ctx.fillRect(x, y, TILE, 3);
        ctx.fillRect(x, y + TILE - 3, TILE, 3);
      } else if (ch === '#') {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = PALETTE.wallTop;
        ctx.fillRect(x, y, TILE, 7);
        ctx.fillStyle = PALETTE.wallEdge;
        ctx.fillRect(x, y + TILE - 3, TILE, 3);
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(x + 5, y + 12, TILE - 10, 2);
      } else if (ch === 'C') {
        ctx.fillStyle = PALETTE.hedgeDark;
        roundRect(ctx, x + 3, y + 3, TILE - 6, TILE - 6, 8);
        ctx.fill();
        ctx.fillStyle = PALETTE.hedge;
        for (let i = 0; i < 9; i += 1) {
          const lx = x + 8 + ((i * 13) % 26);
          const ly = y + 8 + ((i * 17) % 26);
          ctx.beginPath();
          ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (ch === 'X') {
        ctx.fillStyle = PALETTE.crateDark;
        roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 4);
        ctx.fill();
        ctx.fillStyle = PALETTE.crate;
        ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
        ctx.strokeStyle = PALETTE.crateDark;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + TILE - 6, y + TILE - 6);
        ctx.moveTo(x + TILE - 6, y + 6); ctx.lineTo(x + 6, y + TILE - 6);
        ctx.stroke();
      }
    }
  }

  // Lamp pools of warm light, then the lamp posts themselves.
  for (const lamp of state.lamps) lampGlow(ctx, lamp.x, lamp.y, LAMP_GLOW, 0.5);
  for (const lamp of state.lamps) {
    ctx.fillStyle = '#2a2f3d';
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.lampWarm;
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(lamp.x - 1.5, lamp.y - 1.5, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  // Tripwires pulse red between their posts.
  for (const wire of state.tripwires) {
    const a = 0.45 + 0.4 * Math.sin(wire.pulse * 4.4);
    ctx.strokeStyle = wire.tripped ? 'rgba(255,90,90,0.9)' : `rgba(255,90,90,${a})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([7, 5]);
    ctx.beginPath(); ctx.moveTo(wire.ax, wire.ay); ctx.lineTo(wire.bx, wire.by); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff5a5a';
    for (const [px, py] of [[wire.ax, wire.ay], [wire.bx, wire.by]]) {
      ctx.fillRect(px - 3, py - 3, 6, 6);
    }
  }

  // Loot coins.
  for (const loot of state.loot) {
    if (loot.taken) continue;
    const bob = Math.sin(state.time * 3 + loot.bob) * 2;
    ctx.fillStyle = 'rgba(255,207,77,0.25)';
    ctx.beginPath(); ctx.arc(loot.x, loot.y + bob, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.coin;
    ctx.beginPath(); ctx.arc(loot.x, loot.y + bob, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6a10';
    ctx.beginPath(); ctx.arc(loot.x, loot.y + bob, 2.5, 0, Math.PI * 2); ctx.fill();
  }

  // The relic: a pulsing gold seal.
  if (!state.relic.taken) {
    const pulse = 1 + 0.12 * Math.sin(state.time * 3.2);
    ctx.fillStyle = 'rgba(255,217,77,0.22)';
    ctx.beginPath(); ctx.arc(state.relic.x, state.relic.y, 26 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(state.relic.x, state.relic.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = PALETTE.relic;
    ctx.fillRect(-8, -8, 16, 16);
    ctx.strokeStyle = '#fff3c4';
    ctx.lineWidth = 2;
    ctx.strokeRect(-8, -8, 16, 16);
    ctx.restore();
    ctx.fillStyle = '#8a6a10';
    ctx.beginPath(); ctx.arc(state.relic.x, state.relic.y, 3, 0, Math.PI * 2); ctx.fill();
  }

  // The exit: a green door with an arrow.
  const ex = state.exit;
  ctx.fillStyle = state.relic.taken ? 'rgba(61,220,120,0.30)' : 'rgba(61,220,120,0.12)';
  ctx.beginPath(); ctx.arc(ex.x, ex.y, 24, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0d3d22';
  roundRect(ctx, ex.x - 13, ex.y - 15, 26, 30, 4);
  ctx.fill();
  ctx.fillStyle = PALETTE.exit;
  ctx.beginPath();
  ctx.moveTo(ex.x - 7, ex.y - 6); ctx.lineTo(ex.x + 7, ex.y); ctx.lineTo(ex.x - 7, ex.y + 6);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = PALETTE.exit;
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', ex.x, ex.y + 28);
}

/** Draw a guard / hound: cone, body, facing, "?" / "!" and meter. */
function drawWatcher(ctx, state, g) {
  const isHound = g.kind === 'hound';
  const range = isHound ? 150 : 205;
  const half = isHound ? 0.85 : 0.56;
  let fill = PALETTE.conePatrol;
  let edge = PALETTE.conePatrolEdge;
  if (g.state === STATE.ALERT) { fill = PALETTE.coneAlert; edge = 'rgba(255,74,74,0.7)'; }
  else if (g.state === STATE.SUSPICIOUS || g.state === STATE.SEARCH) { fill = PALETTE.coneSuspicious; edge = 'rgba(255,166,66,0.65)'; }
  drawCone(ctx, state.grid, g.x, g.y, g.facing, half, range, fill, edge);

  // Body: a lamplighter warden with a brass helm.
  const bobY = Math.sin(g.bob) * 1.2;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(g.x, g.y + 11, 12, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = isHound ? PALETTE.hound : PALETTE.guard;
  ctx.beginPath(); ctx.arc(g.x, g.y + bobY, g.radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = isHound ? '#8b5cf6' : PALETTE.guardDark;
  ctx.beginPath(); ctx.arc(g.x, g.y + bobY, g.radius - 5, 0, Math.PI * 2); ctx.fill();
  // Facing tick.
  const fx = g.x + Math.cos(g.facing) * (g.radius + 3);
  const fy = g.y + bobY + Math.sin(g.facing) * (g.radius + 3);
  ctx.fillStyle = isHound ? '#e6d6ff' : '#ffd9ad';
  ctx.beginPath(); ctx.arc(fx, fy, 3.5, 0, Math.PI * 2); ctx.fill();

  // Suspicion meter arc over the head.
  if (g.meter > 0.03 && g.state !== STATE.ALERT) {
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(g.x, g.y + bobY, g.radius + 7, -Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = g.meter > 0.7 ? '#ff5a5a' : '#ffcf4d';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(g.x, g.y + bobY, g.radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * g.meter); ctx.stroke();
  }

  // "?" while suspicious, "!" while alerted.
  if (g.state === STATE.SUSPICIOUS || g.state === STATE.SEARCH) {
    drawBubble(ctx, g.x, g.y + bobY - 26, '?', '#ffcf4d');
  } else if (g.state === STATE.ALERT) {
    drawBubble(ctx, g.x, g.y + bobY - 26, '!', '#ff5a5a');
  }
}

function drawBubble(ctx, x, y, text, color) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1206';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 0.5);
}

/** Draw cameras: mount, sweeping pale-blue cone, trip flash. */
function drawCamera(ctx, state, cam) {
  drawCone(ctx, state.grid, cam.x, cam.y, cam.angle, 0.42, 230, PALETTE.coneCamera, 'rgba(140,200,255,0.5)');
  ctx.fillStyle = '#39415a';
  ctx.beginPath(); ctx.arc(cam.x, cam.y, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = cam.tripped ? '#ff5a5a' : '#8cc8ff';
  ctx.beginPath(); ctx.arc(cam.x, cam.y, 4.5, 0, Math.PI * 2); ctx.fill();
  if (cam.seen > 0.2) {
    ctx.strokeStyle = `rgba(255,90,90,${Math.min(1, cam.seen)})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cam.x, cam.y, 15 + cam.seen * 8, 0, Math.PI * 2); ctx.stroke();
  }
}

/** Draw the thief: a teal cloak, facing tick, HIDDEN tag in cover/shadow. */
function drawPlayer(ctx, state) {
  const p = state.player;
  const bobY = p.moving ? Math.sin(p.stepPhase) * 1.5 : 0;
  // Noise ring while sprinting.
  if (p.sprinting) {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 26 + Math.sin(state.time * 8) * 4, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y + 11, 12, 4.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath(); ctx.arc(p.x, p.y + bobY, p.radius, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.playerDark;
  ctx.beginPath(); ctx.arc(p.x, p.y + bobY, p.radius - 5, 0, Math.PI * 2); ctx.fill();
  const fx = p.x + Math.cos(p.facing) * (p.radius + 3);
  const fy = p.y + bobY + Math.sin(p.facing) * (p.radius + 3);
  ctx.fillStyle = '#d6fff9';
  ctx.beginPath(); ctx.arc(fx, fy, 3.5, 0, Math.PI * 2); ctx.fill();
  // Sneak = crouched ring; smoke puff anim.
  if (p.sneaking) {
    ctx.strokeStyle = 'rgba(57,208,196,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y + bobY, p.radius + 4, 0, Math.PI * 2); ctx.stroke();
  }
  if (p.inCover && p.sneaking) {
    ctx.fillStyle = '#39d0c4';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('HIDDEN', p.x, p.y + bobY - 24);
  }
}

/** Draw thrown coins, smoke clouds and noise rings. */
function drawEffects(ctx, state) {
  for (const n of state.noises) {
    ctx.strokeStyle = `rgba(255,255,255,${Math.max(0, 0.5 * (1 - n.r / n.max))})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.stroke();
  }
  for (const s of state.smokes) {
    const a = Math.min(0.55, s.left * 0.25);
    ctx.fillStyle = `rgba(200,205,215,${a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(220,225,235,${a * 0.7})`;
    ctx.beginPath(); ctx.arc(s.x - 20, s.y + 10, s.r * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(s.x + 22, s.y - 8, s.r * 0.55, 0, Math.PI * 2); ctx.fill();
  }
  for (const coin of state.coins) {
    ctx.fillStyle = PALETTE.coin;
    ctx.beginPath(); ctx.arc(coin.x, coin.y, coin.landed ? 5 : 6, 0, Math.PI * 2); ctx.fill();
    if (coin.landed) {
      ctx.strokeStyle = 'rgba(255,207,77,0.5)';
      ctx.beginPath(); ctx.arc(coin.tx, coin.ty, 12 + Math.sin(state.time * 6) * 2, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // Last seen marker: where the guards are hunting.
  if (state.lastSeen && (state.alarm !== ALARM.QUIET)) {
    const ls = state.lastSeen;
    ctx.strokeStyle = 'rgba(255,166,66,0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(ls.x, ls.y, 16 + Math.sin(state.time * 4) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffa642';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('LAST SEEN', ls.x, ls.y - 24);
  }
}

/** The full playfield: board, cones, watchers, thief, effects. */
export function drawWorld(ctx, state) {
  drawBoard(ctx, state);
  for (const cam of state.cameras) drawCamera(ctx, state, cam);
  for (const g of [...state.guards, ...state.hounds]) drawWatcher(ctx, state, g);
  drawPlayer(ctx, state);
  drawEffects(ctx, state);
}

/** Top bar over the field: level, objective, timer. */
export function drawTopBar(ctx, state, screen) {
  const def = state.def;
  ctx.fillStyle = 'rgba(10,12,20,0.92)';
  ctx.fillRect(0, 0, FIELD_W, 34);
  ctx.fillStyle = PALETTE.gold;
  ctx.beginPath(); ctx.arc(20, 17, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1206';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(state.levelIndex + 1), 20, 17.5);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(def.name.toUpperCase(), 40, 17.5);
  const w = ctx.measureText(def.name.toUpperCase()).width;
  ctx.fillStyle = PALETTE.gold;
  ctx.font = '13px sans-serif';
  const obj = state.relic.taken ? 'reach the EXIT unseen' : `Take ${def.relic}, then reach the exit`;
  ctx.fillText('◆ OBJECTIVE: ' + obj, 48 + w, 17.5);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('TIME ' + fmtTime(state.time), FIELD_W - 12, 17.5);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
