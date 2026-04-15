// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — constants.ts  |  Zentrale Spielkonstanten & Balance-Werte
// ─────────────────────────────────────────────────────────────────────────────

export const SLOW_FACTOR = 0.6;

export const ABILITY_STATS = {
  ueberstunden: {
    radius: 300,
    damage: [80, 120, 160, 200] as readonly number[],
    slowDuration: 3.0,
  },
  payrollRun: {
    radius: 450,
    damage: [200, 350, 500] as readonly number[],
    castTime: 1.5,
    coinCount: 8,
  },
  gehaltserhöhung: {
    bonusPerLevel: [18, 24, 30, 36] as readonly number[],
  },
} as const;
