// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — systems/waves.ts  |  Creep-Wellen alle 30s, skalierend
// ─────────────────────────────────────────────────────────────────────────────

import { GameState, Team, CreepVariant, Vec2 } from "../types";
import { createCreep } from "../entities/creep";

export function updateWaves(state: GameState, dt: number): void {
  state.wave.nextWaveTimer -= dt;

  if (state.wave.nextWaveTimer <= 0) {
    state.wave.nextWaveTimer = state.wave.WAVE_INTERVAL;
    state.wave.waveNumber++;
    spawnWave(state);
  }
}

function spawnWave(state: GameState): void {
  const w = state.wave.waveNumber;

  // Zusammensetzung
  let melee  = 3;
  let ranged = 1;
  let siege  = 0;

  if (w >= 6)  { ranged = 2; siege = 1; }
  if (w >= 11) { melee = 4; }

  // Spawn-Offsets (gestaffelt, damit Creeps nicht übereinander starten)
  let idx = 0;

  for (let i = 0; i < melee; i++) {
    const offset = creepOffset(idx++);
    spawnOne(state, Team.Radiant, CreepVariant.Melee, offset, w);
    spawnOne(state, Team.Dire,    CreepVariant.Melee, offset, w);
  }
  for (let i = 0; i < ranged; i++) {
    const offset = creepOffset(idx++);
    spawnOne(state, Team.Radiant, CreepVariant.Ranged, offset, w);
    spawnOne(state, Team.Dire,    CreepVariant.Ranged, offset, w);
  }
  for (let i = 0; i < siege; i++) {
    const offset = creepOffset(idx++);
    spawnOne(state, Team.Radiant, CreepVariant.Siege, offset, w);
    spawnOne(state, Team.Dire,    CreepVariant.Siege, offset, w);
  }
}

function creepOffset(index: number): Vec2 {
  // Staffelung: jeder Creep startet 60px weiter hinten
  // Richtung des Lanes ist diagonal (-45°), also versetzen wir entlang dieser Achse
  const along = index * 50;
  return { x: along * 0.3, y: along * 0.3 };
}

function spawnOne(
  state: GameState,
  team: Team,
  variant: CreepVariant,
  offset: Vec2,
  waveNumber: number
): void {
  const creep = createCreep(team, variant, offset, waveNumber, state.stage);
  if (team === Team.Radiant) {
    state.radiantCreeps.push(creep);
  } else {
    state.direCreeps.push(creep);
  }
}
