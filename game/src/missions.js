// Missions: Rosa's five-job story chain, plus repeatable courier side jobs once the
// story is done. Each mission is a small stage machine; updateMissions advances it
// and pays out on completion. Markers feed the HUD and the minimap.
import { MISSIONS } from './config.js';
import { addWanted, makePed, dropPickup } from './entities.js';
import { clamp, range } from './rng.js';

export function missionCount() {
  return MISSIONS.length;
}

export function startMission(G, index) {
  const def = MISSIONS[index];
  if (!def) return false;
  G.missionIndex = index;
  G.mission = { def, stage: 'start', timer: def.timeLimit || 0, grabTimer: 0, startedAt: G.timePlayed };
  G.missionActive = def.id;
  G.vipersDown = 0;
  if (def.id === 'first-wheels') G.mission.stage = 'steal';
  if (def.id === 'sunset-courier') G.mission.stage = 'pickup';
  if (def.id === 'pier-brawl') {
    G.mission.stage = 'fight';
    // Five Vipers hold the pier; a health pickup sits at its foot.
    dropPickup(G, G.city.pier.x, G.city.pier.y + 30, 'health');
    for (let i = 0; i < 5; i++) {
      const v = makePed(G.city.pier.x - 30 + i * 16, G.city.pier.y + 60 + (i % 2) * 40, G, true);
      G.peds.push(v);
    }
    G.toast('The Vipers are on the pier — take them down', 3000);
  }
  if (def.id === 'heat-run') {
    G.mission.stage = 'escape';
    G.wanted = 0;
    addWanted(G, 3, 'The whole Solmar PD is rolling');
  }
  if (def.id === 'solmar-job') {
    G.mission.stage = 'bank';
    G.toast('Hit the bank, then run for the hideout', 3000);
  }
  G.toast(def.title + ' — ' + def.brief, 5200);
  return true;
}

export function startSideJob(G) {
  const a = G.city.randomRoadPoint(G.rand);
  const b = G.city.randomRoadPoint(G.rand);
  const pay = 150 + Math.floor(G.rand() * 250);
  G.mission = {
    def: { id: 'side-courier', title: 'Side Job — Courier', giver: 'Rosa', brief: 'Quick cash run.', objective: 'Deliver the package', reward: pay },
    stage: 'pickup', timer: 120, grabTimer: 0, startedAt: G.timePlayed,
    pickupAt: a, deliverAt: b,
  };
  G.missionActive = 'side-courier';
  G.toast('Side job: pick up the package, deliver it for $' + pay, 3600);
}

export function missionMarker(G) {
  const m = G.mission;
  if (!m) return null;
  const c = G.city;
  switch (m.def.id) {
    case 'first-wheels':
      return m.stage === 'steal' ? null : { x: c.garage.x, y: c.garage.y, r: 60, label: "Rosa's Garage" };
    case 'sunset-courier':
      return m.stage === 'pickup'
        ? { x: c.docks.x, y: c.docks.y, r: 55, label: 'Docks — package' }
        : { x: c.hotel.x, y: c.hotel.y, r: 60, label: 'Grand Solmar — deliver' };
    case 'pier-brawl':
      return { x: c.pier.x, y: c.pier.y + 90, r: 120, label: 'Solmar Pier — Vipers ' + G.vipersDown + '/5' };
    case 'heat-run':
    case 'solmar-job':
      return m.stage === 'bank'
        ? { x: c.bank.x, y: c.bank.y, r: 55, label: 'Solmar Bank' }
        : { x: c.hideout.x, y: c.hideout.y, r: 60, label: 'Hideout' };
    case 'side-courier':
      return m.stage === 'pickup'
        ? { x: m.pickupAt.x, y: m.pickupAt.y, r: 50, label: 'Package pickup' }
        : { x: m.deliverAt.x, y: m.deliverAt.y, r: 55, label: 'Deliver here' };
    default:
      return null;
  }
}

export function currentObjective(G) {
  const m = G.mission;
  if (!m) {
    return G.missionIndex >= MISSIONS.length
      ? 'Free roam — a side job is coming, or just enjoy Solmar'
      : 'Talk to Rosa to start the next job';
  }
  const d = m.def;
  switch (d.id) {
    case 'first-wheels': return m.stage === 'steal' ? 'Steal a car (E near a car)' : "Drive it to Rosa's garage";
    case 'sunset-courier': return m.stage === 'pickup' ? 'Pick up the package at the Marina docks' : 'Deliver it to the Grand Solmar hotel';
    case 'pier-brawl': return 'Defeat the Vipers on the pier (' + G.vipersDown + '/5)';
    case 'heat-run': return 'Lose the police — reach the Old Town hideout';
    case 'solmar-job': return m.stage === 'bank' ? 'Grab the cash at Solmar Bank (stay in the vault)' : 'Escape to the hideout with the cash';
    case 'side-courier': return m.stage === 'pickup' ? 'Pick up the package' : 'Deliver the package';
    default: return d.objective;
  }
}

function arrive(G, marker, radius) {
  const p = G.player;
  const x = p.inCar ? p.inCar.x : p.x;
  const y = p.inCar ? p.inCar.y : p.y;
  const dx = x - marker.x, dy = y - marker.y;
  return dx * dx + dy * dy < radius * radius;
}

function completeMission(G) {
  const m = G.mission;
  const pay = m.def.reward;
  G.cash += pay;
  G.completed.push(m.def.id);
  if (G.audio) { G.audio.missionDone(); G.audio.cash(); }
  G.toast('Job done — +' + '$' + pay, 3400);
  G.mission = null;
  G.missionActive = null;
  G.missionIndex++;
  if (G.missionIndex < MISSIONS.length) {
    G.missionReady = true;
    G.toast('Next job is waiting — drive to Rosa\'s garage to start it', 3600);
  } else if (!G.storyDone) {
    G.storyDone = true;
    G.toast('KING OF SOLMAR — you ran the whole story. Free roam + side jobs now.', 6000);
  }
}

function failMission(G, why) {
  G.toast('Job failed: ' + why + ' — Rosa will give you another shot', 3600);
  G.mission = null;
  G.missionActive = null;
  // Vipers left standing stay where they are; the retry re-spawns them fresh.
  G.peds = G.peds.filter((p) => !p.viper);
  G.vipersDown = 0;
  G.missionReady = true;
}

export function updateMissions(G, dt) {
  const m = G.mission;
  if (!m) {
    // Start the next story job when the player reaches Rosa's garage.
    if (G.missionReady && G.missionIndex < MISSIONS.length) {
      const p = G.player;
      const dx = p.x - G.city.garage.x, dy = p.y - G.city.garage.y;
      if (dx * dx + dy * dy < 90 * 90) startMission(G, G.missionIndex);
    } else if (!G.mission && G.storyDone && G.timePlayed - (G.lastSideJobAt || 0) > 8) {
      G.lastSideJobAt = G.timePlayed;
      startSideJob(G);
    }
    return;
  }
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(G, 'out of time'); return; }
  }
  const marker = missionMarker(G);
  switch (m.def.id) {
    case 'first-wheels':
      if (m.stage === 'steal' && G.player.inCar) m.stage = 'deliver';
      else if (m.stage === 'deliver' && marker && arrive(G, marker, marker.r)) completeMission(G);
      break;
    case 'sunset-courier':
      if (m.stage === 'pickup' && marker && arrive(G, marker, marker.r)) {
        m.stage = 'deliver';
        G.toast('Package secured — get it to the hotel', 2600);
      } else if (m.stage === 'deliver' && marker && arrive(G, marker, marker.r)) completeMission(G);
      break;
    case 'pier-brawl':
      if (G.vipersDown >= 5) {
        dropPickup(G, G.city.pier.x, G.city.pier.y + 90, 'cash');
        completeMission(G);
      }
      break;
    case 'heat-run':
      if (marker && arrive(G, marker, marker.r)) {
        G.wanted = 0;
        G.cars = G.cars.filter((c) => c.kind !== 'police');
        G.bustTimer = 0;
        completeMission(G);
      }
      break;
    case 'solmar-job':
      if (m.stage === 'bank' && marker) {
        if (arrive(G, marker, marker.r)) {
          m.grabTimer += dt;
          if (m.grabTimer > 1.5 && G.wanted < 2) addWanted(G, 2, 'Bank alarm tripped');
          if (m.grabTimer >= 5) {
            m.stage = 'escape';
            addWanted(G, 2, 'The vault is open — RUN');
            G.toast('Cash grabbed — lose the cops and reach the hideout', 3400);
          }
        } else m.grabTimer = Math.max(0, m.grabTimer - dt * 2);
      } else if (m.stage === 'escape' && marker && arrive(G, marker, marker.r)) {
        G.wanted = 0;
        G.cars = G.cars.filter((c) => c.kind !== 'police');
        G.bustTimer = 0;
        completeMission(G);
      }
      break;
    case 'side-courier':
      if (m.stage === 'pickup' && marker && arrive(G, marker, marker.r)) {
        m.stage = 'deliver';
        G.toast('Package picked up', 1800);
      } else if (m.stage === 'deliver' && marker && arrive(G, marker, marker.r)) completeMission(G);
      break;
    default:
      break;
  }
  // Keep the wanted level honest: no cops left, no heat.
  if (G.wanted > 0) {
    G.wantedTimer += dt;
    const seen = G.cars.some((c) => c.kind === 'police');
    if (!seen && G.wantedTimer > 12) {
      G.wanted = 0;
      G.toast('You slipped away — heat is off', 2200);
    } else if (G.wantedTimer > 26) {
      G.wanted = Math.max(0, G.wanted - 1);
      G.wantedTimer = 0;
      if (G.wanted === 0) G.toast('Heat is off', 1800);
    }
  } else {
    G.wantedTimer = 0;
  }
  // Clamp the player into the world after a bust/waste respawn (handled by main).
  void clamp;
  void range;
}
