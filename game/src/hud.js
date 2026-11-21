// NIGHTJAR — the side panel and the screens. One clear job: everything
// that is not the playfield: detection readout, legend, controls, and the
// title / level-select / complete / caught / pause overlays.
import { FIELD_W, HUD_W, VIEW_H, PALETTE, ALARM } from './config.js';
import { LEVELS } from './levels.js';
import { STATE } from './guards.js';
import { fmtTime } from './world.js';

const PX = FIELD_W; // panel left edge

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function bar(ctx, x, y, w, h, frac, color, bg = '#262c3d') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, Math.min(1, frac)) * w, h);
}

function label(ctx, text, x, y, color = PALETTE.hudDim, size = 11, bold = false) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${size}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, x, y);
}

/** The detection state the player is in right now. */
export function detectionState(state) {
  const watchers = [...state.guards, ...state.hounds];
  const alert = watchers.some((g) => g.state === STATE.ALERT);
  if (alert) return { text: 'ALARM !', color: '#ff5a5a', sub: 'You are seen! Break line of sight and hide.' };
  const searching = watchers.some((g) => g.state === STATE.SEARCH);
  if (searching) return { text: 'SEARCHING', color: '#ffa642', sub: 'They are hunting your last spot.' };
  const suspicious = watchers.some((g) => g.state === STATE.SUSPICIOUS);
  if (suspicious) return { text: 'SUSPICIOUS ?', color: '#ffcf4d', sub: 'Something caught an eye. Freeze.' };
  return { text: 'HIDDEN', color: '#3ddc78', sub: 'No one knows you are here.' };
}

/** The right-hand panel: detection, meters, loot, legend, controls. */
export function drawSidePanel(ctx, state) {
  ctx.fillStyle = PALETTE.hudBg;
  ctx.fillRect(PX, 0, HUD_W, VIEW_H);
  const x = PX + 14;
  const w = HUD_W - 28;

  label(ctx, 'DETECTION', x, 22, PALETTE.hudDim, 11, true);
  const det = detectionState(state);
  ctx.fillStyle = det.color;
  ctx.fillRect(x, 30, w, 34);
  ctx.fillStyle = '#14100a';
  ctx.font = 'bold 19px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(det.text, PX + HUD_W / 2, 54);
  ctx.textAlign = 'left';
  label(ctx, det.sub, x, 80, PALETTE.hudText, 11);

  const maxMeter = Math.max(0, ...[...state.guards, ...state.hounds].map((g) => g.meter));
  label(ctx, 'ALARM', x, 106);
  bar(ctx, x, 112, w - 60, 8, state.alarm === ALARM.ALARM ? 1 : state.alarm === ALARM.WARY ? 0.5 : 0, state.alarm === ALARM.ALARM ? '#ff5a5a' : '#ffa642');
  label(ctx, state.alarm === ALARM.ALARM ? 'ALARM' : state.alarm === ALARM.WARY ? 'WARY' : 'QUIET', x + w - 52, 120, state.alarm === ALARM.ALARM ? '#ff5a5a' : PALETTE.hudText, 11, true);
  label(ctx, 'SUSPICION', x, 140);
  bar(ctx, x, 146, w, 8, maxMeter, maxMeter > 0.7 ? '#ff5a5a' : '#ffcf4d');
  label(ctx, 'VISIBILITY', x, 174);
  const p = state.player;
  const visText = p.inSmoke ? 'IN SMOKE' : p.inLight ? 'IN THE LIGHT' : 'IN SHADOW';
  const visColor = p.inSmoke ? '#c8cdd7' : p.inLight ? '#ffcf4d' : '#3ddc78';
  bar(ctx, x, 180, w - 80, 8, p.inLight ? 0.9 : p.inShadow ? 0.25 : 0.55, visColor);
  label(ctx, visText, x + w - 72, 188, visColor, 11, true);
  label(ctx, 'NOISE', x, 208);
  bar(ctx, x, 214, w - 60, 8, p.sprinting ? 0.95 : p.moving && !p.sneaking ? 0.45 : 0.06, p.sprinting ? '#ff5a5a' : '#8b93a7');
  label(ctx, p.sprinting ? 'LOUD' : p.sneaking ? 'SILENT' : p.moving ? 'SOFT' : 'SILENT', x + w - 52, 222, PALETTE.hudText, 11, true);

  label(ctx, 'LOOT', x, 252, PALETTE.hudDim, 11, true);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(`${state.lootGot}/${state.lootTotal}`, x, 270);
  label(ctx, 'COINS', x + 90, 252, PALETTE.hudDim, 11, true);
  ctx.fillStyle = PALETTE.coin;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('●'.repeat(Math.max(0, p.coins)) + '○'.repeat(Math.max(0, 3 - p.coins)), x + 90, 270);
  label(ctx, 'SMOKE', x + 180, 252, PALETTE.hudDim, 11, true);
  ctx.fillStyle = '#c8cdd7';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('◌'.repeat(Math.max(0, p.smoke)), x + 180, 270);
  label(ctx, 'SPOTTED', x, 296, PALETTE.hudDim, 11, true);
  ctx.fillStyle = state.spotted > 0 ? '#ff5a5a' : PALETTE.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText(String(state.spotted), x, 314);
  label(ctx, 'GOAL', x + 90, 296, PALETTE.hudDim, 11, true);
  ctx.fillStyle = state.relic.taken ? '#3ddc78' : PALETTE.gold;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(state.relic.taken ? 'EXIT →' : 'NOT YET', x + 90, 314);

  // Legend.
  label(ctx, 'LEGEND', x, 344, PALETTE.hudDim, 11, true);
  const rows = [
    ['●', '#ff9a3d', 'Warden + vision cone'],
    ['▦', '#2e6b3a', 'Low cover: sneak to hide'],
    ['▩', '#6b4a2a', 'Crate: blocks sight'],
    ['●', '#ffc46b', 'Lamp light: you are seen'],
    ['◆', '#ffd94d', 'Relic — the night’s prize'],
    ['—', '#ff5a5a', 'Tripwire (pulses)'],
    ['▸', '#3ddc78', 'Exit'],
  ];
  rows.forEach(([glyph, color, text], i) => {
    const y = 364 + i * 18;
    ctx.fillStyle = color;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(glyph, x, y);
    label(ctx, text, x + 20, y, PALETTE.hudText, 11);
  });

  // Controls.
  label(ctx, 'CONTROLS', x, 500, PALETTE.hudDim, 11, true);
  const controls = [
    'WASD move · SHIFT sneak (silent)',
    'SPACE sprint (loud) · E whistle',
    'CLICK throw coin · F smoke puff',
    'R retry night · ESC pause',
  ];
  controls.forEach((c, i) => label(ctx, c, x, 520 + i * 17, PALETTE.hudText, 11));

  // Gadget counts.
  label(ctx, 'GADGETS', x, 606, PALETTE.hudDim, 11, true);
  label(ctx, `Coins ${p.coins} · Smoke ${p.smoke} · Whistle ready ${state.whistleCooldown <= 0 ? 'yes' : Math.ceil(state.whistleCooldown) + 's'}`, x, 624, PALETTE.hudText, 11);

  // Hint line at the bottom of the panel.
  if (state.hintLeft > 0 && state.hint) {
    ctx.fillStyle = 'rgba(255,207,77,0.12)';
    ctx.fillRect(x, 640, w, 46);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = '11px sans-serif';
    wrapText(ctx, state.hint, x + 8, 656, w - 16, 14);
  }
}

function wrapText(ctx, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, cy);
      line = word;
      cy += lh;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cy);
}

/** Dim the field behind an overlay. */
function dim(ctx) {
  ctx.fillStyle = 'rgba(8,10,16,0.72)';
  ctx.fillRect(0, 0, FIELD_W, VIEW_H);
}

export function drawTitleScreen(ctx, progress) {
  dim(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('V E L M O R A   ·   T H E   C A N A L   C I T Y', 500, 92);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('NIGHTJAR', 500, 158);
  ctx.fillStyle = PALETTE.player;
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('— the Lamplighter Heists —', 500, 190);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '15px sans-serif';
  ctx.fillText('Steal each night’s relic. Reach the exit unseen. Never let a warden’s cone fill.', 500, 224);
  ctx.fillText('Sneak in shadow, throw coins to pull guards away, smoke the cones you cannot dodge.', 500, 246);

  // Level select.
  ctx.textAlign = 'left';
  label(ctx, 'CAMPAIGN · SIX NIGHTS', 250, 292, PALETTE.gold, 13, true);
  LEVELS.forEach((level, i) => {
    const y = 308 + i * 56;
    const unlocked = i <= progress.unlocked;
    const best = progress.best[i];
    ctx.fillStyle = unlocked ? PALETTE.hudPanel : 'rgba(23,27,40,0.5)';
    ctx.fillRect(250, y, 500, 46);
    ctx.strokeStyle = i === progress.selected ? PALETTE.gold : PALETTE.hudLine;
    ctx.lineWidth = i === progress.selected ? 2 : 1;
    ctx.strokeRect(250.5, y + 0.5, 499, 45);
    ctx.fillStyle = unlocked ? PALETTE.gold : '#555b6b';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 274, y + 29);
    ctx.textAlign = 'left';
    ctx.fillStyle = unlocked ? '#fff' : '#555b6b';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(unlocked ? level.name : 'Locked', 296, y + 21);
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '12px sans-serif';
    ctx.fillText(unlocked ? level.sub : 'Escape the night before to open', 296, y + 38);
    if (best) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('★'.repeat(best.stars) + '☆'.repeat(3 - best.stars), 736, y + 21);
      ctx.fillStyle = PALETTE.hudDim;
      ctx.font = '11px sans-serif';
      ctx.fillText(`Best ${fmtTime(best.time)} · ${best.rating}`, 736, y + 38);
      ctx.textAlign = 'left';
    }
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '14px sans-serif';
  ctx.fillText('↑ ↓ choose a night · ENTER play · WASD move · SHIFT sneak · CLICK throw a coin · F smoke', 500, 668);
  ctx.fillText('Six nights, fourteen wardens, two hounds, three cameras — and one bird that is never seen.', 500, 692);
}

export function drawCompleteScreen(ctx, state, result, progress) {
  dim(ctx);
  const cx = 250;
  ctx.fillStyle = '#10131c';
  ctx.fillRect(cx, 90, 500, 480);
  ctx.strokeStyle = PALETTE.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(cx + 1, 91, 498, 478);
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`NIGHT ${state.levelIndex + 1} · ${state.def.name.toUpperCase()}`, 500, 132);
  ctx.fillStyle = '#3ddc78';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('ESCAPED', 500, 182);
  // Nightjar mark: a small bird glyph drawn from arcs.
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath(); ctx.arc(500, 232, 26, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#10131c';
  ctx.beginPath(); ctx.arc(492, 228, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(508, 228, 5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = PALETTE.player;
  ctx.beginPath(); ctx.moveTo(500, 246); ctx.lineTo(488, 258); ctx.lineTo(512, 258); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 34px sans-serif';
  ctx.fillText(result.rating, 500, 300);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '15px sans-serif';
  ctx.fillText(
    result.rating === 'GHOST' ? 'Never spotted. Velmora will not even know you came.'
      : result.rating === 'SHADOW' ? 'Seen once, and gone before they could hold you.'
      : 'You got out — but the wardens know your shape now.',
    500, 326,
  );
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText('★'.repeat(result.stars) + '☆'.repeat(3 - result.stars), 500, 362);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'left';
  const rows = [
    ['TIME', `${fmtTime(result.time)}  (par ${fmtTime(result.par)})`],
    ['TIMES SPOTTED', String(result.spotted)],
    ['LOOT', `${result.lootGot} / ${result.lootTotal}`],
  ];
  rows.forEach(([k, v], i) => {
    const y = 402 + i * 28;
    ctx.fillStyle = PALETTE.hudDim;
    ctx.font = '13px sans-serif';
    ctx.fillText(k, cx + 90, y);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(v, cx + 410, y);
    ctx.textAlign = 'left';
  });
  ctx.textAlign = 'center';
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillRect(300, 500, 170, 40);
  ctx.fillStyle = '#1a1206';
  ctx.fillText(state.levelIndex + 1 < 6 ? 'NEXT NIGHT ↵' : 'FINALE ✓', 385, 525);
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.strokeStyle = PALETTE.hudLine;
  ctx.fillRect(490, 500, 110, 40);
  ctx.strokeRect(490.5, 500.5, 109, 39);
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText('RETRY (R)', 545, 525);
  ctx.fillStyle = PALETTE.hudPanel;
  ctx.fillRect(620, 500, 110, 40);
  ctx.strokeRect(620.5, 500.5, 109, 39);
  ctx.fillStyle = PALETTE.hudText;
  ctx.fillText('MENU (M)', 675, 525);
}

export function drawCaughtScreen(ctx, state) {
  dim(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('CAUGHT', 500, 300);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '16px sans-serif';
  ctx.fillText('A warden laid a hand on your shoulder. The night is not over — it only restarts.', 500, 340);
  ctx.fillStyle = PALETTE.gold;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('R — try the night again      M — back to the menu', 500, 390);
  ctx.fillStyle = PALETTE.hudDim;
  ctx.font = '13px sans-serif';
  ctx.fillText(`Time ${fmtTime(state.time)} · Spotted ${state.spotted} · Loot ${state.lootGot}/${state.lootTotal}`, 500, 420);
}

export function drawPauseScreen(ctx, state) {
  dim(ctx);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', 500, 300);
  ctx.fillStyle = PALETTE.hudText;
  ctx.font = '15px sans-serif';
  ctx.fillText('ESC resume · R retry the night · M menu', 500, 340);
}
