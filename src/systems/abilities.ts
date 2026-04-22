// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — systems/abilities.ts  |  Fähigkeiten-Cooldowns, Auslösung
// ─────────────────────────────────────────────────────────────────────────────

import { GameState, AbilityId, AbilityState, EntityType, Ability } from "../types";
import { dist, uniqueId } from "../map";
import { SLOW_FACTOR, ABILITY_STATS } from "../constants";
import { EventBus } from "../eventbus";

export function updateAbilities(state: GameState, dt: number): void {
  const hero = state.hero;

  for (const ability of hero.abilities) {
    if (ability.isPassive) continue;
    if (ability.state === AbilityState.OnCooldown) {
      ability.timer -= dt;
      if (ability.timer <= 0) {
        ability.timer = 0;
        ability.state = AbilityState.Ready;
      }
    }
  }
}

export function tryUseAbility(state: GameState, abilityId: AbilityId): void {
  const hero = state.hero;
  const ability = hero.abilities.find(a => a.id === abilityId);
  if (!ability || ability.level === 0 || ability.isPassive) return;
  if (ability.state !== AbilityState.Ready) return;

  switch (abilityId) {
    case AbilityId.Zeitbuchung:
      activateZeitbuchung(state, ability);
      break;
    case AbilityId.Ueberstunden:
      activateUeberstunden(state, ability);
      break;
    case AbilityId.PayrollRun:
      activatePayrollRun(state, ability);
      break;
    case AbilityId.Monatsabschluss:
      activateMonatsabschluss(state2, ability);
      break;
  }
}

export function tryLevelAbility(state: GameState, abilityId: AbilityId): void {
  const hero = state.hero;
  if (hero.skillPoints <= 0) {
    spawnLevelHint(state, "Keine Skillpunkte verfügbar", "#FFB300");
    return;
  }

  const ability = hero.abilities.find(a => a.id === abilityId);
  if (!ability) return;

  // Payroll Run maximal Level 3, andere maximal 4
  const maxLevel = abilityId === AbilityId.PayrollRun ? 3 : 4;
  if (ability.level >= maxLevel) {
    spawnLevelHint(state, `${ability.name} bereits maximal`, "#FFB300");
    return;
  }

  // Payroll Run erst ab Hero Level 6
  if (abilityId === AbilityId.PayrollRun && hero.level < 6) {
    spawnLevelHint(state, `Payroll Run erst ab Level 6 (aktuell ${hero.level})`, "#FF5722");
    return;
  }
  
  if (abilityId === AbilityId.Monatsabschluss && hero.level < 10) {
    spawnLevelHint(state, `Monatsabschluss erst ab Level 10 (aktuell ${hero.level})`, "#FF5722");
    return;
  }

  ability.level++;
  hero.skillPoints--;
}

function spawnLevelHint(state: GameState, text: string, color: string): void {
  state.floatingTexts.push({
    id: uniqueId("ft"),
    pos: { x: state.hero.pos.x, y: state.hero.pos.y - 60 },
    text,
    color,
    alpha: 1, vy: -50, life: 2.0, size: 16,
  });
}

// ── Q: Zeitbuchung ────────────────────────────────────────────────────────────

function activateZeitbuchung(
  state: GameState,
  ability: Ability
): void {
  const hero = state.hero;
  hero.zeitbuchungReady = true;

  ability.state = AbilityState.OnCooldown;
  ability.timer = ability.cooldownMax[ability.level - 1];

  state.floatingTexts.push({
    id: uniqueId("ft"),
    pos: { x: hero.pos.x + 30, y: hero.pos.y - 20 },
    text: "⏱ Zeitbuchung bereit!",
    color: "#00BCD4",
    alpha: 1, vy: -40, life: 1.0, size: 14,
  });
}

// ── W: Überstunden ────────────────────────────────────────────────────────────

function activateUeberstunden(
  state: GameState,
  ability: Ability
): void {
  const hero = state.hero;
  const RADIUS = ABILITY_STATS.ueberstunden.radius;
  const dmg = ABILITY_STATS.ueberstunden.damage[ability.level - 1];

  // AoE-Effekt
  state.aoeEffects.push({
    id:      uniqueId("aoe"),
    pos:     { ...hero.pos },
    radius:  RADIUS,
    maxLife: 0.6,
    life:    0.6,
    color:   "#FF9800",
    kind:    "fill",
  });

  hero.ueberstundenActive = true;
  hero.ueberstundenTimer  = 0.3;

  // Schaden & Slow auf alle Dire in Radius
  for (const creep of state.direCreeps) {
    if (!creep.alive) continue;
    if (dist(hero.pos, creep.pos) <= RADIUS) {
      const eff = Math.max(1, dmg - creep.armor);
      creep.hp -= eff;

      // Slow
      creep.slowTimer = ABILITY_STATS.ueberstunden.slowDuration;
      creep.moveSpeed = creep.baseSpeed * SLOW_FACTOR;

      state.floatingTexts.push({
        id: uniqueId("ft"),
        pos: { x: creep.pos.x, y: creep.pos.y - 15 },
        text: `-${eff}`, color: "#FF9800", alpha: 1, vy: -50, life: 0.7, size: 14,
      });

      if (creep.hp <= 0) {
        creep.hp = 0;
        creep.alive = false;
        creep.markedForDeletion = true;
        EventBus.emit("LAST_HIT", { lohn: creep.lohnBounty, xp: creep.xpBounty });
      }
    }
  }

  ability.state = AbilityState.OnCooldown;
  ability.timer = ability.cooldownMax[ability.level - 1];
}

// ── R: Payroll Run ────────────────────────────────────────────────────────────

function activatePayrollRun(
  state: GameState,
  ability: Ability
): void {
  const hero = state.hero;
  hero.payrollRunActive = true;
  hero.payrollRunTimer  = ABILITY_STATS.payrollRun.castTime;

  // Coins spawnen (visuelle Projektile rund um Hero)
  for (let i = 0; i < ABILITY_STATS.payrollRun.coinCount; i++) {
    const angle = (i / ABILITY_STATS.payrollRun.coinCount) * Math.PI * 2;
    state.projectiles.push({
      id:     uniqueId("coin"),
      type:   EntityType.Projectile,
      team:   hero.team,
      pos:    { x: hero.pos.x + Math.cos(angle) * 60, y: hero.pos.y + Math.sin(angle) * 60 },
      radius: 8,
      hp: 1, maxHp: 1, hpRegen: 0,
      alive: true, markedForDeletion: false,
      kind:       "payroll_coin",
      targetId:   hero.id,   // orbitet um Hero
      speed:      200,
      damage:     0,
      isLastHit:  false,
      fromAbility: AbilityId.PayrollRun,
      angle,
      orbitAngle: angle,
    });
  }

  ability.state = AbilityState.OnCooldown;
  ability.timer = ability.cooldownMax[ability.level - 1];

  state.floatingTexts.push({
    id: uniqueId("ft"),
    pos: { x: hero.pos.x, y: hero.pos.y - 50 },
    text: "💰 PAYROLL RUN!",
    color: "#FFD700",
    alpha: 1, vy: -100, life: 2.0, size: 26,
  });
}

function activateMonatsabschluss(state2, ability) {
  const hero = state2.hero;
  const RADIUS = ABILITY_STATS.monatsabschluss.radius[ability.level - 1];
  const heal = ABILITY_STATS.monatsabschluss.healing[ability.level - 1];
  state2.aoeEffects.push({
    id: uniqueId("aoe"),
    pos: { ...hero.pos },
    radius: RADIUS,
    maxLife: 0.6,
    life: 0.6,
    color: "#469800",
    kind: "fill"
  });

  hero.ueberstundenActive = true;
  hero.ueberstundenTimer = 0.3;

  for (const creep of state2.radiantCreeps) {
    if (!creep.alive) continue;
    if (dist(hero.pos, creep.pos) <= RADIUS) {
      creep.hp += heal;
      state2.floatingTexts.push({
        id: uniqueId("ft"),
        pos: { x: creep.pos.x, y: creep.pos.y - 15 },
        text: `+${heal}`,
        color: "#5c9800",
        alpha: 1,
        vy: -50,
        life: 0.7,
        size: 14
      });
    }
  }

  ability.state = "cooldown" /* OnCooldown */;
  ability.timer = ability.cooldownMax[ability.level - 1];
}

// ── Update Payroll Coins (orbit around hero) ─────────────────────────────────

export function updatePayrollCoins(state: GameState, dt: number): void {
  for (const proj of state.projectiles) {
    if (proj.kind !== "payroll_coin") continue;
    if (!proj.alive) continue;

    if (!state.hero.payrollRunActive) {
      // Casting vorbei → Coins verschwinden
      proj.alive = false;
      proj.markedForDeletion = true;
      continue;
    }

    // Orbit um Hero
    proj.orbitAngle += dt * 4;
    const r = 80;
    proj.pos.x = state.hero.pos.x + Math.cos(proj.orbitAngle) * r;
    proj.pos.y = state.hero.pos.y + Math.sin(proj.orbitAngle) * r;
  }
}

// ── AoE-Effekte Update ───────────────────────────────────────────────────────

export function updateAoEEffects(state: GameState, dt: number): void {
  for (const effect of state.aoeEffects) {
    effect.life -= dt;
  }
  state.aoeEffects = state.aoeEffects.filter(e => e.life > 0);
}
