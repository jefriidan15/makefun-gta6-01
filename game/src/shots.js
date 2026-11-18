// Screenshot presets: deterministic staged scenes (?shot=cover|street|pier|dusk)
// so the entry's screenshots are real renders of the game with its systems visible:
// a police chase, on-foot downtown, the pier brawl, and a sunset beach drive.
import { CFG } from './config.js';
import { startMission } from './missions.js';
import { makeCar, spawnPolice } from './entities.js';
import { clamp } from './rng.js';

function placePlayerInCar(G, x, y, angle, modelIdx) {
  const car = makeCar(x, y, angle, modelIdx, 'player');
  G.cars.push(car);
  G.player.inCar = car;
  G.player.x = x; G.player.y = y; G.player.angle = angle;
  car.speed = 260;
  return car;
}

function chasePolice(G, offsets) {
  G.wanted = offsets.length;
  for (const [dx, dy] of offsets) {
    const px = clamp(G.player.x + dx, 80, CFG.worldW - 80);
    const py = clamp(G.player.y + dy, 80, CFG.beachTop - 80);
    const p = G.city.nearestRoadPoint(px, py);
    const c = spawnPolice(G, p.x, p.y);
    c.speed = 300;
  }
}

function clearTraffic(G) {
  G.cars = G.cars.filter((c) => c.kind === 'player' || c.kind === 'police');
  G.peds = G.peds.filter((p) => p.viper);
}

export function applyShot(G, name) {
  const p = G.player;
  G.shotMode = true;
  if (name === 'cover') {
    // Downtown chase: Comet GT, 3 stars, two interceptors on the tail, Heat Run live.
    G.timeOfDay = 16.8;
    clearTraffic(G);
    placePlayerInCar(G, 1530, 750, 0, 1);
    chasePolice(G, [[-160, 90], [-260, -60]]);
    // A little traffic ahead for depth.
    const t1 = makeCar(1830, 750, 0, 0, 'traffic'); t1.speed = 120; G.cars.push(t1);
    const t2 = makeCar(1530, 450, Math.PI / 2, 3, 'traffic'); t2.speed = 110; G.cars.push(t2);
    startMission(G, 3); // Heat Run
    G.cash = 2450;
  } else if (name === 'street') {
    // On foot in Downtown at midday, traffic and pedestrians all around.
    G.timeOfDay = 11.5;
    p.x = 1500; p.y = 750; p.angle = 0.4;
    p.health = 100; p.ammo = 24;
    G.cash = 320;
    startMission(G, 0); // First Wheels
    const near = makeCar(1560, 780, 0, 4, 'parked');
    G.cars.push(near);
  } else if (name === 'pier') {
    // The pier brawl mid-fight: two Vipers down, three closing in.
    G.timeOfDay = 15.2;
    p.x = G.city.pier.x; p.y = G.city.pier.y + 150; p.angle = -Math.PI / 2;
    p.health = 100; p.ammo = 24;
    G.cash = 1180;
    startMission(G, 2); // Pier Brawl
    G.vipersDown = 2;
    let down = 0;
    for (const ped of G.peds) {
      if (!ped.viper) continue;
      if (down < 2) { ped.state = 'down'; ped.downTimer = 9999; down++; }
      else { ped.x = G.city.pier.x - 40 + down * 24; ped.y = G.city.pier.y + 60; }
    }
  } else if (name === 'dusk') {
    // Sunset drive along the beach road, 2 stars, one interceptor behind.
    G.timeOfDay = 18.4;
    clearTraffic(G);
    placePlayerInCar(G, 1050, 2250, 0, 4);
    chasePolice(G, [[-190, 40]]);
    const t1 = makeCar(1350, 2250, 0, 2, 'traffic'); t1.speed = 130; G.cars.push(t1);
    G.cash = 1875;
    p.health = 92;
  } else {
    return false;
  }
  return true;
}

export const SHOT_NAMES = ['cover', 'street', 'pier', 'dusk'];
