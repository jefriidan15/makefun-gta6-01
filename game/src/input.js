// Input: keyboard + mouse state, with edge-triggered "pressed" helpers.
// Keys: WASD/arrows move, E enter/exit car, Shift run, Space or click shoot,
// M mute, P/Esc pause, Enter confirm on menus.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mouseClicked = false;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!this.keys.has(e.key)) this.pressed.add(e.key);
      this.keys.add(e.key);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
    canvas.addEventListener('mousemove', (e) => {
      const r = canvas.getBoundingClientRect();
      this.mouseX = e.clientX - r.left;
      this.mouseY = e.clientY - r.top;
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; }
    });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(...keys) {
    return keys.some((k) => this.keys.has(k));
  }

  wasPressed(...keys) {
    return keys.some((k) => this.pressed.has(k));
  }

  // Movement axes: -1..1 on each axis from WASD/arrows.
  axes() {
    let x = 0, y = 0;
    if (this.down('a', 'A', 'ArrowLeft')) x -= 1;
    if (this.down('d', 'D', 'ArrowRight')) x += 1;
    if (this.down('w', 'W', 'ArrowUp')) y -= 1;
    if (this.down('s', 'S', 'ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
    return { x, y };
  }

  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
