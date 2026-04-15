// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — systems/economy.ts  |  Passiv-Lohn, Lohn-Events, XP & Level
// ─────────────────────────────────────────────────────────────────────────────

import { GameState, AbilityId, GamePhase } from "../types";
import { EventBus } from "../eventbus";
import { uniqueId } from "../map";
import { heroLevelUp, HERO_SPAWN_POS } from "../entities/hero";
import { ABILITY_STATS } from "../constants";

const RESPAWN_BASE_TIME = 5;    // Sekunden bei Level 1
const RESPAWN_PER_LEVEL = 2;    // +2s pro Level
const DEATH_GOLD_LOSS   = 0.15; // 15% Gold-Verlust beim Tod

export function initEconomyListeners(state: GameState): void {
  // LAST_HIT → Lohn + XP + Float
  EventBus.on("LAST_HIT", (payload) => {
    const { lohn, xp } = payload;

    // Gehaltserhöhung Passiv (E)
    const gAbility = state.hero.abilities.find(a => a.id === AbilityId.Gehaltserhöhung);
    const bonus = gAbility && gAbility.level > 0 ? ABILITY_STATS.gehaltserhöhung.bonusPerLevel[gAbility.level - 1] : 0;
    const totalLohn = lohn + bonus;

    state.hero.lohn += totalLohn;
    state.economy.lohnHistory.push(totalLohn);
    if (state.economy.lohnHistory.length > 30) state.economy.lohnHistory.shift();

    addXp(state, xp);

    state.floatingTexts.push({
      id: uniqueId("ft"),
      pos: { x: state.hero.pos.x, y: state.hero.pos.y - 40 },
      text: `+${totalLohn} ₲`,
      color: "#FFD700",
      alpha: 1, vy: -70, life: 1.2, size: 18,
    });
  });

  // TOWER_DESTROYED → Bonus
  EventBus.on("TOWER_DESTROYED", (payload) => {
    const { lohn, xp } = payload;
    state.hero.lohn += lohn;
    addXp(state, xp);

    state.floatingTexts.push({
      id: uniqueId("ft"),
      pos: { x: state.hero.pos.x, y: state.hero.pos.y - 50 },
      text: `+${lohn} ₲ BONUS!`,
      color: "#FF8C00",
      alpha: 1, vy: -80, life: 1.5, size: 22,
    });
  });

  // ENTITY_KILLED (nicht Hero-Last-Hit) → kleines XP
  EventBus.on("ENTITY_KILLED", (payload) => {
    const { xpBounty } = payload;
    if (xpBounty > 0) addXp(state, xpBounty);
  });

  // ANCIENT_DESTROYED → Sieg
  EventBus.on("ANCIENT_DESTROYED", () => {
    state.phase = GamePhase.Victory;
    state.victoryTime = state.totalTime;
  });

  // RADIANT_HQ_DESTROYED → Niederlage
  EventBus.on("RADIANT_HQ_DESTROYED", () => {
    state.phase = GamePhase.Defeat;
  });

  // HERO_KILLED → Respawn starten (nicht mehr Game Over)
  EventBus.on("HERO_KILLED", () => {
    state.deathCount++;
    const respawnTime = RESPAWN_BASE_TIME + (state.hero.level - 1) * RESPAWN_PER_LEVEL;
    state.respawnTimer = respawnTime;

    // Gold-Verlust
    const lostGold = Math.floor(state.hero.lohn * DEATH_GOLD_LOSS);
    state.hero.lohn -= lostGold;

    state.floatingTexts.push({
      id: uniqueId("ft"),
      pos: { x: state.hero.pos.x, y: state.hero.pos.y - 30 },
      text: `-${lostGold} ₲ Verlust!`,
      color: "#FF5722",
      alpha: 1, vy: -50, life: 2.0, size: 16,
    });
  });
}

export function updateEconomy(state: GameState, dt: number): void {
  // Passives Grundgehalt jede Sekunde
  state.economy.passiveTimer += dt;
  if (state.economy.passiveTimer >= 1.0) {
    state.economy.passiveTimer -= 1.0;
    state.hero.lohn += state.hero.passiveLohnRate;
  }

  // Hero Tod prüfen
  if (state.hero.hp <= 0 && state.hero.alive) {
    state.hero.alive = false;
    state.hero.attackTarget = null;
    state.hero.moveTarget = null;
    EventBus.emit("HERO_KILLED", {} as Record<string, never>);
  }

  // Respawn-Timer
  if (state.respawnTimer > 0 && !state.hero.alive) {
    state.respawnTimer -= dt;
    if (state.respawnTimer <= 0) {
      state.respawnTimer = 0;
      respawnHero(state);
    }
  }
}

function respawnHero(state: GameState): void {
  const hero = state.hero;
  hero.alive = true;
  hero.hp = hero.maxHp;
  hero.pos = { ...HERO_SPAWN_POS };
  hero.attackTarget = null;
  hero.moveTarget = null;
  hero.isAttackMoving = false;
  hero.slowTimer = 0;
  hero.payrollRunActive = false;
  hero.ueberstundenActive = false;
  hero.zeitbuchungReady = false;
  hero.markedForDeletion = false;

  state.floatingTexts.push({
    id: uniqueId("ft"),
    pos: { x: hero.pos.x, y: hero.pos.y - 40 },
    text: "RESPAWN!",
    color: "#4CAF50",
    alpha: 1, vy: -80, life: 2.0, size: 22,
  });
}

function addXp(state: GameState, xp: number): void {
  if (state.hero.level >= 25) return;
  state.hero.xp += xp;

  while (state.hero.xp >= state.hero.xpToNext && state.hero.level < 25) {
    state.hero.xp -= state.hero.xpToNext;
    heroLevelUp(state.hero);

    EventBus.emit("LEVEL_UP", { level: state.hero.level });

    state.floatingTexts.push({
      id: uniqueId("ft"),
      pos: { x: state.hero.pos.x, y: state.hero.pos.y - 60 },
      text: `LEVEL ${state.hero.level}!`,
      color: "#00E5FF",
      alpha: 1, vy: -90, life: 2.0, size: 24,
    });
  }
}
