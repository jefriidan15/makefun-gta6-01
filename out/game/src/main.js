// Solmar Heat — main loop and state machine.
// Menu -> playing -> paused / busted / wasted, with autosave, toasts, the HUD,
// the minimap and the ?shot= presets. All original: Solmar City, Jax, Rosa,
// the Vipers and every car, street and job are invented for this game.
import { CFG, TUNE, DISTRICTS, MISSIONS } from './config.js';
import { mulberry32 } from './rng.js';
import { City } from './city.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { loadSave, writeSave, clearSave } from './save.js';
import {
  makePlayer, spawnParkedCars, spawnTraffic, spawnPeds,
  updatePlayer, updateCars, updatePeds, updateBullets,
  updatePickups, updateParticles, dropPickup,
} from './entities.js';
import { missionMarker, currentObjective, updateMissions, startMission, missionCount } from './missions.js';
import { makeCamera, updateCamera, drawWorld, drawMinimap, updateHUD } from './render.js';
import { applyShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');

const dom = {
  cash: document.getElementById('hud-cash'),
  stars: document.getElementById('hud-stars'),
  healthFill: document.getElementById('hud-health-fill'),
  healthText: document.getElementById('hud-health-text'),
  ammo: document.getElementById('hud-ammo'),
  speed: document.getElementById('hud-speed'),
  clock: document.getElementById('hud-clock'),
  objective: document.getElementById('hud-objective'),
  timer: document.getElementById('hud-timer'),
  minimapLabel: document.getElementById('hud-mission-label'),
  mute: document.getElementById('hud-mute'),
  toast: document.getElementById('hud-toast'),
  menu: document.getElementById('menu'),
  menuTitle: document.getElementById('menu-title'),
  menuStory: document.getElementById('menu-story'),
  menuSave: document.getElementById('menu-save'),
  pause: document.getElementById('pause'),
  end: document.getElementById('end'),
  endTitle: document.getElementById('end-title'),
  endText: document.getElementById('end-text'),
};

const params = new URLSearchParams(location.search);
const seed = Number(params.get('seed') || 20261118);
const shot = params.get('shot') || '';

const G = {
  seed,
  rand: mulberry32(seed),
  city: new City(seed),
  districts: DISTRICTS,
  time: 0, // seconds since load (drives flashing/pulsing)
  timePlayed: 0,
  timeOfDay: 10.0, // 10:00 morning
  cash: 150,
  wanted: 0,
  wantedTimer: 0,
  bustTimer: 0,
  busted: false,
  player: null,
  cars: [],
  peds: [],
  bullets: [],
  pickups: [],
  particles: [],
  missionIndex: 0,
  mission: null,
  missionActive: null,
  missionReady: true,
  completed: [],
  storyDone: false,
  vipersDown: 0,
  dangerX: 0, dangerY: 0,
  stats: { carsStolen: 0, bustedCount: 0, wastedCount: 0 },
  toasts: [],
  shotMode: false,
  lastSideJobAt: 0,
  audio: new AudioSys(),
  marker: null,
  objective: '',
  mouseWorld: { x: 0, y: 0 },
};

G.toast = (text, ms = 2400) => {
  G.toasts.push({ text, until: G.timePlayed + ms / 1000 });
  if (G.toasts.length > 4) G.toasts.shift();
  dom.toast.textContent = text;
  dom.toast.classList.add('show');
  clearTimeout(G.toast._t);
  G.toast._t = setTimeout(() => dom.toast.classList.remove('show'), ms);
};

G.player = makePlayer(G.city);
spawnParkedCars(G, 10);
spawnTraffic(G, TUNE.trafficCount);
spawnPeds(G, TUNE.pedCount);
// A few pickups scattered in the world to find.
dropPickup(G, 1350, 930, 'health');
dropPickup(G, 2430, 1050, 'ammo');
dropPickup(G, 630, 1650, 'cash');

const input = new Input(canvas);
const cam = makeCamera(canvas.width, canvas.height);
let state = 'menu'; // menu | playing | paused | busted | wasted
let saveTimer = 0;
let last = performance.now();

function show(el, on) { el.classList.toggle('hidden', !on); }

function startGame(fresh) {
  G.audio.ensure();
  G.audio.engineStart();
  show(dom.menu, false);
  show(dom.pause, false);
  show(dom.end, false);
  state = 'playing';
  if (fresh) G.toast("Welcome to Solmar — steal a car, then visit Rosa's garage", 4200);
}

function loadIntoGame(save) {
  G.cash = save.cash ?? 150;
  G.missionIndex = save.missionIndex ?? 0;
  G.completed = Array.isArray(save.completed) ? save.completed : [];
  G.storyDone = G.missionIndex >= missionCount();
  G.missionReady = true;
  G.player.x = save.px ?? G.city.spawn.x;
  G.player.y = save.py ?? G.city.spawn.y;
  G.player.health = save.health ?? TUNE.playerHealth;
  G.player.ammo = save.ammo ?? TUNE.ammoStart;
  G.stats.carsStolen = save.carsStolen || 0;
  G.stats.bustedCount = save.bustedCount || 0;
  G.stats.wastedCount = save.wastedCount || 0;
  G.timePlayed = save.timePlayed || 0;
}

function respawn(reason) {
  const p = G.player;
  if (p.inCar) { p.inCar.kind = 'parked'; p.inCar.speed = 0; p.inCar = null; }
  p.x = G.city.hospital.x; p.y = G.city.hospital.y;
  p.health = TUNE.playerHealth;
  p.invuln = 2;
  G.wanted = 0;
  G.bustTimer = 0;
  G.busted = false;
  G.cars = G.cars.filter((c) => c.kind !== 'police');
  const fine = reason === 'busted' ? Math.min(G.cash, 100) : Math.min(G.cash, 150);
  G.cash -= fine;
  if (reason === 'busted') { G.stats.bustedCount++; G.audio.busted(); }
  else { G.stats.wastedCount++; G.audio.wasted(); }
  writeSave(G);
}

function endScreen(kind) {
  state = kind;
  const fine = kind === 'busted' ? 100 : 150;
  dom.endTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
  dom.endTitle.style.color = kind === 'busted' ? '#4dabf7' : '#fa5252';
  dom.endText.textContent = kind === 'busted'
    ? 'The Solmar PD caught up with you. Bail is $' + fine + ' — Rosa is already working on it.'
    : 'You went down in Solmar. The hospital patched you up for $' + fine + ' — the city is still yours.';
  show(dom.end, true);
}

function togglePause() {
  if (state === 'playing') { state = 'paused'; show(dom.pause, true); writeSave(G); }
  else if (state === 'paused') { state = 'playing'; show(dom.pause, false); }
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  if (dt <= 0) dt = 0.001;
  G.time += dt;

  // Mouse position in world coordinates (canvas is scaled by CSS).
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
  G.mouseWorld.x = cam.x + input.mouseX * sx;
  G.mouseWorld.y = cam.y + input.mouseY * sy;

  if (state === 'playing') {
    G.timePlayed += dt;
    G.timeOfDay = (G.timeOfDay + (dt / TUNE.dayLengthSecs) * 24) % 24;
    updatePlayer(G, input, dt);
    updateCars(G, dt);
    updatePeds(G, dt);
    updateBullets(G, dt);
    updatePickups(G, dt);
    updateParticles(G, dt);
    updateMissions(G, dt);
    G.marker = missionMarker(G);
    G.objective = currentObjective(G);
    if (G.audio) {
      G.audio.sirenSet(G.wanted > 0, G.time);
      G.audio.musicTick(dt, true);
    }
    saveTimer += dt;
    if (saveTimer > 15) { saveTimer = 0; writeSave(G); }
    if (G.busted) { respawn('busted'); endScreen('busted'); }
    else if (G.player.health <= 0) { respawn('wasted'); endScreen('wasted'); }
    if (input.wasPressed('p', 'P', 'Escape')) togglePause();
    if (input.wasPressed('m', 'M')) { G.audio.ensure(); const m = G.audio.toggleMute(); G.toast(m ? 'Sound off' : 'Sound on', 1200); }
  } else if (state === 'menu') {
    // Slow drift over the city behind the title screen.
    const t = G.time * 0.008;
    updateCamera(cam, 900 + Math.sin(t) * 700, 900 + Math.cos(t * 0.7) * 500);
    G.marker = null;
  } else if (state === 'paused') {
    if (input.wasPressed('p', 'P', 'Escape')) togglePause();
    if (input.wasPressed('m', 'M')) { const m = G.audio.toggleMute(); G.toast(m ? 'Sound off' : 'Sound on', 1200); }
  } else if (state === 'busted' || state === 'wasted') {
    if (input.wasPressed('Enter', ' ')) { show(dom.end, false); state = 'playing'; }
  }

  if (state !== 'menu') updateCamera(cam, G.player.x, G.player.y);
  drawWorld(ctx, G, cam);
  drawMinimap(mctx, G, mini.width, mini.height);
  if (state !== 'menu') updateHUD(G, dom);
  input.endFrame();
  if (!window.__solmarReady) {
    window.__solmarReady = true;
    window.__solmar = G;
    document.title = 'Solmar Heat — ready';
  }
}

// ---- Menu wiring ----
const saved = loadSave();
if (saved) {
  dom.menuSave.textContent = 'Save found: ' + fmtMoney(saved.cash) + ', mission ' + Math.min((saved.missionIndex ?? 0) + 1, 5) + '/5 — Continue picks it up.';
  document.getElementById('btn-continue').classList.remove('hidden');
}
document.getElementById('btn-start').addEventListener('click', () => {
  clearSave();
  G.cash = 150; G.missionIndex = 0; G.completed = []; G.storyDone = false;
  G.missionReady = true;
  startGame(true);
});
document.getElementById('btn-continue').addEventListener('click', () => {
  if (saved) loadIntoGame(saved);
  startGame(false);
});
document.getElementById('btn-resume').addEventListener('click', togglePause);
document.getElementById('btn-quit').addEventListener('click', () => {
  writeSave(G);
  show(dom.pause, false);
  state = 'menu';
  show(dom.menu, true);
});
document.getElementById('btn-end').addEventListener('click', () => {
  show(dom.end, false);
  state = 'playing';
});
dom.mute.addEventListener('click', () => {
  G.audio.ensure();
  const m = G.audio.toggleMute();
  G.toast(m ? 'Sound off' : 'Sound on', 1200);
});

// Screenshot presets start the game immediately, no menu.
if (shot) {
  show(dom.menu, false);
  if (applyShot(G, shot)) {
    G.audio.ensure();
    state = 'playing';
    document.title = 'Solmar Heat — shot ' + shot;
  } else {
    document.title = 'Solmar Heat — unknown shot';
  }
}

function fmtMoney(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

requestAnimationFrame(frame);
