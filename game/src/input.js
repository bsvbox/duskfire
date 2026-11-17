// Keyboard and pointer input. One-shot presses (jump, dive, start, pause, mute) are
// queued as bit flags and taken once by the loop, so a press between two frames is
// never lost and never counted twice. Holding Down keeps Pip low; holding a jump
// key does nothing extra, the double jump comes from a second press.
export const ACTION_JUMP = 1;
export const ACTION_DIVE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_PAUSE = 8;
export const ACTION_MUTE = 16;

const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);
const DIVE = new Set(['ArrowDown', 'KeyS']);
const CONFIRM = new Set(['Enter', 'KeyR']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(target) {
  let downHeld = false;
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    if (JUMP.has(event.code)) {
      if (!event.repeat) actions |= ACTION_JUMP;
    } else if (DIVE.has(event.code)) {
      downHeld = true;
      if (!event.repeat) actions |= ACTION_DIVE;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (DIVE.has(event.code)) downHeld = false;
  });
  // A key released while the tab is hidden never sends keyup: let go on blur.
  window.addEventListener('blur', () => {
    downHeld = false;
  });
  // A click (or tap) is a jump; the start and restart buttons are canvas-drawn,
  // so the whole canvas is the jump surface.
  target.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    actions |= ACTION_JUMP;
  });

  return {
    /** True while the dive key is held down. */
    get downHeld() {
      return downHeld;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
