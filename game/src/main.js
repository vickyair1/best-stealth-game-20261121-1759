// NIGHTJAR — the game itself. One clear job: screens, the loop, progress.
// Screens: title (with level select) -> play -> pause / complete / caught.
// ?shot=<name> stages one frozen frame for the screenshots and stops.
import { VIEW_W, VIEW_H, STEP } from './config.js';
import { createWorld, stepWorld, rateLevel, EVENT } from './world.js';
import { drawWorld, drawTopBar } from './render.js';
import { drawSidePanel, drawTitleScreen, drawCompleteScreen, drawCaughtScreen, drawPauseScreen } from './hud.js';
import { createInput } from './input.js';
import { stageShot } from './shots.js';
import { resumeAudio } from './audio.js';

const SAVE_KEY = 'nightjar-progress-v1';

function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.unlocked === 'number' && p.best) return { unlocked: p.unlocked, selected: p.selected ?? 0, best: p.best };
    }
  } catch { /* fresh start */ }
  return { unlocked: 0, selected: 0, best: {} };
}

function saveProgress(p) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(p));
  } catch { /* storage may be unavailable; the game still plays */ }
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_W;
canvas.height = VIEW_H;

const input = createInput(canvas);
const progress = loadProgress();

const game = {
  screen: 'title',
  world: null,
  result: null,
  acc: 0,
  last: 0,
};

function startLevel(index) {
  game.world = createWorld(index);
  game.result = null;
  game.screen = 'play';
  game.acc = 0;
}

function finishLevel() {
  const result = rateLevel(game.world);
  game.result = result;
  const i = game.world.levelIndex;
  const prev = progress.best[i];
  if (!prev || result.stars > prev.stars || result.time < prev.time) {
    progress.best[i] = { stars: result.stars, rating: result.rating, time: result.time };
  }
  if (i + 1 < 6 && progress.unlocked < i + 1) progress.unlocked = i + 1;
  progress.selected = Math.min(i + 1, 5);
  saveProgress(progress);
  game.screen = 'complete';
}

function draw() {
  ctx.clearRect(0, 0, VIEW_W, VIEW_H);
  if (game.screen === 'title') {
    // Title over a dimmed live backdrop of night 1.
    const backdrop = game.world ?? createWorld(0);
    drawWorld(ctx, backdrop);
    drawSidePanel(ctx, backdrop);
    drawTitleScreen(ctx, progress);
    return;
  }
  const world = game.world;
  drawWorld(ctx, world);
  drawTopBar(ctx, world);
  drawSidePanel(ctx, world);
  if (game.screen === 'complete') drawCompleteScreen(ctx, world, game.result, progress);
  else if (game.screen === 'caught') drawCaughtScreen(ctx, world);
  else if (game.screen === 'pause') drawPauseScreen(ctx, world);
}

function frame(t) {
  const dt = Math.min(0.1, (t - game.last) / 1000 || 0);
  game.last = t;
  const inp = input.poll();
  if (inp.pause && (game.screen === 'play' || game.screen === 'pause')) {
    game.screen = game.screen === 'play' ? 'pause' : 'play';
  }
  if (game.screen === 'title') {
    if (inp.up) progress.selected = Math.max(0, progress.selected - 1);
    if (inp.down) progress.selected = Math.min(progress.unlocked, progress.selected + 1);
    if (inp.confirm) startLevel(progress.selected);
  } else if (game.screen === 'play') {
    game.acc += dt;
    let guard = 0;
    let firstStep = true;
    while (game.acc >= STEP && guard < 8) {
      const flags = stepWorld(game.world, inp, STEP);
      game.acc -= STEP;
      guard += 1;
      // One-shot inputs (coin, smoke, whistle) fire once per frame, never
      // once per substep: clear them after the first substep runs.
      if (firstStep) {
        inp.click = null;
        inp.useSmoke = false;
        inp.whistle = false;
        firstStep = false;
      }
      if (flags & EVENT.ESCAPED) { finishLevel(); break; }
      if (flags & EVENT.OVER) { game.screen = 'caught'; break; }
    }
    if (inp.retry) startLevel(game.world.levelIndex);
    if (inp.menu) game.screen = 'title';
  } else if (game.screen === 'complete') {
    if (inp.confirm && game.world.levelIndex + 1 < 6) startLevel(game.world.levelIndex + 1);
    else if (inp.retry) startLevel(game.world.levelIndex);
    else if (inp.menu) game.screen = 'title';
  } else if (game.screen === 'caught') {
    if (inp.retry) startLevel(game.world.levelIndex);
    else if (inp.menu) game.screen = 'title';
  } else if (game.screen === 'pause') {
    if (inp.retry) startLevel(game.world.levelIndex);
    if (inp.menu) game.screen = 'title';
  }
  draw();
  requestAnimationFrame(frame);
}

// Screenshot mode: one frozen, posed frame — no loop, no input.
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  const staged = stageShot(shot, Number(params.get('seed') || 1));
  game.world = staged.world;
  game.result = staged.result;
  game.screen = staged.screen;
  draw();
  window.__shotReady = true;
} else {
  game.world = createWorld(0);
  window.addEventListener('pointerdown', resumeAudio, { once: true });
  window.addEventListener('keydown', resumeAudio, { once: true });
  game.last = performance.now();
  requestAnimationFrame(frame);
}

// Debug / smoke-test handle: what the level is, what screen is up.
window.__nightjar = {
  get screen() { return game.screen; },
  get world() { return game.world; },
  get result() { return game.result; },
  get progress() { return progress; },
  startLevel,
};
