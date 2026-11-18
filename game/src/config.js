// Solmar Heat — configuration: world size, tuning, names, car models, missions.
// Everything here is original: Solmar City, its streets, people and cars are invented
// for this game and share nothing with any commercial game.
export const CFG = {
  worldW: 3600,
  worldH: 2600,
  roadGap: 300, // distance between street centrelines
  roadHalf: 34, // half width of a road
  sidewalk: 14, // sidewalk strip beside each road
  beachTop: 2280, // sand starts here; water below y = 2440
  waterTop: 2440,
  tile: 60,
};

export const TUNE = {
  walkSpeed: 175,
  runSpeed: 265,
  playerRadius: 13,
  playerHealth: 100,
  pistolDamage: 34,
  pistolRange: 420,
  pistolCooldown: 0.28,
  ammoStart: 24,
  wantedDecaySecs: 26,
  copRamDamage: 9,
  copBustSecs: 1.4,
  trafficCount: 14,
  pedCount: 42,
  maxWanted: 5,
  dayLengthSecs: 420, // full in-game day
};

export const CAR_MODELS = [
  { name: 'Vela', color: '#e8b23a', topSpeed: 330, accel: 210, grip: 2.6, len: 46, wid: 22 },
  { name: 'Comet GT', color: '#d23b3b', topSpeed: 430, accel: 265, grip: 3.1, len: 48, wid: 22 },
  { name: 'Bruto', color: '#3f6fb5', topSpeed: 300, accel: 185, grip: 2.3, len: 52, wid: 24 },
  { name: 'Solmar Taxi', color: '#f2c230', topSpeed: 350, accel: 220, grip: 2.7, len: 47, wid: 22 },
  { name: 'Marlin', color: '#2fb5a5', topSpeed: 390, accel: 240, grip: 2.9, len: 47, wid: 22 },
  { name: 'Patrol Interceptor', color: '#22262e', topSpeed: 400, accel: 280, grip: 3.3, len: 49, wid: 23 },
];

export const DISTRICTS = [
  { name: 'Downtown Solmar', x: 900, y: 500, w: 1500, h: 800 },
  { name: 'Marina', x: 300, y: 1500, w: 900, h: 700 },
  { name: 'Old Town', x: 2400, y: 1500, w: 900, h: 700 },
  { name: 'Solmar Beach', x: 300, y: 2280, w: 3000, h: 320 },
];

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: '1 — First Wheels',
    giver: 'Rosa',
    brief: 'New in Solmar? Everybody drives. Take any car on the street — quick, before its owner notices — and bring it to my garage.',
    objective: 'Steal a car and drive it to Rosa\'s garage',
    reward: 300,
  },
  {
    id: 'sunset-courier',
    title: '2 — Sunset Courier',
    giver: 'Rosa',
    brief: 'A package is waiting at the Marina docks. The buyer is at the Grand Solmar hotel, and he does not wait. Two and a half minutes.',
    objective: 'Pick up the package at the docks, deliver it to the hotel',
    reward: 600,
    timeLimit: 150,
  },
  {
    id: 'pier-brawl',
    title: '3 — Pier Brawl',
    giver: 'Rosa',
    brief: 'The Vipers think the pier is theirs. Go down there and change their minds. They are armed — so are you.',
    objective: 'Defeat the Vipers on the pier (0/5)',
    reward: 900,
  },
  {
    id: 'heat-run',
    title: '4 — Heat Run',
    giver: 'Rosa',
    brief: 'Somebody talked. The whole Solmar PD is rolling. Lose them and get to the hideout under the Old Town bridge.',
    objective: 'Lose the police and reach the hideout',
    reward: 1200,
  },
  {
    id: 'solmar-job',
    title: '5 — The Solmar Job',
    giver: 'Rosa',
    brief: 'One job and we are done being small. The Solmar Bank vault, then gone before the sirens even start. Bring the cash home.',
    objective: 'Grab the cash at Solmar Bank, then escape to the hideout',
    reward: 2500,
  },
];

export const CONTACTS = {
  rosa: { name: 'Rosa Delgado', role: 'Fixer — Rosa\'s Garage, Downtown' },
  vipers: { name: 'The Vipers', role: 'Rival crew — Solmar Pier' },
};

export const SAVE_KEY = 'solmar-heat-save-v1';
