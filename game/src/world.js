// The run itself: Pip's physics, the scrolling world, spawning, collisions and
// scoring. The simulation is a fixed-step pure update over `state`, so the same
// seed and the same inputs always give the same run. Obstacles are thorn bushes
// on the ground and night moths at head height; spores are the score, and a
// sunpetal grants one free hit. Dawn breaks at WIN_DISTANCE metres.
import {
  COMBO_MAX,
  FIELD,
  LEVEL,
  LIVES,
  MOTH,
  PLAYER,
  PX_PER_METRE,
  SPAWN,
  SPEED,
  SPORE,
  SUNPETAL,
  THORN,
  WIN_DISTANCE,
} from './config.js';
import { pickInt } from './random.js';

export const EVENT_PICKUP = 1;
export const EVENT_HIT = 2;
export const EVENT_OVER = 4;
export const EVENT_WIN = 8;
export const EVENT_LEVEL = 16;
export const EVENT_SHIELD = 32;
export const EVENT_PETAL = 64;

const KIND_THORN = 'thorn';
const KIND_MOTH = 'moth';

export function createWorld(random) {
  const state = freshState();
  let spawnTimer = 1.2;
  let petalTimer = SUNPETAL.everySeconds;
  let trailTimer = 0;

  function freshState() {
    return {
      time: 0,
      distancePx: 0,
      distance: 0,
      score: 0,
      combo: 0,
      hearts: LIVES,
      level: 1,
      speed: SPEED.base,
      shield: false,
      won: false,
      over: false,
      player: {
        y: FIELD.groundY - PLAYER.height,
        vy: 0,
        jumps: 0,
        grounded: true,
        sliding: 0,
        invuln: 0,
      },
      obstacles: [],
      spores: [],
      petals: [],
      particles: [],
      ambient: [],
    };
  }

  function reset() {
    const kept = state.ambient;
    Object.assign(state, freshState());
    spawnTimer = 1.2;
    petalTimer = SUNPETAL.everySeconds;
    trailTimer = 0;
    // A field of drifting fireflies for the backdrop, placed once per run.
    state.ambient = [];
    for (let i = 0; i < 26; i += 1) {
      state.ambient.push({
        x: random() * FIELD.width,
        y: 60 + random() * 420,
        phase: random() * Math.PI * 2,
        speed: 0.4 + random() * 0.9,
      });
    }
    void kept;
  }

  function groundTop() {
    return FIELD.groundY;
  }

  function playerRect() {
    const p = state.player;
    const height = p.sliding > 0 ? PLAYER.slideHeight : PLAYER.height;
    return { x: PLAYER.x, y: FIELD.groundY - height, w: PLAYER.width, h: height };
  }

  function burst(x, y, color, count, power) {
    for (let i = 0; i < count; i += 1) {
      const angle = random() * Math.PI * 2;
      const speed = (0.3 + random() * 0.7) * power;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 0.5 + random() * 0.4,
        maxLife: 0.9,
        color,
        size: 2 + random() * 3,
      });
    }
  }

  function spawnSporeArc(baseX, topY) {
    const count = 5;
    for (let i = 0; i < count; i += 1) {
      const t = i / (count - 1);
      const x = baseX + (t - 0.5) * 220;
      const y = topY - Math.sin(t * Math.PI) * SPORE.arcHeight;
      state.spores.push({ x, y, r: SPORE.radius, taken: false, phase: random() * Math.PI * 2 });
    }
  }

  function spawnSporeLine(baseX, y) {
    for (let i = 0; i < 4; i += 1) {
      state.spores.push({ x: baseX + i * 46, y, r: SPORE.radius, taken: false, phase: random() * Math.PI * 2 });
    }
  }

  function spawnThorn(x, tall) {
    const height = tall ? THORN.heightTall : THORN.height;
    const width = tall ? THORN.widthWide : THORN.width;
    state.obstacles.push({
      kind: KIND_THORN,
      x,
      y: FIELD.groundY - height,
      w: width,
      h: height,
      hit: false,
      seed: random(),
    });
  }

  function spawnMoth(x) {
    state.obstacles.push({
      kind: KIND_MOTH,
      x,
      y: FIELD.groundY - MOTH.flyHeight,
      w: MOTH.width,
      h: MOTH.height,
      hit: false,
      phase: random() * Math.PI * 2,
    });
  }

  function spawnPattern() {
    const x = FIELD.width + 60;
    const roll = random();
    const level = state.level;
    if (roll < 0.3) {
      spawnThorn(x, false);
      if (random() < 0.45) spawnSporeArc(x + 40, FIELD.groundY - 150);
    } else if (roll < 0.5) {
      const count = 2 + pickInt(random, 0, 2);
      for (let i = 0; i < count; i += 1) spawnThorn(x + i * (THORN.width + SPAWN.thornGap), random() < 0.3);
      spawnSporeArc(x + 80, FIELD.groundY - 170);
    } else if (roll < 0.68 && level >= 2) {
      spawnMoth(x);
      if (random() < 0.5) spawnSporeLine(x + 90, FIELD.groundY - 30);
    } else if (roll < 0.86) {
      spawnSporeArc(x + 60, FIELD.groundY - 160);
      if (level >= 3 && random() < 0.4) spawnThorn(x + 260, false);
    } else {
      spawnSporeLine(x, FIELD.groundY - 34);
      if (level >= 4 && random() < 0.5) spawnMoth(x + 200);
    }
  }

  function speedFor(level) {
    return Math.min(SPEED.max, SPEED.base + (level - 1) * SPEED.perLevel);
  }

  function intervalFor(level) {
    return Math.max(SPAWN.minInterval, SPAWN.interval * Math.pow(SPAWN.intervalScale, level - 1));
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /**
   * Advance the world one fixed step. `jump` and `dive` are one-shot presses,
   * `downHeld` keeps Pip low while held. In attract mode the world scrolls
   * gently with no danger, for the title screen backdrop. Returns event flags.
   */
  function step(dt, jump, dive, downHeld, attract) {
    let events = 0;
    const p = state.player;
    state.time += dt;

    if (attract) {
      state.distancePx += 120 * dt;
      if (state.time % 1 < dt) spawnSporeLine(FIELD.width + 40, FIELD.groundY - 120 - random() * 120);
      moveEntities(120 * dt);
      updateParticles(dt);
      return events;
    }

    if (state.over || state.won) return events;

    const level = Math.min(LEVEL.max, Math.floor(state.distance / LEVEL.metres) + 1);
    if (level !== state.level) {
      state.level = level;
      state.speed = speedFor(level);
      events |= EVENT_LEVEL;
    }
    const speed = state.speed;

    // --- player physics ---
    if (jump) {
      if (p.grounded) {
        p.vy = PLAYER.jumpVelocity;
        p.jumps = 1;
        p.grounded = false;
        p.sliding = 0;
      } else if (p.jumps === 1) {
        p.vy = PLAYER.doubleJumpVelocity;
        p.jumps = 2;
      }
    }
    if (dive) {
      if (!p.grounded) p.vy = Math.max(p.vy, PLAYER.diveVelocity);
      p.sliding = PLAYER.slideSeconds;
    }
    if (downHeld && p.grounded) p.sliding = Math.max(p.sliding, 0.12);
    if (p.sliding > 0) p.sliding -= dt;

    p.vy += PLAYER.gravity * dt;
    p.y += p.vy * dt;
    const height = p.sliding > 0 ? PLAYER.slideHeight : PLAYER.height;
    if (p.y >= FIELD.groundY - height) {
      p.y = FIELD.groundY - height;
      p.vy = 0;
      p.grounded = true;
      p.jumps = 0;
    } else {
      p.grounded = false;
    }
    if (p.invuln > 0) p.invuln -= dt;

    // --- scrolling and score ---
    state.distancePx += speed * dt;
    state.distance = state.distancePx / PX_PER_METRE;
    state.score += (speed * dt) / PX_PER_METRE;
    if (state.distance >= WIN_DISTANCE) {
      state.won = true;
      return events | EVENT_WIN;
    }

    // --- spawning ---
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnPattern();
      spawnTimer = intervalFor(state.level) * (0.85 + random() * 0.3);
    }
    petalTimer -= dt;
    if (petalTimer <= 0) {
      state.petals.push({ x: FIELD.width + 40, y: FIELD.groundY - 150 - random() * 120, r: SUNPETAL.radius, taken: false });
      petalTimer = SUNPETAL.everySeconds * (0.9 + random() * 0.3);
    }

    moveEntities(speed * dt);

    // --- trail particles while running ---
    trailTimer -= dt;
    if (p.grounded && trailTimer <= 0) {
      trailTimer = 0.06;
      state.particles.push({
        x: PLAYER.x + 6,
        y: FIELD.groundY - 4,
        vx: -30 - random() * 40,
        vy: -20 - random() * 30,
        life: 0.4,
        maxLife: 0.4,
        color: '#ffcf4d',
        size: 2 + random() * 2,
      });
    }
    updateParticles(dt);

    // --- collisions ---
    const rect = playerRect();
    for (const ob of state.obstacles) {
      if (ob.hit) continue;
      const box = ob.kind === KIND_MOTH
        ? { x: ob.x, y: ob.y + Math.sin(state.time * 6 + ob.phase) * MOTH.bob, w: ob.w, h: ob.h }
        : { x: ob.x, y: ob.y, w: ob.w, h: ob.h };
      if (!overlaps(rect, box)) continue;
      ob.hit = true;
      if (state.shield) {
        state.shield = false;
        p.invuln = PLAYER.invulnerableSeconds;
        burst(rect.x + rect.w / 2, rect.y + rect.h / 2, '#ff9ecf', 18, 220);
        events |= EVENT_SHIELD;
      } else if (p.invuln <= 0) {
        state.hearts -= 1;
        state.combo = 0;
        p.invuln = PLAYER.invulnerableSeconds;
        burst(rect.x + rect.w / 2, rect.y + rect.h / 2, '#ff6b6b', 20, 260);
        events |= EVENT_HIT;
        if (state.hearts <= 0) {
          state.over = true;
          return events | EVENT_OVER;
        }
      }
    }
    for (const spore of state.spores) {
      if (spore.taken) continue;
      const cx = Math.max(rect.x, Math.min(spore.x, rect.x + rect.w));
      const cy = Math.max(rect.y, Math.min(spore.y, rect.y + rect.h));
      const dx = spore.x - cx;
      const dy = spore.y - cy;
      if (dx * dx + dy * dy > spore.r * spore.r) continue;
      spore.taken = true;
      state.combo = Math.min(state.combo + 1, COMBO_MAX);
      state.score += SPORE.points * state.combo;
      burst(spore.x, spore.y, '#ffd76a', 10, 160);
      events |= EVENT_PICKUP;
    }
    for (const petal of state.petals) {
      if (petal.taken) continue;
      const cx = Math.max(rect.x, Math.min(petal.x, rect.x + rect.w));
      const cy = Math.max(rect.y, Math.min(petal.y, rect.y + rect.h));
      const dx = petal.x - cx;
      const dy = petal.y - cy;
      if (dx * dx + dy * dy > petal.r * petal.r) continue;
      petal.taken = true;
      state.shield = true;
      burst(petal.x, petal.y, '#ff9ecf', 16, 200);
      events |= EVENT_PETAL;
    }
    return events;
  }

  function moveEntities(dx) {
    for (const ob of state.obstacles) ob.x -= dx;
    for (const spore of state.spores) {
      spore.x -= dx;
      if (!spore.taken && spore.x < -40) {
        spore.taken = true;
        if (state.combo > 0) state.combo = 0;
      }
    }
    for (const petal of state.petals) {
      petal.x -= dx;
      if (!petal.taken && petal.x < -40) petal.taken = true;
    }
    for (const a of state.ambient) {
      a.x -= dx * 0.15;
      if (a.x < -10) {
        a.x = FIELD.width + 10;
        a.y = 60 + random() * 420;
      }
    }
    state.obstacles = state.obstacles.filter((ob) => ob.x > -120);
    state.spores = state.spores.filter((s) => s.x > -60 && !s.taken);
    state.petals = state.petals.filter((s) => s.x > -60 && !s.taken);
  }

  function updateParticles(dt) {
    for (const pt of state.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 120 * dt;
      pt.life -= dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
  }

  return { state, reset, step, playerRect, groundTop };
}
