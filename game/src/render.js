// Rendering: the camera, the city, cars, people, effects, the HUD and the minimap.
// All art is drawn with canvas primitives — no image files, nothing fetched.
import { CFG, TUNE } from './config.js';
import { clamp, fmtMoney, fmtClock } from './rng.js';
import { PALETTE } from './city.js';

export function makeCamera(viewW, viewH) {
  return { x: 0, y: 0, w: viewW, h: viewH, zoom: 1 };
}

export function updateCamera(cam, tx, ty) {
  cam.x = clamp(tx - cam.w / 2, 0, CFG.worldW - cam.w);
  cam.y = clamp(ty - cam.h / 2, 0, CFG.worldH - cam.h);
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(ctx, G, cam) {
  const { x: vx, y: vy, w: vw, h: vh } = cam;
  ctx.save();
  ctx.clearRect(0, 0, vw, vh);
  // Ground.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(0, 0, vw, vh);
  // Mow stripes for the big lawns (cheap checker).
  ctx.fillStyle = PALETTE.grass2;
  const ts = 120;
  for (let gy = Math.floor(vy / ts) * ts; gy < vy + vh; gy += ts) {
    for (let gx = Math.floor(vx / ts) * ts; gx < vx + vw; gx += ts) {
      if (((gx / ts) + (gy / ts)) % 2 === 0) ctx.fillRect(gx - vx, gy - vy, ts, ts);
    }
  }
  // Beach + sea.
  ctx.fillStyle = PALETTE.sand;
  ctx.fillRect(0, CFG.beachTop - vy, vw, CFG.waterTop - CFG.beachTop);
  ctx.fillStyle = PALETTE.water;
  ctx.fillRect(0, CFG.waterTop - vy, vw, CFG.worldH - CFG.waterTop);
  ctx.fillStyle = PALETTE.waterDeep;
  for (let i = 0; i < 6; i++) {
    const wy = CFG.waterTop + 30 + i * 22;
    ctx.fillRect(0, wy - vy, vw, 3);
  }
  // Park + plaza.
  ctx.fillStyle = '#5d8a4a';
  ctx.fillRect(G.city.park.x - vx, G.city.park.y - vy, G.city.park.w, G.city.park.h);
  ctx.fillStyle = '#c9b896';
  ctx.fillRect(G.city.plaza.x - vx, G.city.plaza.y - vy, G.city.plaza.w, G.city.plaza.h);
  ctx.strokeStyle = '#a89468';
  ctx.lineWidth = 3;
  ctx.strokeRect(G.city.plaza.x - vx, G.city.plaza.y - vy, G.city.plaza.w, G.city.plaza.h);

  // Roads: asphalt, sidewalks, centre dashes.
  ctx.fillStyle = '#3c3f45';
  for (const sx of G.city.vStreets) ctx.fillRect(sx - CFG.roadHalf - vx, 0, CFG.roadHalf * 2, CFG.beachTop - vy);
  for (const sy of G.city.hStreets) ctx.fillRect(0, sy - CFG.roadHalf - vy, CFG.worldW, CFG.roadHalf * 2);
  ctx.fillStyle = '#9a938a';
  for (const sx of G.city.vStreets) {
    ctx.fillRect(sx - CFG.roadHalf - CFG.sidewalk - vx, 0, CFG.sidewalk, CFG.beachTop - vy);
    ctx.fillRect(sx + CFG.roadHalf - vx, 0, CFG.sidewalk, CFG.beachTop - vy);
  }
  for (const sy of G.city.hStreets) {
    ctx.fillRect(0, sy - CFG.roadHalf - CFG.sidewalk - vy, CFG.worldW, CFG.sidewalk);
    ctx.fillRect(0, sy + CFG.roadHalf - vy, CFG.worldW, CFG.sidewalk);
  }
  ctx.fillStyle = '#e8d44f';
  for (const sx of G.city.vStreets) {
    for (let y = 0; y < CFG.beachTop; y += 46) ctx.fillRect(sx - 2 - vx, y - vy, 4, 22);
  }
  for (const sy of G.city.hStreets) {
    for (let x = 0; x < CFG.worldW; x += 46) ctx.fillRect(x - vx, sy - 2 - vy, 22, 4);
  }

  // Pier deck.
  const pier = G.city.pier;
  ctx.fillStyle = '#8a6b45';
  ctx.fillRect(pier.x - pier.w / 2 - vx, pier.y - vy, pier.w, pier.len);
  ctx.fillStyle = '#a5855c';
  for (let y = pier.y; y < pier.y + pier.len; y += 26) ctx.fillRect(pier.x - pier.w / 2 - vx, y - vy, pier.w, 3);

  // Buildings: shadow, walls, roof, windows.
  for (const b of G.city.buildings) {
    if (b.x > vx + vw || b.x + b.w < vx || b.y > vy + vh || b.y + b.h < vy) continue;
    const bx = b.x - vx, by = b.y - vy;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(bx + 6, by + 8, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(bx, by, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(bx + 5, by + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    const cols = Math.max(2, Math.floor(b.w / 34));
    const rows = Math.max(2, Math.floor(b.h / 34));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.fillRect(bx + 12 + i * ((b.w - 24) / cols), by + 12 + j * ((b.h - 24) / rows), 7, 7);
      }
    }
    if (b.height > 30) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(bx + b.w / 2 - 14, by + b.h / 2 - 14, 28, 28);
    }
  }

  // Palms and lamps.
  for (const pl of G.city.palms) {
    if (pl.x < vx || pl.x > vx + vw || pl.y < vy || pl.y > vy + vh) continue;
    const px = pl.x - vx, py = pl.y - vy;
    ctx.strokeStyle = '#7a5a34'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 3, py - 12); ctx.stroke();
    ctx.fillStyle = '#3f8f3f';
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.4;
      ctx.beginPath(); ctx.ellipse(px + 3 + Math.cos(a) * 8, py - 12 + Math.sin(a) * 5, 9, 3.5, a, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.fillStyle = '#2c2f36';
  for (const l of G.city.lamps) {
    if (l.x < vx || l.x > vx + vw || l.y < vy || l.y > vy + vh) continue;
    ctx.fillRect(l.x - vx - 2, l.y - vy - 2, 4, 4);
  }

  // Landmark labels (skipped when they would cover the player).
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(20,24,32,0.75)';
  const nearPlayer = (lx, ly) => Math.abs(lx - G.player.x) < 110 && Math.abs(ly - G.player.y) < 90;
  if (!nearPlayer(G.city.garage.x, G.city.garage.y)) label(ctx, "Rosa's Garage", G.city.garage.x - vx, G.city.garage.y - 24 - vy);
  if (!nearPlayer(G.city.hotel.x, G.city.hotel.y)) label(ctx, 'Grand Solmar', G.city.hotel.x - vx, G.city.hotel.y - 24 - vy);
  if (!nearPlayer(G.city.bank.x, G.city.bank.y)) label(ctx, 'Solmar Bank', G.city.bank.x - vx, G.city.bank.y - 24 - vy);
  if (!nearPlayer(G.city.docks.x, G.city.docks.y)) label(ctx, 'Marina Docks', G.city.docks.x - vx, G.city.docks.y - 24 - vy);
  if (!nearPlayer(G.city.hideout.x, G.city.hideout.y)) label(ctx, 'Hideout', G.city.hideout.x - vx, G.city.hideout.y - 24 - vy);
  if (!nearPlayer(pier.x, pier.y)) label(ctx, 'Solmar Pier', pier.x - vx, pier.y + 12 - vy);
  label(ctx, 'Solmar Beach', 700 - vx, CFG.beachTop + 18 - vy);

  drawMarker(ctx, G, cam);
  drawPickups(ctx, G, cam);
  for (const ped of G.peds) drawPed(ctx, ped, cam);
  for (const c of G.cars) drawCar(ctx, c, cam, G.time);
  drawPlayer(ctx, G, cam);
  drawBullets(ctx, G, cam);
  drawParticles(ctx, G, cam);

  // Time-of-day tint: amber dusk, dark blue night.
  const t = G.timeOfDay;
  if (t >= 17 && t < 19.5) {
    ctx.fillStyle = 'rgba(255,140,50,0.18)';
    ctx.fillRect(0, 0, vw, vh);
  } else if (t >= 19.5 || t < 6) {
    ctx.fillStyle = 'rgba(10,16,60,0.30)';
    ctx.fillRect(0, 0, vw, vh);
    // Lamp glow at night.
    ctx.fillStyle = 'rgba(255,220,120,0.20)';
    for (const l of G.city.lamps) {
      if (l.x < vx || l.x > vx + vw || l.y < vy || l.y > vy + vh) continue;
      ctx.beginPath(); ctx.arc(l.x - vx, l.y - vy, 16, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function label(ctx, text, x, y) {
  const w = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  rr(ctx, x - w / 2 - 6, y - 13, w + 12, 19, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,24,32,0.85)';
  ctx.fillText(text, x - w / 2, y);
}

export function drawMarker(ctx, G, cam) {
  const m = G.marker;
  if (!m) return;
  const pulse = 1 + Math.sin(G.timePlayed * 4) * 0.12;
  const x = m.x - cam.x, y = m.y - cam.y;
  ctx.save();
  ctx.strokeStyle = '#ffd23e';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(x, y, m.r * pulse, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,210,62,0.16)';
  ctx.beginPath(); ctx.arc(x, y, m.r * pulse, 0, Math.PI * 2); ctx.fill();
  // Light beam.
  const grad = ctx.createLinearGradient(x, y - 190, x, y);
  grad.addColorStop(0, 'rgba(255,210,62,0)');
  grad.addColorStop(1, 'rgba(255,210,62,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - 9, y - 190, 18, 190);
  ctx.font = 'bold 14px system-ui, sans-serif';
  const w = ctx.measureText(m.label).width;
  ctx.fillStyle = 'rgba(20,24,32,0.8)';
  rr(ctx, x - w / 2 - 7, y - m.r - 34, w + 14, 22, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd23e';
  ctx.fillText(m.label, x - w / 2, y - m.r - 19);
  ctx.restore();
}

function drawPickups(ctx, G, cam) {
  for (const pk of G.pickups) {
    const x = pk.x - cam.x, y = pk.y - cam.y + Math.sin(pk.bob * 3) * 3;
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fillStyle = pk.kind === 'cash' ? '#2f9e44' : pk.kind === 'health' ? '#e03131' : '#1971c2';
    ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'cash' ? '$' : pk.kind === 'health' ? '+' : 'A', x, y + 5);
    ctx.restore();
  }
}

function drawPed(ctx, ped, cam) {
  const x = ped.x - cam.x, y = ped.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(0, 4, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
  if (ped.state === 'down') {
    ctx.rotate(ped.angle);
    ctx.fillStyle = ped.color;
    rr(ctx, -11, -5, 22, 10, 5); ctx.fill();
    ctx.restore();
    return;
  }
  ctx.fillStyle = ped.color;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 4.5, 0, Math.PI * 2); ctx.fill();
  if (ped.viper) {
    ctx.strokeStyle = '#ff3b30'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#222';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ped.angle) * 16, Math.sin(ped.angle) * 16); ctx.stroke();
  }
  ctx.restore();
}

function drawCar(ctx, c, cam, time) {
  const x = c.x - cam.x, y = c.y - cam.y;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(c.angle);
  const L = c.model.len, W = c.model.wid;
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  rr(ctx, -L / 2 + 4, -W / 2 + 5, L, W, 7); ctx.fill();
  ctx.fillStyle = c.color;
  rr(ctx, -L / 2, -W / 2, L, W, 7); ctx.fill();
  ctx.fillStyle = 'rgba(20,28,40,0.85)';
  rr(ctx, -L / 2 + 9, -W / 2 + 4, L * 0.34, W - 8, 4); ctx.fill(); // windshield + rear glass
  rr(ctx, L * 0.08, -W / 2 + 4, L * 0.3, W - 8, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(L / 2 - 2, -W / 2 + 3, 3, 5); // headlights
  ctx.fillRect(L / 2 - 2, W / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff2d2d';
  ctx.fillRect(-L / 2, -W / 2 + 3, 3, 5); // tail lights
  ctx.fillRect(-L / 2, W / 2 - 8, 3, 5);
  if (c.kind === 'police') {
    const flash = Math.floor(time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-4, -W / 2 + 2, 8, 6);
    ctx.fillStyle = flash ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(-4, W / 2 - 8, 8, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PD', 0, 3);
  }
  if (c.model.name === 'Solmar Taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -W / 2 - 4, 12, 5);
  }
  ctx.restore();
}

function drawPlayer(ctx, G, cam) {
  const p = G.player;
  const x = p.x - cam.x, y = p.y - cam.y;
  if (p.inCar) return; // drawn as the car
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(0, 5, 11, 6, 0, 0, Math.PI * 2); ctx.fill();
  if (p.invuln > 0 && Math.floor(G.timePlayed * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.fillStyle = '#f2a541'; // Jax's jacket
  ctx.beginPath(); ctx.arc(0, 0, TUNE.playerRadius - 2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 4, Math.sin(p.angle) * 4, 5, 0, Math.PI * 2); ctx.fill();
  // Aiming arm + pistol.
  ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(p.angle) * 18, Math.sin(p.angle) * 18); ctx.stroke();
  ctx.restore();
}

function drawBullets(ctx, G, cam) {
  ctx.fillStyle = '#ffe9a8';
  for (const b of G.bullets) {
    ctx.beginPath(); ctx.arc(b.x - cam.x, b.y - cam.y, 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawParticles(ctx, G, cam) {
  for (const pt of G.particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 2.4);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x - cam.x, pt.y - cam.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---- HUD (DOM) ----
export function updateHUD(G, dom) {
  const p = G.player;
  dom.cash.textContent = fmtMoney(G.cash);
  dom.stars.textContent = '★'.repeat(G.wanted) + '☆'.repeat(TUNE.maxWanted - G.wanted);
  dom.stars.style.color = G.wanted > 0 ? '#ffd23e' : 'rgba(255,255,255,0.35)';
  dom.healthFill.style.width = Math.max(0, p.health) + '%';
  dom.healthFill.style.background = p.health > 50 ? '#40c057' : p.health > 25 ? '#fab005' : '#fa5252';
  dom.healthText.textContent = Math.ceil(Math.max(0, p.health)) + ' HP';
  dom.ammo.textContent = p.inCar ? '—' : 'Ammo ' + p.ammo;
  const car = p.inCar;
  dom.speed.textContent = car ? Math.round(Math.abs(car.speed) * 0.22) + ' km/h · ' + car.model.name : 'On foot';
  dom.clock.textContent = fmtClock(G.timeOfDay * 3600) + '  ·  ' + districtAt(G, p.x, p.y);
  dom.objective.textContent = G.objective || '';
  dom.timer.textContent = G.mission && G.mission.timer > 0 ? '⏱ ' + Math.ceil(G.mission.timer) + 's' : '';
  dom.minimapLabel.textContent = G.storyDone ? 'SOLMAR — story complete' : 'Mission ' + Math.min(G.missionIndex + 1, 5) + '/5';
  dom.mute.textContent = G.audio && G.audio.muted ? '🔇 Muted (M)' : '🔊 Sound (M)';
}

function districtAt(G, x, y) {
  if (y >= CFG.beachTop) return 'Solmar Beach';
  for (const d of G.districts) {
    if (x >= d.x && x <= d.x + d.w && y >= d.y && y <= d.y + d.h) return d.name;
  }
  return 'Solmar City';
}

export function drawMinimap(ctx, G, w, h) {
  const sx = w / CFG.worldW, sy = h / CFG.worldH;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#2f7fa8';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#e3cd96';
  ctx.fillRect(0, CFG.beachTop * sy, w, (CFG.waterTop - CFG.beachTop) * sy);
  ctx.fillStyle = '#79a95b';
  ctx.fillRect(0, 0, w, CFG.beachTop * sy);
  ctx.fillStyle = '#3c3f45';
  for (const vx of G.city.vStreets) ctx.fillRect(vx * sx - 1, 0, 2, CFG.beachTop * sy);
  for (const hy of G.city.hStreets) ctx.fillRect(0, hy * sy - 1, w, 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (const b of G.city.buildings) ctx.fillRect(b.x * sx, b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  if (G.marker) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(G.marker.x * sx, G.marker.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(G.marker.x * sx, G.marker.y * sy, 8 + Math.sin(G.timePlayed * 4) * 2, 0, Math.PI * 2); ctx.stroke();
  }
  for (const c of G.cars) {
    if (c.kind !== 'police') continue;
    ctx.fillStyle = '#ff2d2d';
    ctx.beginPath(); ctx.arc(c.x * sx, c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  const p = G.player;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.beginPath(); ctx.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2); ctx.stroke();
  // View frame.
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.strokeRect(0, 0, w - 1, h - 1);
}
