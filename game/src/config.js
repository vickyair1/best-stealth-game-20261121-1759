// NIGHTJAR — configuration: field geometry, tuning and the palette.
// One clear job: every number the rest of the game shares lives here.
export const TILE = 40;
export const COLS = 25;
export const ROWS = 18;
export const FIELD_W = COLS * TILE; // 1000
export const FIELD_H = ROWS * TILE; // 720
export const HUD_W = 280;
export const VIEW_W = FIELD_W + HUD_W; // 1280
export const VIEW_H = FIELD_H; // 720

export const STEP = 1 / 60;

// Player movement (px per second).
export const PLAYER = {
  radius: 13,
  walk: 132,
  sneak: 62,
  sprint: 205,
  // Noise ring radius the player emits while moving.
  noiseWalk: 0,
  noiseSneak: 0,
  noiseSprint: 150,
  // Coin gadget: how far a thrown coin flies, how far its clink carries.
  coinRange: 320,
  coinNoise: 175,
  smokeCount: 2,
  smokeRadius: 78,
  smokeSeconds: 4.5,
};

// Guard senses.
export const GUARD = {
  radius: 14,
  patrolSpeed: 58,
  chaseSpeed: 128,
  searchSpeed: 82,
  coneRange: 205,
  coneHalfAngle: 0.56, // ~32 degrees
  // Detection fills per second while the player is seen (light multiplies it).
  detectRate: 0.85,
  detectLightMult: 2.4,
  detectShadowMult: 0.45,
  detectSneakMult: 0.55,
  detectDecay: 0.35,
  // Distance inside which a guard spots the player almost at once.
  pointBlank: 46,
  catchRadius: 20,
  // Suspicion that lingers after losing sight before a guard gives up.
  searchSeconds: 6,
  // How far a guard can hear a noise (multiplied for hounds).
  hearRadius: 150,
};

export const HOUND = {
  radius: 13,
  patrolSpeed: 78,
  chaseSpeed: 165,
  coneRange: 150,
  coneHalfAngle: 0.85,
  hearMult: 1.7,
  detectRate: 1.1,
};

export const CAMERA = {
  coneRange: 230,
  coneHalfAngle: 0.42,
  sweepSpeed: 0.55, // radians per second
  triggerSeconds: 1.1,
};

// Lamp light pools.
export const LAMP_RADIUS = 95;
export const LAMP_GLOW = 150;

// Alarm levels.
export const ALARM = { QUIET: 0, WARY: 1, ALARM: 2 };

// Rating thresholds at level end.
export const PAR = [95, 110, 125, 140, 160, 180]; // par seconds per level

export const PALETTE = {
  floorA: '#20242e',
  floorB: '#1b1f29',
  floorShadow: '#141824',
  wall: '#3a4152',
  wallTop: '#565f78',
  wallEdge: '#232838',
  hedge: '#2e6b3a',
  hedgeDark: '#1f4d29',
  crate: '#6b4a2a',
  crateDark: '#4a3018',
  lampWarm: '#ffc46b',
  conePatrol: 'rgba(255, 214, 110, 0.20)',
  conePatrolEdge: 'rgba(255, 214, 110, 0.55)',
  coneSuspicious: 'rgba(255, 166, 66, 0.30)',
  coneAlert: 'rgba(255, 74, 74, 0.34)',
  coneCamera: 'rgba(140, 200, 255, 0.20)',
  player: '#39d0c4',
  playerDark: '#1d8a80',
  guard: '#ff9a3d',
  guardDark: '#b25a12',
  hound: '#c98bff',
  relic: '#ffd94d',
  exit: '#3ddc78',
  coin: '#ffcf4d',
  tripwire: '#ff5a5a',
  smoke: 'rgba(200, 205, 215, 0.55)',
  hudBg: '#10131c',
  hudPanel: '#171b28',
  hudLine: '#2a3042',
  hudText: '#dfe4f0',
  hudDim: '#8b93a7',
  gold: '#ffcf4d',
};
