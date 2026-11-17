// Every pixel Duskfire shows: the night sky and its slow warming toward dawn,
// the parallax hills, the ground, the thorn bushes and night moths, the glowing
// spores and sunpetals, Pip the firefly with her light trail, the HUD, and the
// four screens (title, play, paused, dawn won, night won). All art is drawn
// with canvas shapes; there are no image files.
import { FIELD, FONT, PALETTE, PLAYER, WIN_DISTANCE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'win';
export const SCREEN_OVER = 'over';

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRgb(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = FIELD.width;
  canvas.height = FIELD.height;

  // Fixed star field, so every run paints the same sky.
  const stars = [];
  let s = 1234567;
  for (let i = 0; i < 130; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const x = (s / 0x7fffffff) * FIELD.width;
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const y = (s / 0x7fffffff) * 380;
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    stars.push({ x, y, r: 0.6 + (s / 0x7fffffff) * 1.4, tw: (s / 0x7fffffff) * Math.PI * 2 });
  }
  // Fixed grass tufts, placed along the ground.
  const tufts = [];
  for (let i = 0; i < 60; i += 1) tufts.push({ x: i * 47 + 13, h: 8 + (i % 5) * 3 });

  function ridge(offset, baseY, amp, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, FIELD.height);
    for (let x = 0; x <= FIELD.width; x += 16) {
      const wx = x + offset;
      const y = baseY + Math.sin(wx * 0.008) * amp + Math.sin(wx * 0.021 + 1.7) * amp * 0.5;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(FIELD.width, FIELD.height);
    ctx.closePath();
    ctx.fill();
  }

  function glowCircle(x, y, radius, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawSky(state, screen) {
    const progress = screen === SCREEN_WIN ? 1 : Math.min(1, state.distance / WIN_DISTANCE);
    const warm = progress * 0.55 + (screen === SCREEN_WIN ? 0.45 : 0);
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    g.addColorStop(0, mix(PALETTE.skyTop, PALETTE.dawnTop, warm));
    g.addColorStop(0.55, mix(PALETTE.skyMid, PALETTE.dawnMid, warm));
    g.addColorStop(1, mix(PALETTE.skyLow, PALETTE.dawnLow, warm));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    for (const star of stars) {
      const twinkle = 0.5 + 0.5 * Math.sin(state.time * 1.4 + star.tw);
      ctx.globalAlpha = (1 - warm * 0.8) * (0.35 + 0.65 * twinkle);
      ctx.fillStyle = PALETTE.star;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // The moon, high on the right; it sinks as dawn approaches.
    const moonX = 1080;
    const moonY = 110 + progress * 90;
    glowCircle(moonX, moonY, 90, 'rgba(244, 234, 208, 0.35)', 0.8);
    ctx.fillStyle = PALETTE.moon;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(190, 180, 150, 0.5)';
    ctx.beginPath();
    ctx.arc(moonX - 12, moonY - 8, 8, 0, Math.PI * 2);
    ctx.arc(moonX + 10, moonY + 12, 6, 0, Math.PI * 2);
    ctx.fill();
    if (screen === SCREEN_WIN || progress > 0.75) {
      const sunY = 150 - progress * 60;
      glowCircle(1080, sunY, 130, 'rgba(255, 190, 90, 0.5)', 0.9);
      ctx.fillStyle = '#ffe9b0';
      ctx.beginPath();
      ctx.arc(1080, sunY, 46, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGround(state) {
    const offFar = (state.distancePx * 0.2) % 640;
    const offNear = (state.distancePx * 0.45) % 640;
    ridge(-offFar, 560, 26, PALETTE.hillFar);
    ridge(-offFar + 640, 560, 26, PALETTE.hillFar);
    ridge(-offNear, 596, 18, PALETTE.hillNear);
    ridge(-offNear + 640, 596, 18, PALETTE.hillNear);
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, FIELD.groundY, FIELD.width, FIELD.height - FIELD.groundY);
    ctx.fillStyle = PALETTE.groundTop;
    ctx.fillRect(0, FIELD.groundY, FIELD.width, 5);
    ctx.strokeStyle = PALETTE.grass;
    ctx.lineWidth = 2;
    const scroll = state.distancePx % 47;
    for (const tuft of tufts) {
      let x = tuft.x - scroll;
      if (x < -20) x += 47 * 60;
      ctx.beginPath();
      ctx.moveTo(x, FIELD.groundY + 2);
      ctx.lineTo(x - 3, FIELD.groundY - tuft.h);
      ctx.moveTo(x + 4, FIELD.groundY + 2);
      ctx.lineTo(x + 7, FIELD.groundY - tuft.h * 0.8);
      ctx.stroke();
    }
  }

  function drawThorn(ob) {
    const spikes = 5;
    ctx.fillStyle = PALETTE.thorn;
    ctx.strokeStyle = PALETTE.thornEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ob.x, ob.y + ob.h);
    for (let i = 0; i <= spikes; i += 1) {
      const x = ob.x + (i / spikes) * ob.w;
      const peak = ob.y + (i % 2 === 0 ? 0 : ob.h * 0.55);
      ctx.lineTo(x, peak);
    }
    ctx.lineTo(ob.x + ob.w, ob.y + ob.h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // A faint purple glint on the tips, so thorns read as danger, not decor.
    ctx.fillStyle = PALETTE.thornEdge;
    for (let i = 1; i < spikes; i += 2) {
      const x = ob.x + (i / spikes) * ob.w;
      ctx.beginPath();
      ctx.arc(x, ob.y + ob.h * 0.55, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMoth(ob, time) {
    const y = ob.y + Math.sin(time * 6 + ob.phase) * 12;
    const flap = Math.sin(time * 14 + ob.phase) * 0.7;
    ctx.fillStyle = PALETTE.mothWing;
    ctx.save();
    ctx.translate(ob.x + ob.w / 2, y + ob.h / 2);
    ctx.rotate(flap * 0.5);
    ctx.beginPath();
    ctx.ellipse(-12, -6, 16, 8, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(-flap);
    ctx.beginPath();
    ctx.ellipse(12, -6, 16, 8, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.moth;
    ctx.beginPath();
    ctx.ellipse(ob.x + ob.w / 2, y + ob.h / 2, 8, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8c8ff';
    ctx.beginPath();
    ctx.arc(ob.x + ob.w / 2 - 3, y + ob.h / 2 - 4, 1.8, 0, Math.PI * 2);
    ctx.arc(ob.x + ob.w / 2 + 3, y + ob.h / 2 - 4, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSpore(spore, time) {
    const pulse = 1 + Math.sin(time * 4 + spore.phase) * 0.15;
    glowCircle(spore.x, spore.y, spore.r * 3 * pulse, 'rgba(255, 215, 106, 0.4)', 0.8);
    ctx.fillStyle = PALETTE.spore;
    ctx.beginPath();
    ctx.arc(spore.x, spore.y, spore.r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.sporeCore;
    ctx.beginPath();
    ctx.arc(spore.x, spore.y, spore.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPetal(petal, time) {
    const pulse = 1 + Math.sin(time * 3) * 0.12;
    glowCircle(petal.x, petal.y, 44 * pulse, 'rgba(255, 158, 207, 0.4)', 0.9);
    ctx.fillStyle = PALETTE.petal;
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2 + time * 0.6;
      ctx.beginPath();
      ctx.arc(petal.x + Math.cos(a) * 10, petal.y + Math.sin(a) * 10, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fff0f7';
    ctx.beginPath();
    ctx.arc(petal.x, petal.y, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state) {
    const p = state.player;
    const sliding = p.sliding > 0;
    const height = sliding ? PLAYER.slideHeight : PLAYER.height;
    const x = PLAYER.x + PLAYER.width / 2;
    const y = FIELD.groundY - height / 2;
    const blink = p.invuln > 0 && Math.floor(state.time * 12) % 2 === 0;
    const bob = p.grounded ? Math.sin(state.time * 10) * 1.5 : 0;
    const flap = Math.sin(state.time * (p.grounded ? 18 : 30)) * 0.6;

    // Light trail and halo.
    glowCircle(x, y + bob, 70, 'rgba(255, 207, 77, 0.35)', sliding ? 0.5 : 0.9);
    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    // Wings.
    ctx.fillStyle = 'rgba(220, 230, 255, 0.75)';
    ctx.save();
    ctx.translate(x, y + bob - 8);
    ctx.rotate(-0.5 - flap * 0.4);
    ctx.beginPath();
    ctx.ellipse(-8, -8, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(x, y + bob - 8);
    ctx.rotate(0.5 + flap * 0.4);
    ctx.beginPath();
    ctx.ellipse(8, -8, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Body.
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.ellipse(x, y + bob, sliding ? 20 : 15, sliding ? 8 : 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a12';
    ctx.beginPath();
    ctx.arc(x + 8, y + bob - 4, 2.2, 0, Math.PI * 2);
    ctx.fill();
    // Antennae.
    ctx.strokeStyle = '#3a2a12';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + bob - 10);
    ctx.quadraticCurveTo(x + 16, y + bob - 18, x + 20, y + bob - 16);
    ctx.moveTo(x + 6, y + bob - 11);
    ctx.quadraticCurveTo(x + 10, y + bob - 20, x + 14, y + bob - 19);
    ctx.stroke();
    ctx.restore();

    // Shield ring.
    if (state.shield) {
      ctx.strokeStyle = 'rgba(255, 158, 207, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y + bob, 34 + Math.sin(state.time * 3) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawParticles(state) {
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawAmbient(state) {
    for (const a of state.ambient) {
      const pulse = 0.4 + 0.6 * Math.abs(Math.sin(state.time * a.speed + a.phase));
      glowCircle(a.x, a.y + Math.sin(state.time * a.speed + a.phase) * 6, 12, 'rgba(255, 220, 120, 0.5)', pulse * 0.7);
    }
  }

  function heart(x, y, size, filled) {
    ctx.fillStyle = filled ? '#ff6b81' : 'rgba(255, 255, 255, 0.18)';
    ctx.beginPath();
    ctx.moveTo(x, y + size * 0.9);
    ctx.bezierCurveTo(x - size, y + size * 0.1, x - size * 0.55, y - size * 0.7, x, y - size * 0.15);
    ctx.bezierCurveTo(x + size * 0.55, y - size * 0.7, x + size, y + size * 0.1, x, y + size * 0.9);
    ctx.fill();
  }

  function drawHud(state, best, muted) {
    const progress = Math.min(1, state.distance / WIN_DISTANCE);
    ctx.textBaseline = 'alphabetic';
    // Score, top left.
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 44px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.floor(state.score)}`, 28, 58);
    ctx.font = `500 17px ${FONT}`;
    ctx.fillStyle = PALETTE.muted;
    ctx.fillText(`BEST ${Math.max(best, Math.floor(state.score))}`, 30, 86);
    // Hearts, top left under the score.
    for (let i = 0; i < 3; i += 1) heart(44 + i * 34, 108, 11, i < state.hearts);
    // Level badge.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.roundRect(28, 132, 92, 30, 15);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`LEVEL ${state.level}`, 74, 153);
    // Dawn progress, top centre: a bar from night to the sun.
    const barX = 440;
    const barW = 400;
    const barY = 34;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, 12, 6);
    ctx.fill();
    const fill = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    fill.addColorStop(0, '#6b4fae');
    fill.addColorStop(1, '#ffd28a');
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.roundRect(barX, barY, Math.max(12, barW * progress), 12, 6);
    ctx.fill();
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🌙', barX - 34, barY + 15);
    ctx.fillText('☀️', barX + barW + 8, barY + 15);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 16px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.floor(state.distance)}m / ${WIN_DISTANCE}m to dawn`, barX + barW / 2, barY + 36);
    // Combo badge.
    if (state.combo >= 2) {
      ctx.fillStyle = 'rgba(255, 215, 106, 0.92)';
      ctx.beginPath();
      ctx.roundRect(1080, 28, 130, 34, 17);
      ctx.fill();
      ctx.fillStyle = '#3a2a12';
      ctx.font = `700 19px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(`COMBO x${state.combo}`, 1145, 51);
    }
    // Shield note and mute state, bottom corners.
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 15px ${FONT}`;
    if (state.shield) ctx.fillText('🌸 Shield ready — one free hit', 28, 700);
    ctx.textAlign = 'right';
    ctx.fillText(muted ? 'M — sound off' : 'M — sound on · P — pause', 1252, 700);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(12, 9, 26, 0.72)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function titleText(text, y, size, color, weight = 700) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(text, FIELD.width / 2, y);
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(8, 6, 20, 0.45)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(290, 110, 700, 470);
    glowCircle(640, 215, 120, 'rgba(255, 207, 77, 0.25)', 0.9);
    titleText('DUSKFIRE', 235, 84, PALETTE.player);
    titleText('a firefly\u2019s run to dawn', 272, 24, PALETTE.muted, 500);
    titleText('Run 1500m through the night meadow before dawn breaks.', 330, 21, PALETTE.text, 500);
    titleText('Catch spores to score — chains build your combo.', 362, 21, PALETTE.text, 500);
    titleText('Jump thorns, slide under night moths. Three hearts.', 394, 21, PALETTE.text, 500);
    titleText('SPACE / ↑ / CLICK — jump (twice for double jump)', 448, 20, PALETTE.text, 600);
    titleText('↓ / S — dive and slide · P — pause · M — sound', 478, 20, PALETTE.text, 600);
    titleText('A pink sunpetal shields you from one hit.', 508, 20, PALETTE.muted, 500);
    if (best > 0) titleText(`Best score: ${best}`, 542, 20, PALETTE.spore, 600);
    titleText('PRESS SPACE OR CLICK TO START', 556, 22, PALETTE.player);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8, 6, 20, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    titleText('PAUSED', 330, 64, PALETTE.text);
    titleText('Press P or Space to keep running', 390, 22, PALETTE.muted, 500);
  }

  function drawWin(state, best) {
    ctx.fillStyle = 'rgba(255, 190, 110, 0.12)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(330, 130, 620, 380);
    titleText('☀️  DAWN BREAKS  ☀️', 235, 56, '#ffd28a');
    titleText('You made it, Pip. The meadow wakes.', 285, 23, PALETTE.text, 500);
    titleText(`Score  ${Math.floor(state.score)}`, 350, 34, PALETTE.player);
    titleText(`Best  ${Math.max(best, Math.floor(state.score))}`, 392, 22, PALETTE.muted, 600);
    titleText(`1500m in ${Math.round(state.time)}s · Level ${state.level}`, 428, 20, PALETTE.muted, 500);
    titleText('PRESS R OR CLICK TO RUN AGAIN', 478, 22, PALETTE.player);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(8, 6, 20, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(330, 140, 620, 360);
    titleText('THE NIGHT WINS', 245, 56, PALETTE.danger);
    titleText('Pip\u2019s light fades — but fireflies always try again.', 295, 22, PALETTE.text, 500);
    titleText(`Score  ${Math.floor(state.score)}`, 355, 34, PALETTE.player);
    titleText(`Best  ${Math.max(best, Math.floor(state.score))}`, 397, 22, PALETTE.muted, 600);
    titleText(`Distance  ${Math.floor(state.distance)}m of 1500m`, 433, 20, PALETTE.muted, 500);
    titleText('PRESS R OR CLICK TO TRY AGAIN', 472, 22, PALETTE.player);
  }

  function draw(state, screen, best, muted) {
    drawSky(state, screen);
    drawGround(state);
    drawAmbient(state);
    for (const spore of state.spores) drawSpore(spore, state.time);
    for (const petal of state.petals) drawPetal(petal, state.time);
    for (const ob of state.obstacles) {
      if (ob.kind === 'moth') drawMoth(ob, state.time);
      else drawThorn(ob);
    }
    drawParticles(state);
    if (screen !== SCREEN_TITLE) drawPlayer(state);
    else drawPlayer(state);
    // Hit flash: a red edge while the invulnerability window opens.
    if (state.player.invuln > PLAYER.invulnerableSeconds - 0.25 && state.player.invuln > 0) {
      ctx.fillStyle = 'rgba(255, 60, 60, 0.14)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best, muted);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_WIN) drawWin(state, best);
    else if (screen === SCREEN_OVER) drawOver(state, best);
  }

  return { draw };
}
