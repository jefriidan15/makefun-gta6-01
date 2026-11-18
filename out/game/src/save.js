// Save / load through localStorage: cash, mission progress, best stats, player spot.
// A save is a plain JSON object under one key; corrupt saves are ignored.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s !== 'object' || s === null) return null;
    return s;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const s = {
      cash: Math.round(state.cash),
      missionIndex: state.missionIndex,
      completed: state.completed,
      px: Math.round(state.player.x),
      py: Math.round(state.player.y),
      health: Math.round(state.player.health),
      ammo: state.player.ammo,
      timePlayed: Math.round(state.timePlayed),
      carsStolen: state.stats.carsStolen,
      bustedCount: state.stats.bustedCount,
      wastedCount: state.stats.wastedCount,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // Storage full or unavailable: the game keeps running without a save.
  }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
