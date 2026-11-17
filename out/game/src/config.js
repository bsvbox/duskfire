// Duskfire: every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below
// depends on the screen size. Pip the firefly runs right; the world scrolls left.

export const FIELD = { width: 1280, height: 720, groundY: 620 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Pixels of scrolling that make one metre of the run toward dawn. */
export const PX_PER_METRE = 12;

/** Reach this distance and dawn breaks: the run is won. */
export const WIN_DISTANCE = 1500;

/** Seconds of play per level; speeds and spawn rates stop growing at the last level. */
export const LEVEL = { metres: 150, max: 10 };

export const PLAYER = {
  x: 220,
  width: 36,
  height: 34,
  slideHeight: 18,
  gravity: 2100,
  jumpVelocity: -820,
  doubleJumpVelocity: -720,
  diveVelocity: 1900,
  slideSeconds: 0.55,
  invulnerableSeconds: 1.5,
};

export const LIVES = 3;

export const SPEED = {
  base: 260,
  perLevel: 16,
  max: 430,
};

export const SPAWN = {
  interval: 1.5,
  intervalScale: 0.97,
  minInterval: 1.35,
  thornGap: 90,
};

export const THORN = {
  width: 34,
  height: 52,
  widthWide: 58,
  heightTall: 74,
};

export const MOTH = {
  width: 46,
  height: 26,
  flyHeight: 52,
  bob: 6,
};

export const SPORE = {
  radius: 11,
  points: 10,
  arcHeight: 70,
};

export const COMBO_MAX = 5;

export const SUNPETAL = {
  radius: 14,
  everySeconds: 26,
};

export const PALETTE = {
  skyTop: '#0b1026',
  skyMid: '#1b1440',
  skyLow: '#3b2350',
  dawnTop: '#2c3a6e',
  dawnMid: '#e8804f',
  dawnLow: '#ffd28a',
  moon: '#f4ead0',
  star: '#cdd8ff',
  hillFar: '#241a3d',
  hillNear: '#1a1230',
  ground: '#171029',
  groundTop: '#2c2145',
  grass: '#4a7a5c',
  thorn: '#120a24',
  thornEdge: '#6b4fae',
  moth: '#0d0820',
  mothWing: '#8a6fd6',
  spore: '#ffd76a',
  sporeCore: '#fff3c4',
  petal: '#ff9ecf',
  player: '#ffe9a3',
  playerGlow: '#ffcf4d',
  panel: '#17122b',
  text: '#f4efe4',
  muted: '#a89ec4',
  danger: '#ff6b6b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'duskfire.best';
