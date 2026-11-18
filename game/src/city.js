// Solmar City: a procedurally generated coastal city on a street grid.
// Roads run every CFG.roadGap pixels; blocks between them hold buildings, a park,
// a plaza and parking lots. The south edge is sand and sea, with a pier.
import { CFG } from './config.js';
import { mulberry32, range, rangeInt, pick } from './rng.js';

const ROOF_COLORS = ['#b5543f', '#c98a4b', '#7d8aa0', '#5e7d6a', '#a05a7a', '#4f6d8f', '#8f7d4f', '#6a5f8f'];
const WALL_COLORS = ['#e8dcc8', '#d9c9a8', '#cbb9a0', '#e0d4b8', '#d4c2b2'];
const PALETTE = { grass: '#79a95b', grass2: '#6d9a52', sand: '#e3cd96', water: '#2f7fa8', waterDeep: '#256b92' };

export class City {
  constructor(seed) {
    this.seed = seed;
    const rand = mulberry32(seed);
    this.buildings = [];
    this.palms = [];
    this.lamps = [];
    this.parking = []; // {x, y, angle} parked-car spots
    this.park = { x: 1230, y: 1230, w: 240, h: 240 };
    this.plaza = { x: 2130, y: 630, w: 240, h: 240 };
    this.garage = { x: 1080, y: 780 }; // Rosa's garage marker
    this.hotel = { x: 2430, y: 780 }; // Grand Solmar hotel
    this.docks = { x: 330, y: 1830 }; // Marina docks pickup
    this.bank = { x: 1830, y: 480 }; // Solmar Bank
    this.hideout = { x: 2730, y: 1830 }; // Old Town hideout
    this.pier = { x: 1830, y: 2400, w: 90, len: 190 }; // pier deck into the sea
    this.hospital = { x: 630, y: 1080 };
    this.spawn = { x: 1050, y: 930 }; // on the road, beside Rosa's garage block

    // Street centrelines.
    this.vStreets = [];
    this.hStreets = [];
    for (let x = 150; x < CFG.worldW; x += CFG.roadGap) this.vStreets.push(x);
    for (let y = 150; y < CFG.beachTop; y += CFG.roadGap) this.hStreets.push(y);

    // Buildings: one or two per block, skipping the park, plaza and landmark blocks.
    const skip = (bx, by, bw, bh) => {
      const blocks = [this.park, this.plaza];
      for (const b of blocks) {
        if (bx < b.x + b.w && bx + bw > b.x && by < b.y + b.h && by + bh > b.y) return true;
      }
      return false;
    };
    for (let gy = 0; gy < this.hStreets.length - 1; gy++) {
      for (let gx = 0; gx < this.vStreets.length - 1; gx++) {
        const bx = this.vStreets[gx] + CFG.roadHalf + CFG.sidewalk + 8;
        const by = this.hStreets[gy] + CFG.roadHalf + CFG.sidewalk + 8;
        const bw = CFG.roadGap - 2 * (CFG.roadHalf + CFG.sidewalk) - 16;
        const bh = bw;
        if (bw < 60 || skip(bx, by, bw, bh)) continue;
        const tall = gy <= 2; // downtown towers in the north rows
        const h = tall ? rangeInt(rand, 26, 60) : rangeInt(rand, 10, 26);
        this.buildings.push({
          x: bx, y: by, w: bw, h: bh, height: h,
          roof: pick(rand, ROOF_COLORS), wall: pick(rand, WALL_COLORS),
          windows: rangeInt(rand, 2, 4),
        });
        // Parking spots along the south edge of some blocks.
        if (rand() < 0.5) {
          this.parking.push({ x: bx + bw / 2, y: by + bh + 26, angle: 0 });
        }
      }
    }

    // Palm trees along the beach and the park; lamps along streets.
    for (let x = 120; x < CFG.worldW; x += 130) {
      this.palms.push({ x: x + range(rand, -20, 20), y: CFG.beachTop + 42 + range(rand, 0, 30) });
    }
    for (let i = 0; i < 26; i++) {
      this.palms.push({ x: range(rand, this.park.x, this.park.x + this.park.w), y: range(rand, this.park.y, this.park.y + this.park.h) });
    }
    for (const sx of this.vStreets) {
      for (const sy of this.hStreets) {
        if (rand() < 0.6) this.lamps.push({ x: sx + CFG.roadHalf + 6, y: sy + CFG.roadHalf + 6 });
      }
    }
    this.rand = rand;
  }

  isWater(x, y) {
    return y >= CFG.waterTop && !(x > this.pier.x - this.pier.w / 2 && x < this.pier.x + this.pier.w / 2 && y < this.pier.y + this.pier.len);
  }

  isBeach(x, y) {
    return y >= CFG.beachTop && y < CFG.waterTop;
  }

  isRoad(x, y) {
    if (y >= CFG.beachTop) return false;
    for (const sx of this.vStreets) if (Math.abs(x - sx) <= CFG.roadHalf) return true;
    for (const sy of this.hStreets) if (Math.abs(y - sy) <= CFG.roadHalf) return true;
    return false;
  }

  inPark(x, y) {
    const p = this.park;
    return x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h;
  }

  buildingAt(x, y) {
    for (const b of this.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  // Push a circle out of buildings; returns true when a collision happened.
  collideCircle(p, r) {
    let hit = false;
    for (const b of this.buildings) {
      const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
      const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
      const dx = p.x - cx, dy = p.y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          p.x = cx + (dx / d) * r;
          p.y = cy + (dy / d) * r;
        } else {
          p.y = b.y - r;
        }
      }
    }
    return hit;
  }

  // Nearest point on the road network to (x, y) — used by traffic AI.
  nearestRoadPoint(x, y) {
    let best = null, bestD = Infinity;
    for (const sx of this.vStreets) {
      const d = Math.abs(x - sx);
      if (d < bestD) { bestD = d; best = { x: sx, y }; }
    }
    for (const sy of this.hStreets) {
      const d = Math.abs(y - sy);
      if (d < bestD) { bestD = d; best = { x, y: sy }; }
    }
    return best;
  }

  randomRoadPoint(rand) {
    if (rand() < 0.5) {
      return { x: pick(rand, this.vStreets), y: range(rand, 100, CFG.beachTop - 100) };
    }
    return { x: range(rand, 100, CFG.worldW - 100), y: pick(rand, this.hStreets) };
  }
}

export { PALETTE };
