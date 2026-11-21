// NIGHTJAR — input. One clear job: keyboard and mouse into one frame of
// intent. Held keys are read every step; pressed keys are consumed once.
export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let click = null;

  const input = {
    mx: 0,
    my: 0,
    sneak: false,
    sprint: false,
    click: null,
    useSmoke: false,
    whistle: false,
    retry: false,
    menu: false,
    pause: false,
    confirm: false,
    up: false,
    down: false,
  };

  function code(e) {
    return e.code;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    click = { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  });

  function consume(codeName) {
    if (pressed.has(codeName)) { pressed.delete(codeName); return true; }
    return false;
  }

  /** Read the current frame's intent and clear the one-shot presses. */
  input.poll = () => {
    let mx = 0;
    let my = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) my -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) my += 1;
    const len = Math.hypot(mx, my) || 1;
    input.mx = mx / len;
    input.my = my / len;
    input.sneak = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.sprint = keys.has('Space');
    input.click = click;
    click = null;
    input.useSmoke = consume('KeyF');
    input.whistle = consume('KeyE');
    input.retry = consume('KeyR');
    input.menu = consume('KeyM');
    input.pause = consume('Escape');
    input.confirm = consume('Enter') || consume('NumpadEnter');
    input.up = consume('ArrowUp') || consume('KeyW');
    input.down = consume('ArrowDown') || consume('KeyS');
    return input;
  };

  return input;
}
