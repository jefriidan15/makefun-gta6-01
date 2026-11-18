// Entities: the player, cars (parked, traffic, police), pedestrians, bullets,
// pickups and particles. All movement, collisions and the wanted system live here;
// missions.js decides what they are asked to do, main.js owns the loop.
import { CFG, TUNE, CAR_MODELS } from './config.js';
import { clamp, dist2, angleDiff, angleTo, pick, range } from './rng.js';

export function makePlayer(city) {
  return {
    x: city.spawn.x, y: city.spawn.y, angle: -Math.PI / 2,
    vx: 0, vy: 0, health: TUNE.playerHealth, ammo: TUNE.ammoStart,
    inCar: null, shootCd: 0, invuln: 0, running: false,
  };
}

export function makeCar(x, y, angle, modelIdx, kind) {
  const m = CAR_MODELS[modelIdx];
  return {
    x, y, angle, speed: 0, model: m, modelIdx, kind, // 'parked' | 'traffic' | 'police' | 'player'
    target: null, wait: 0, stuck: 0, sirenPhase: Math.random() * 2,
    color: m.color, occupant: kind === 'traffic',
  };
}

export function spawnParkedCars(G, n) {
  const spots = G.city.parking;
  for (let i = 0; i < n && i < spots.length; i++) {
    const s = spots[(i * 2 + 1) % spots.length];
    const c = makeCar(s.x, s.y, s.angle + (G.rand() < 0.5 ? 0 : Math.PI), Math.floor(G.rand() * 5), 'parked');
    G.cars.push(c);
  }
}

export function spawnTraffic(G, n) {
  for (let i = 0; i < n; i++) {
    const p = G.city.randomRoadPoint(G.rand);
    const c = makeCar(p.x, p.y, G.rand() * Math.PI * 2, Math.floor(G.rand() * 5), 'traffic');
    c.target = G.city.randomRoadPoint(G.rand);
    G.cars.push(c);
  }
}

export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const p = G.city.randomRoadPoint(G.rand);
    G.peds.push(makePed(p.x, p.y, G, false));
  }
}

export function makePed(x, y, G, viper) {
  const colors = ['#e2725b', '#5b8de2', '#e2c25b', '#7ed07e', '#c25be2', '#e2e2e2'];
  return {
    x, y, angle: G.rand() * Math.PI * 2, speed: 0,
    color: viper ? '#3a3f4a' : colors[Math.floor(G.rand() * colors.length)],
    state: 'walk', // walk | flee | down | chase | shoot
    target: G.city.randomRoadPoint(G.rand),
    health: viper ? 70 : 100, viper: !!viper,
    shootCd: range(G.rand, 0.5, 1.5), downTimer: 0, panic: 0,
  };
}

export function spawnPolice(G, x, y) {
  const c = makeCar(x, y, angleTo(x, y, G.player.x, G.player.y), 5, 'police');
  c.speed = 120;
  G.cars.push(c);
  return c;
}

export function policeCount(G) {
  let n = 0;
  for (const c of G.cars) if (c.kind === 'police') n++;
  return n;
}

export function addWanted(G, n, reason) {
  const before = G.wanted;
  G.wanted = clamp(G.wanted + n, 0, TUNE.maxWanted);
  if (G.wanted > before) {
    G.wantedTimer = 0;
    G.toast(reason + ' — Wanted level ' + G.wanted, 2600);
    if (G.audio) G.audio.sirenStart();
    const want = Math.min(G.wanted, 2 + Math.floor(G.wanted / 2));
    while (policeCount(G) < want) {
      const a = G.rand() * Math.PI * 2;
      const d = 620 + G.rand() * 260;
      const px = clamp(G.player.x + Math.cos(a) * d, 80, CFG.worldW - 80);
      const py = clamp(G.player.y + Math.sin(a) * d, 80, CFG.beachTop - 80);
      const p = G.city.nearestRoadPoint(px, py);
      spawnPolice(G, p.x, p.y);
    }
  }
}

export function nearestCar(G, x, y, maxD) {
  let best = null, bestD = maxD * maxD;
  for (const c of G.cars) {
    const d = dist2(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function carPoint(c, t) {
  // Point t (-1 tail .. 1 nose) along the car body.
  return {
    x: c.x + Math.cos(c.angle) * t * (c.model.len / 2 - 6),
    y: c.y + Math.sin(c.angle) * t * (c.model.len / 2 - 6),
  };
}

function collideCarWithWorld(G, c) {
  let hit = false;
  for (const t of [1, -1]) {
    const p = carPoint(c, t);
    const before = { x: p.x, y: p.y };
    if (G.city.collideCircle(p, 13)) {
      hit = true;
      c.x += p.x - before.x; c.y += p.y - before.y;
    }
  }
  if (G.city.isWater(c.x, c.y)) {
    // Cars never enter the sea: push back along the beach.
    c.y = CFG.waterTop - 14;
    hit = true;
  }
  return hit;
}

function driveCar(G, c, throttle, steer, dt) {
  const m = c.model;
  const onRoad = G.city.isRoad(c.x, c.y);
  const maxSp = m.topSpeed * (onRoad ? 1 : 0.55);
  c.speed += throttle * m.accel * dt;
  c.speed -= c.speed * (onRoad ? 0.35 : 0.9) * dt; // drag
  c.speed = clamp(c.speed, -maxSp * 0.45, maxSp);
  if (Math.abs(c.speed) > 8) {
    c.angle += steer * c.model.grip * (c.speed / maxSp) * dt * (c.speed < 0 ? -1 : 1);
  }
  const nx = c.x + Math.cos(c.angle) * c.speed * dt;
  const ny = c.y + Math.sin(c.angle) * c.speed * dt;
  c.x = clamp(nx, 30, CFG.worldW - 30);
  c.y = clamp(ny, 30, CFG.worldH - 30);
  if (collideCarWithWorld(G, c)) {
    if (Math.abs(c.speed) > 140) {
      if (G.audio) G.audio.crash();
      sparks(G, c.x, c.y, 8, '#ffd76a');
      if (c.kind === 'player') G.player.health = Math.max(0, G.player.health - 4);
    }
    c.speed *= 0.45;
  }
}

export function updatePlayer(G, input, dt) {
  const p = G.player;
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.invuln = Math.max(0, p.invuln - dt);
  if (p.inCar) {
    const car = p.inCar;
    const ax = input.axes();
    const throttle = ax.y !== 0 ? -ax.y : 0; // W = forward
    const steer = ax.x;
    driveCar(G, car, throttle, steer, dt);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    if (G.audio) G.audio.engineSet(Math.abs(car.speed) / car.model.topSpeed, true);
    if (input.wasPressed('e', 'E')) exitCar(G);
    if (input.wasPressed(' ')) { if (G.audio) G.audio.horn(); }
    return;
  }
  if (G.audio) G.audio.engineSet(0, false);
  const ax = input.axes();
  p.running = input.down('Shift');
  const sp = (p.running ? TUNE.runSpeed : TUNE.walkSpeed);
  p.vx = ax.x * sp; p.vy = ax.y * sp;
  p.x = clamp(p.x + p.vx * dt, 20, CFG.worldW - 20);
  p.y = clamp(p.y + p.vy * dt, 20, CFG.worldH - 20);
  if (ax.x !== 0 || ax.y !== 0) p.angle = Math.atan2(ax.y, ax.x);
  const probe = { x: p.x, y: p.y };
  G.city.collideCircle(probe, TUNE.playerRadius);
  p.x = probe.x; p.y = probe.y;
  if (G.city.isWater(p.x, p.y)) { p.y = CFG.waterTop - TUNE.playerRadius; }
  // Aim at the mouse when firing; otherwise face movement.
  if (G.mouseWorld && (input.mouseDown || input.down(' '))) {
    p.angle = angleTo(p.x, p.y, G.mouseWorld.x, G.mouseWorld.y);
  }
  if ((input.mouseClicked || input.down(' ')) && p.shootCd <= 0) shoot(G, p);
  if (input.wasPressed('e', 'E')) tryEnterCar(G);
}

function shoot(G, p) {
  if (p.ammo <= 0) { G.toast('Out of ammo — find an ammo pickup', 1800); p.shootCd = 0.4; return; }
  p.ammo--;
  p.shootCd = TUNE.pistolCooldown;
  const a = p.angle;
  G.bullets.push({
    x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20,
    vx: Math.cos(a) * 780, vy: Math.sin(a) * 780,
    life: TUNE.pistolRange / 780, from: 'player', damage: TUNE.pistolDamage,
  });
  muzzle(G, p.x + Math.cos(a) * 22, p.y + Math.sin(a) * 22);
  if (G.audio) G.audio.shoot();
  if (G.wanted < 1) addWanted(G, 1, 'Shots fired');
  else if (G.wanted < 3) addWanted(G, 1, 'Shots fired');
}

function tryEnterCar(G) {
  const p = G.player;
  const car = nearestCar(G, p.x, p.y, 52);
  if (!car) { G.toast('No car close by', 1400); return; }
  if (car.kind === 'police') { G.toast('That is a cop car — bad idea', 1800); return; }
  const wasTraffic = car.kind === 'traffic';
  car.kind = 'player';
  car.occupant = false;
  p.inCar = car;
  G.stats.carsStolen++;
  if (wasTraffic) {
    // Stealing in front of witnesses draws the law.
    let seen = false;
    for (const ped of G.peds) if (dist2(ped.x, ped.y, p.x, p.y) < 260 * 260) { seen = true; break; }
    if (seen || G.wanted > 0) addWanted(G, 1, 'Car stolen');
    else G.toast('Stolen clean — nobody saw', 1800);
  } else {
    G.toast('Took the ' + car.model.name, 1600);
  }
  if (G.audio) { G.audio.engineStart(); G.audio.pickup(); }
}

function exitCar(G) {
  const p = G.player;
  const car = p.inCar;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0;
  p.inCar = null;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  const probe = { x: p.x, y: p.y };
  G.city.collideCircle(probe, TUNE.playerRadius);
  p.x = probe.x; p.y = probe.y;
}

export function updateCars(G, dt) {
  const p = G.player;
  for (const c of G.cars) {
    if (c.kind === 'player') continue; // driven in updatePlayer
    if (c.kind === 'parked') continue;
    if (c.kind === 'traffic') {
      if (!c.target || dist2(c.x, c.y, c.target.x, c.target.y) < 40 * 40) {
        c.target = G.city.randomRoadPoint(G.rand);
      }
      const want = angleTo(c.x, c.y, c.target.x, c.target.y);
      const steer = clamp(angleDiff(c.angle, want) * 1.6, -1, 1);
      // Slow down if another car is right ahead.
      let ahead = false;
      for (const o of G.cars) {
        if (o === c) continue;
        const d = dist2(c.x, c.y, o.x, o.y);
        if (d < 70 * 70) {
          const a = angleTo(c.x, c.y, o.x, o.y);
          if (Math.abs(angleDiff(c.angle, a)) < 0.5) { ahead = true; break; }
        }
      }
      driveCar(G, c, ahead ? -0.4 : 0.55, steer, dt);
      c.speed = clamp(c.speed, 0, 130);
    } else if (c.kind === 'police') {
      const want = angleTo(c.x, c.y, p.x, p.y);
      const steer = clamp(angleDiff(c.angle, want) * 2.2, -1, 1);
      const distP = Math.sqrt(dist2(c.x, c.y, p.x, p.y));
      const throttle = distP > 60 ? 1 : 0.4;
      driveCar(G, c, throttle, steer, dt);
      // Ramming the player hurts; cornering them on foot busts them.
      if (distP < 46) {
        if (p.inCar) {
          if (Math.abs(c.speed) > 60) {
            p.health = Math.max(0, p.health - TUNE.copRamDamage * dt * 0.8);
            if (G.audio && Math.random() < 0.1) G.audio.crash();
          }
          // Shove the player's car.
          p.inCar.x += Math.cos(c.angle) * 26 * dt;
          p.inCar.y += Math.sin(c.angle) * 26 * dt;
        } else if (G.wanted > 0 && p.invuln <= 0) {
          G.bustTimer += dt;
          if (G.bustTimer > TUNE.copBustSecs) G.busted = true;
        }
      }
    }
  }
  // Car-vs-car soft push so traffic does not stack.
  for (let i = 0; i < G.cars.length; i++) {
    for (let j = i + 1; j < G.cars.length; j++) {
      const a = G.cars[i], b = G.cars[j];
      const d2 = dist2(a.x, a.y, b.x, b.y);
      if (d2 < 44 * 44 && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = (44 - d) / 2;
        const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
        if (a.kind !== 'player') { a.x -= nx * push; a.y -= ny * push; }
        if (b.kind !== 'player') { b.x += nx * push; b.y += ny * push; }
        if (a.kind === 'player' || b.kind === 'player') {
          if (Math.abs(a.speed - b.speed) > 120 && G.audio) G.audio.crash();
        }
      }
    }
  }
  // Car running over a pedestrian: they go down, and the law notices.
  for (const c of G.cars) {
    if (c.kind === 'parked' || Math.abs(c.speed) < 40) continue;
    for (const ped of G.peds) {
      if (ped.state === 'down' || ped.viper) continue;
      if (dist2(c.x, c.y, ped.x, ped.y) < 34 * 34) {
        ped.state = 'down';
        ped.downTimer = 6;
        ped.health = 40;
        sparks(G, ped.x, ped.y, 6, '#ffffff');
        if (c.kind === 'player' || c.kind === 'police') {
          addWanted(G, 1, 'Pedestrian hit');
        }
      }
    }
  }
}

export function updatePeds(G, dt) {
  for (const ped of G.peds) {
    ped.shootCd -= dt;
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) { ped.state = 'flee'; ped.panic = 3; }
      continue;
    }
    const p = G.player;
    const dP = Math.sqrt(dist2(ped.x, ped.y, p.x, p.y));
    if (ped.viper) {
      // Vipers hunt the player once the brawl starts.
      if (G.missionActive === 'pier-brawl' && dP < 700) {
        ped.state = dP > 260 ? 'chase' : 'shoot';
      } else if (G.missionActive !== 'pier-brawl') {
        ped.state = 'walk';
      }
      if (ped.state === 'chase') {
        ped.angle = angleTo(ped.x, ped.y, p.x, p.y);
        ped.x += Math.cos(ped.angle) * 150 * dt;
        ped.y += Math.sin(ped.angle) * 150 * dt;
      } else if (ped.state === 'shoot' && ped.shootCd <= 0) {
        ped.shootCd = range(G.rand, 1.2, 2.0);
        const a = angleTo(ped.x, ped.y, p.x, p.y) + range(G.rand, -0.12, 0.12);
        G.bullets.push({
          x: ped.x + Math.cos(a) * 18, y: ped.y + Math.sin(a) * 18,
          vx: Math.cos(a) * 640, vy: Math.sin(a) * 640,
          life: 0.7, from: 'viper', damage: 7,
        });
        muzzle(G, ped.x + Math.cos(a) * 20, ped.y + Math.sin(a) * 20);
        if (dP < 700 && G.audio) G.audio.shoot();
      }
      if (ped.state === 'walk') wander(G, ped, dt, 70);
      continue;
    }
    if (ped.panic > 0) {
      ped.panic -= dt;
      ped.state = 'flee';
      const a = angleTo(G.dangerX ?? p.x, G.dangerY ?? p.y, ped.x, ped.y);
      ped.angle = a;
      ped.x += Math.cos(a) * 200 * dt;
      ped.y += Math.sin(a) * 200 * dt;
    } else {
      ped.state = 'walk';
      wander(G, ped, dt, 55);
    }
    const probe = { x: ped.x, y: ped.y };
    G.city.collideCircle(probe, 10);
    ped.x = clamp(probe.x, 20, CFG.worldW - 20);
    ped.y = clamp(probe.y, 20, CFG.beachTop - 20);
  }
  // Keep the streets populated.
  if (G.peds.length < TUNE.pedCount && G.rand() < 0.02) {
    const pt = G.city.randomRoadPoint(G.rand);
    if (dist2(pt.x, pt.y, G.player.x, G.player.y) > 500 * 500) G.peds.push(makePed(pt.x, pt.y, G, false));
  }
}

function wander(G, ped, dt, speed) {
  if (!ped.target || dist2(ped.x, ped.y, ped.target.x, ped.target.y) < 30 * 30) {
    ped.target = G.city.randomRoadPoint(G.rand);
  }
  const a = angleTo(ped.x, ped.y, ped.target.x, ped.target.y);
  ped.angle = a;
  ped.x += Math.cos(a) * speed * dt;
  ped.y += Math.sin(a) * speed * dt;
}

export function updateBullets(G, dt) {
  const p = G.player;
  for (let i = G.bullets.length - 1; i >= 0; i--) {
    const b = G.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && G.city.buildingAt(b.x, b.y)) { dead = true; sparks(G, b.x, b.y, 4, '#ffd76a'); }
    if (!dead && b.from === 'player') {
      for (const ped of G.peds) {
        if (ped.state === 'down') continue;
        if (dist2(b.x, b.y, ped.x, ped.y) < 18 * 18) {
          dead = true;
          ped.health -= b.damage;
          sparks(G, b.x, b.y, 6, '#ff5b5b');
          if (ped.health <= 0) {
            ped.state = 'down'; ped.downTimer = 9999;
            if (ped.viper) {
              G.vipersDown++;
              dropPickup(G, ped.x, ped.y, G.rand() < 0.5 ? 'cash' : 'ammo');
              G.toast('Viper down — ' + G.vipersDown + '/5', 1600);
            } else {
              addWanted(G, 1, 'Pedestrian shot');
            }
          } else if (!ped.viper) {
            ped.panic = 4; G.dangerX = p.x; G.dangerY = p.y;
          }
          break;
        }
      }
      if (!dead) {
        for (const c of G.cars) {
          if (c.kind === 'player' || c.kind === 'parked') continue;
          if (dist2(b.x, b.y, c.x, c.y) < 30 * 30) {
            dead = true; sparks(G, b.x, b.y, 4, '#ffd76a');
            if (c.kind === 'police') addWanted(G, 1, 'Shot at police');
            break;
          }
        }
      }
    }
    if (!dead && (b.from === 'viper')) {
      const inCar = p.inCar;
      const tx = inCar ? inCar.x : p.x, ty = inCar ? inCar.y : p.y;
      const r = inCar ? 30 : 16;
      if (dist2(b.x, b.y, tx, ty) < r * r && p.invuln <= 0) {
        dead = true;
        p.health = Math.max(0, p.health - b.damage);
        p.invuln = 0.25;
        sparks(G, b.x, b.y, 5, '#ff5b5b');
      }
    }
    if (dead) G.bullets.splice(i, 1);
  }
}

export function dropPickup(G, x, y, kind) {
  G.pickups.push({ x, y, kind, bob: G.rand() * 6 });
}

export function updatePickups(G, dt) {
  const p = G.player;
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const pk = G.pickups[i];
    pk.bob += dt;
    const tx = p.inCar ? p.inCar.x : p.x, ty = p.inCar ? p.inCar.y : p.y;
    if (dist2(pk.x, pk.y, tx, ty) < 40 * 40) {
      if (pk.kind === 'cash') { const v = 50 + Math.floor(G.rand() * 100); G.cash += v; G.toast('Picked up ' + '$' + v, 1500); if (G.audio) G.audio.cash(); }
      if (pk.kind === 'health') { p.health = Math.min(TUNE.playerHealth, p.health + 35); G.toast('Health +35', 1500); if (G.audio) G.audio.pickup(); }
      if (pk.kind === 'ammo') { p.ammo += 12; G.toast('Ammo +12', 1500); if (G.audio) G.audio.pickup(); }
      G.pickups.splice(i, 1);
    }
  }
}

export function sparks(G, x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = G.rand() * Math.PI * 2;
    const s = 60 + G.rand() * 160;
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35 + G.rand() * 0.3, color, size: 2 + G.rand() * 3 });
  }
}

export function muzzle(G, x, y) {
  G.particles.push({ x, y, vx: 0, vy: 0, life: 0.08, color: '#ffe9a8', size: 9 });
}

export function updateParticles(G, dt) {
  for (let i = G.particles.length - 1; i >= 0; i--) {
    const pt = G.particles[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.92; pt.vy *= 0.92;
    pt.life -= dt;
    if (pt.life <= 0) G.particles.splice(i, 1);
  }
  if (G.particles.length > 400) G.particles.splice(0, G.particles.length - 400);
}
