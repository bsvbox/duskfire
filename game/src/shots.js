// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what a short game really looks like and the
// same seed always gives the same frame.
//
// The jump's timing matters: Pip is fixed on the screen while the world scrolls
// toward her, so a jump must start late — when the thorn is about a third of a
// second away — or she lands on it. The autopilot jumps thorns late, double
// jumps when a wide thorn is still under her, slides under moths only when no
// thorn is near, and chases spores only when the way ahead is clear.
import { FIELD, PLAYER, STEP, WIN_DISTANCE } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const LIMIT_SECONDS = 600;

/** Seconds until the player, running on, reaches the obstacle's front edge. */
function timeToReach(state, ob) {
  const gap = ob.x - (PLAYER.x + PLAYER.width);
  if (gap <= 0) return 0;
  return gap / state.speed;
}

/**
 * The autopilot. `nerve` shortens every reaction window, so the end scene's
 * pilot is caught out once the pace picks up, as a hurried player is.
 */
export function autopilot(state, nerve) {
  const p = state.player;
  let thorn = null;
  let thornTime = Infinity;
  let moth = null;
  let mothTime = Infinity;
  for (const ob of state.obstacles) {
    if (ob.hit || ob.x + ob.w < PLAYER.x) continue;
    const t = timeToReach(state, ob);
    if (ob.kind === 'moth') {
      if (t < mothTime) {
        mothTime = t;
        moth = ob;
      }
    } else if (t < thornTime) {
      thornTime = t;
      thorn = ob;
    }
  }
  // A moth about to arrive beats a thorn that is still a little further out:
  // slide under it, unless a thorn follows so closely that sliding would
  // trap Pip, in which case jump over the moth instead.
  if (moth && p.grounded) {
    if (mothTime < 0.9 * nerve && thornTime > 1.0) return { jump: false, dive: true };
    if (mothTime < 0.35 * nerve && thornTime < 0.8) return { jump: true, dive: false };
  }
  // A thorn about to arrive beats everything: jump it, late.
  if (thorn && thornTime < 0.3 * nerve) {
    if (p.grounded) return { jump: true, dive: false };
    // Airborne over a cluster: extend the flight once Pip is falling, so the
    // second jump's lift starts late and the whole flight outlasts the pair.
    // Firing on the way up wastes the double jump and drops her on the
    // second thorn.
    if (p.jumps === 1 && p.vy > 150 && thornTime < 0.5) return { jump: true, dive: false };
    return { jump: false, dive: false };
  }
  // Chase spores: jump when one floats above and the path ahead is clear.
  if (p.grounded && thornTime > 1.4 && mothTime > 1.4) {
    for (const spore of state.spores) {
      if (spore.taken) continue;
      const dx = spore.x - (PLAYER.x + PLAYER.width / 2);
      if (dx > 30 && dx < 170 && spore.y < FIELD.groundY - 70) return { jump: true, dive: false };
    }
  }
  return { jump: false, dive: false };
}

function runSteps(world, seconds, nerve, until) {
  let events = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const move = autopilot(world.state, nerve);
    events = world.step(STEP, move.jump, move.dive, move.dive, false);
    if (events & until) break;
  }
  return events;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. start: the title over a gently scrolling meadow. play:
 * mid-run with score, combo and hearts. win: the dawn screen after a full run.
 * end: the game-over screen after the pilot loses all three hearts.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'win' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, false, false, false, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'win') {
    runSteps(world, LIMIT_SECONDS, 1.0, EVENT_WIN);
    const won = world.state.won;
    return { screen: won ? SCREEN_WIN : SCREEN_PLAY, best: Math.floor(world.state.score) };
  }
  if (name === 'end') {
    runSteps(world, LIMIT_SECONDS, 0.32, EVENT_OVER);
    const over = world.state.over;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.floor(world.state.score) };
  }
  runSteps(world, PLAY_SECONDS, 1.0, EVENT_OVER);
  const over = world.state.over;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: Math.floor(world.state.score) };
}
