// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — systems/combat.ts  |  Hero-Angriff, Last-Hit-Logik, Deny
// ─────────────────────────────────────────────────────────────────────────────

import { GameState, Team, EntityType, AbilityId, AbilityState } from "../types";
import { dist, normalize, uniqueId, clamp, WORLD_W, WORLD_H } from "../map";
import { SLOW_FACTOR, ABILITY_STATS } from "../constants";
import { findEntity } from "../entities/creep";
import { createProjectile } from "../entities/projectile";
import { EventBus } from "../eventbus";

// ── Hero Attack System ────────────────────────────────────────────────────────

export function updateHeroCombat(state: GameState, dt: number): void {
  const hero = state.hero;
  if (!hero.alive) return;

  // HP-Regen
  hero.hp = Math.min(hero.maxHp, hero.hp + hero.hpRegen * dt);

  // Slow
  if (hero.slowTimer > 0) hero.slowTimer -= dt;

  // Attack-Timer
  if (hero.attackTimer > 0) hero.attackTimer -= dt;

  // Payroll Run Timer
  if (hero.payrollRunActive) {
    hero.payrollRunTimer -= dt;
    if (hero.payrollRunTimer <= 0) {
      executePayrollRun(state);
      hero.payrollRunActive = false;
    }
  }

  // Überstunden AoE Timer
  if (hero.ueberstundenActive) {
    hero.ueberstundenTimer -= dt;
    if (hero.ueberstundenTimer <= 0) hero.ueberstundenActive = false;
  }

  // Angriffsziel prüfen
  if (hero.attackTarget !== null) {
    const target = findEntity(hero.attackTarget, state);
    if (!target || !target.alive) {
      hero.attackTarget = null;
      hero.isAttackMoving = false;
      return;
    }

    const d = dist(hero.pos, target.pos);

    if (d <= hero.attackRange + target.radius) {
      // In Reichweite → angreifen
      hero.moveTarget = null;
      hero.facingAngle = Math.atan2(target.pos.y - hero.pos.y, target.pos.x - hero.pos.x);

      if (hero.attackTimer <= 0) {
        hero.attackTimer = hero.attackCooldown;
        fireHeroAttack(hero, target, state);
      }
    } else if (hero.isAttackMoving) {
      // Auf Ziel zubewegen
      hero.moveTarget = { x: target.pos.x, y: target.pos.y };
    }
  }

  // Pfeiltasten-Bewegung (hat Vorrang vor Rechtsklick-Bewegung)
  const keys = state.input.keys;
  let arrowDx = 0;
  let arrowDy = 0;
  if (keys.has("ARROWUP"))    arrowDy -= 1;
  if (keys.has("ARROWDOWN"))  arrowDy += 1;
  if (keys.has("ARROWLEFT"))  arrowDx -= 1;
  if (keys.has("ARROWRIGHT")) arrowDx += 1;

  if (arrowDx !== 0 || arrowDy !== 0) {
    const dir = normalize({ x: arrowDx, y: arrowDy });
    const speed = hero.slowTimer > 0 ? hero.moveSpeed * SLOW_FACTOR : hero.moveSpeed;
    hero.pos.x += dir.x * speed * dt;
    hero.pos.y += dir.y * speed * dt;
    hero.pos.x = clamp(hero.pos.x, hero.radius, WORLD_W - hero.radius);
    hero.pos.y = clamp(hero.pos.y, hero.radius, WORLD_H - hero.radius);
    hero.facingAngle = Math.atan2(dir.y, dir.x);
    hero.moveTarget = null;
    hero.attackTarget = null;
    hero.isAttackMoving = false;
  } else if (hero.moveTarget !== null) {
    // Rechtsklick-Bewegung
    const dx = hero.moveTarget.x - hero.pos.x;
    const dy = hero.moveTarget.y - hero.pos.y;
    const d  = Math.sqrt(dx * dx + dy * dy);

    if (d < 8) {
      hero.moveTarget = null;
    } else {
      const speed = hero.slowTimer > 0 ? hero.moveSpeed * SLOW_FACTOR : hero.moveSpeed;
      const nx = dx / d;
      const ny = dy / d;
      hero.pos.x += nx * speed * dt;
      hero.pos.y += ny * speed * dt;
      hero.facingAngle = Math.atan2(ny, nx);
    }
  }
}

function fireHeroAttack(
  hero: import("../types").Hero,
  target: { id: string; pos: import("../types").Vec2 },
  state: GameState
): void {
  let kind: import("../types").ProjectileKind = "hero_basic";
  let damage = hero.attackDamage;
  let abilityId: AbilityId | null = null;

  // Zeitbuchung (Q) verstärkt?
  if (hero.zeitbuchungReady) {
    kind = "hero_zeitbuchung";
    damage = Math.round(damage * 1.5);
    abilityId = AbilityId.Zeitbuchung;
    hero.zeitbuchungReady = false;
  }

  const proj = createProjectile(kind, hero, target.id, damage, abilityId);
  proj.isLastHit = true;
  state.projectiles.push(proj);
}

// ── Payroll Run (Ultimate R) ─────────────────────────────────────────────────

function executePayrollRun(state: GameState): void {
  const hero = state.hero;
  const RADIUS = ABILITY_STATS.payrollRun.radius;

  // AoE-Effekt
  state.aoeEffects.push({
    id:      uniqueId("aoe"),
    pos:     { ...hero.pos },
    radius:  RADIUS,
    maxLife: 1.0,
    life:    1.0,
    color:   "#FFD700",
    kind:    "ring",
  });

  // Damage + Gold
  const abilityLevel = hero.abilities.find(a => a.id === AbilityId.PayrollRun)?.level ?? 1;
  const dmg = ABILITY_STATS.payrollRun.damage[Math.min(abilityLevel - 1, 2)];

  for (const creep of state.direCreeps) {
    if (!creep.alive) continue;
    const d = dist(hero.pos, creep.pos);
    if (d <= RADIUS) {
      const armor = creep.armor ?? 0;
      const eff = Math.max(1, dmg - armor);
      creep.hp -= eff;

      state.floatingTexts.push({
        id: uniqueId("ft"), pos: { x: creep.pos.x, y: creep.pos.y - 20 },
        text: `-${eff}`, color: "#FFD700", alpha: 1, vy: -50, life: 0.9, size: 14,
      });

      if (creep.hp <= 0) {
        creep.hp = 0;
        creep.alive = false;
        creep.markedForDeletion = true;
        // Doppelter Lohn!
        const lohn = creep.lohnBounty * 2;
        EventBus.emit("LAST_HIT", { lohn, xp: creep.xpBounty });
      }
    }
  }

  // Dire Towers in Reichweite
  for (const tower of state.direTowers) {
    if (!tower.alive || tower.destroyed) continue;
    if (dist(hero.pos, tower.pos) <= RADIUS) {
      tower.hp -= Math.round(dmg * 0.5);
      if (tower.hp <= 0) {
        tower.hp = 0;
        tower.alive = false;
        tower.destroyed = true;
        tower.markedForDeletion = true;
        EventBus.emit("TOWER_DESTROYED", { tower, lohn: tower.lohnBounty, xp: tower.xpBounty });
        if (tower.type === EntityType.Ancient) {
          EventBus.emit("ANCIENT_DESTROYED", {} as Record<string, never>);
        }
      }
    }
  }
}

// ── Input Handling (Rechtsklick-Ziel) ─────────────────────────────────────────

export function handleHeroRightClick(state: GameState): void {
  const hero = state.hero;
  const { mouseWorld } = state.input;

  // Feindliche Einheit angeklickt?
  for (const creep of state.direCreeps) {
    if (!creep.alive) continue;
    if (dist(mouseWorld, creep.pos) <= creep.radius + 12) {
      hero.attackTarget  = creep.id;
      hero.isAttackMoving = true;
      hero.moveTarget     = null;
      return;
    }
  }

  // Feindlicher Tower
  for (const tower of state.direTowers) {
    if (!tower.alive || tower.destroyed) continue;
    if (dist(mouseWorld, tower.pos) <= tower.radius + 15) {
      hero.attackTarget   = tower.id;
      hero.isAttackMoving = true;
      hero.moveTarget     = null;
      return;
    }
  }

  // Eigener Creep denyen (< 50% HP)
  for (const creep of state.radiantCreeps) {
    if (!creep.alive) continue;
    if (creep.hp > creep.maxHp * 0.5) continue;
    if (dist(mouseWorld, creep.pos) <= creep.radius + 12) {
      hero.attackTarget   = creep.id;
      hero.isAttackMoving = true;
      hero.moveTarget     = null;
      return;
    }
  }

  // Kein Ziel → Boden-Klick = Bewegen
  hero.attackTarget   = null;
  hero.isAttackMoving = false;
  hero.moveTarget     = { x: mouseWorld.x, y: mouseWorld.y };
}

// ── Deny Handling ─────────────────────────────────────────────────────────────
// Wenn Hero einen eigenen Creep tötet → DENY Event (im Projectile-Hit abgefangen)
// In projectile.ts: wenn target.team === source.team → DENY

// ── Entity Cleanup ────────────────────────────────────────────────────────────

export function entityCleanup(state: GameState): void {
  state.radiantCreeps = state.radiantCreeps.filter(c => !c.markedForDeletion);
  state.direCreeps    = state.direCreeps.filter(c    => !c.markedForDeletion);
  state.projectiles   = state.projectiles.filter(p   => !p.markedForDeletion);
}
