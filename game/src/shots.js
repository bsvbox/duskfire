// The screenshot scenes behind ?shot=start|play|win|end. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot, so the frame is what a short game really looks like and the
// same seed always gives the same frame. The autopilot looks ahead: it jumps
// when a thorn is about to arrive, slides when a moth is about to arrive, and
// chases spores when the way is clear.
import { FIELD, PLAYER, STEP, WIN_DISTANCE } from './config.js';
import { EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 24;
const LIMIT_SECONDS = 600;
const SAMPLE = 1 / 30;

/** Seconds until the player, running on, reaches the obstacle's front edge. */
function timeToReach(state, ob) {
  const gap = ob.x - (PLAYER.x + PLAYER.width);
  if (gap <= 0) return 0;
  return gap / state.speed;
}

/**
 * The autopilot: jump for thorns, slide for moths, chase the nearest low spore
 * when nothing dangerous is near. `nerve` shortens the reaction window, so the
 * end scene's pilot is caught out once the pace picks up, as a hurried player is.
 */
function autopilot(state, nerve) {
  const p = state.player;
  let danger = null;
  let dangerTime = Infinity;
  for (const ob of state.obstacles) {
    if (ob.hit || ob.x + ob.w < PLAYER.x) continue;
    const t = timeToReach(state, ob);
    if (t < dangerTime) {
      dangerTime = t;
      danger = ob;
    }
  }
  if (danger && dangerTime < 0.55 * nerve) {
    if (danger.kind === 'moth') return { jump: false, dive: true };
    if (p.grounded) return { jump: true, dive: false };
    return { jump: false, dive: false };
  }
  if (danger && danger.kind === 'moth' && dangerTime < 0.9 * nerve && p.grounded) {
    return { jump: false, dive: true };
  }
  // Chase spores: jump when one floats above and the path ahead is clear.
  if (p.grounded && (!danger || dangerTime > 0.9)) {
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
