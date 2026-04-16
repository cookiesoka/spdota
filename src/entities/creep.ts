// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — entities/creep.ts  |  KI-Creeps: Waypoint-Navigation & Aggro
// ─────────────────────────────────────────────────────────────────────────────

import {
  Creep, EntityType, Team, CreepVariant, Vec2, GameState, Tower, Hero
} from "../types";
import { dist, normalize, uniqueId, RADIANT_PATH, DIRE_PATH } from "../map";
import { EventBus } from "../eventbus";
import { createProjectile } from "./projectile";

const ARRIVAL_THRESHOLD = 28;
const AGGRO_RANGE       = 260;
const LEASH_RANGE       = 400;

// ── Factories ─────────────────────────────────────────────────────────────────

export function createCreep(
  team: Team,
  variant: CreepVariant,
  startOffset: Vec2,
  waveNumber: number,
  stage: number = 1
): Creep {
  // Pro Akt werden Dire-Creeps deutlich stärker; Radiant-Creeps moderat
  const stageMult    = team === Team.Dire ? 1 + (stage - 1) * 0.45 : 1 + (stage - 1) * 0.20;
  const stageDmgMult = team === Team.Dire ? 1 + (stage - 1) * 0.35 : 1 + (stage - 1) * 0.15;
  const scale = (1 + waveNumber * 0.05) * stageMult;
  const dmgScale = (1 + waveNumber * 0.04) * stageDmgMult;

  const basePath = team === Team.Radiant ? RADIANT_PATH : DIRE_PATH;
  const spawnPos = { x: basePath[0].x + startOffset.x, y: basePath[0].y + startOffset.y };

  let hp = 420, dmg = 15, speed = 290, bounty = 40 + waveNumber * 2, radius = 16;
  if (variant === CreepVariant.Ranged) {
    hp = 300; dmg = 12; speed = 290; bounty = 42 + waveNumber * 2; radius = 14;
  }
  if (variant === CreepVariant.Siege) {
    hp = 900; dmg = 10; speed = 200; bounty = 90 + waveNumber * 3; radius = 20;
  }

  return {
    id:   uniqueId(`creep_${team}`),
    type: EntityType.Creep,
    team,
    pos:  { ...spawnPos },
    radius,
    hp:   Math.round(hp * scale),
    maxHp:Math.round(hp * scale),
    hpRegen: 0,
    alive: true,
    markedForDeletion: false,

    attackDamage:   Math.round(dmg * dmgScale),
    attackRange:    variant === CreepVariant.Ranged || variant === CreepVariant.Siege ? 500 : 100,
    attackCooldown: variant === CreepVariant.Siege ? 1.8 : 1.1,
    attackTimer:    Math.random() * 1.0,  // stagger attacks in wave
    attackTarget:   null,
    moveSpeed:      speed,
    baseSpeed:      speed,
    armor:          1,

    variant,
    waypointPath: {
      points:     basePath,
      currentIdx: 1,
    },
    lohnBounty: Math.round(bounty * stageMult),
    xpBounty:   Math.round(bounty * 0.6 * stageMult),
    isLastHitWindow: false,
    slowTimer:  0,
    aggroCheckTimer: Math.random() * 0.5,
  };
}

// ── Update ────────────────────────────────────────────────────────────────────

export function updateCreeps(state: GameState, dt: number): void {
  for (const creep of state.radiantCreeps) updateSingleCreep(creep, state, dt);
  for (const creep of state.direCreeps)    updateSingleCreep(creep, state, dt);
}

function updateSingleCreep(creep: Creep, state: GameState, dt: number): void {
  if (!creep.alive) return;

  // HP-Regen (Creeps haben keins, trotzdem für Einheitlichkeit)
  creep.hp = Math.min(creep.maxHp, creep.hp + creep.hpRegen * dt);

  // Last-Hit-Fenster
  creep.isLastHitWindow = creep.hp < creep.maxHp * 0.15;

  // Slow abklingen
  if (creep.slowTimer > 0) {
    creep.slowTimer -= dt;
    if (creep.slowTimer <= 0) {
      creep.slowTimer = 0;
      creep.moveSpeed = creep.baseSpeed;
    }
  }

  // Attack-Timer
  if (creep.attackTimer > 0) creep.attackTimer -= dt;

  // Aggro-Check (alle 0.4s)
  creep.aggroCheckTimer -= dt;
  if (creep.aggroCheckTimer <= 0) {
    creep.aggroCheckTimer = 0.4;
    resolveCreepAggro(creep, state);
  }

  // Angreifen oder bewegen
  if (creep.attackTarget !== null) {
    const target = findEntity(creep.attackTarget, state);
    if (!target || !target.alive) {
      creep.attackTarget = null;
    } else {
      const d = dist(creep.pos, target.pos);
      const leashWp = creep.waypointPath.points[Math.min(
        creep.waypointPath.currentIdx,
        creep.waypointPath.points.length - 1
      )];
      const leashDist = dist(creep.pos, leashWp);

      if (d > LEASH_RANGE || leashDist > LEASH_RANGE * 1.5) {
        // Leash gebrochen → zurück zum Weg
        creep.attackTarget = null;
      } else if (d <= creep.attackRange + target.radius) {
        // Angreifen
        if (creep.attackTimer <= 0) {
          creep.attackTimer = creep.attackCooldown;
          spawnCreepAttack(creep, target, state);
        }
      } else {
        // Auf Ziel zubewegen
        moveToward(creep, target.pos, dt);
      }
    }
  }

  if (creep.attackTarget === null) {
    // Waypoint folgen
    followWaypoints(creep, state, dt);
  }
}

function resolveCreepAggro(creep: Creep, state: GameState): void {
  // Bereits ein Ziel in Reichweite?
  if (creep.attackTarget !== null) {
    const target = findEntity(creep.attackTarget, state);
    if (target && target.alive && dist(creep.pos, target.pos) <= AGGRO_RANGE + 50) return;
    creep.attackTarget = null;
  }

  const enemies = getEnemies(creep, state);
  let closest: { id: string; d: number } | null = null;

  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist(creep.pos, e.pos);
    if (d <= AGGRO_RANGE) {
      if (!closest || d < closest.d) closest = { id: e.id, d };
    }
  }

  creep.attackTarget = closest?.id ?? null;
}

function followWaypoints(creep: Creep, state: GameState, dt: number): void {
  const path = creep.waypointPath;
  if (path.currentIdx >= path.points.length) {
    // Am Ende angekommen → Schaden am feindlichen Gebäude
    const target = getEnemyBase(creep, state);
    if (target && target.alive) {
      target.hp -= creep.attackDamage * 0.5;
    }
    creep.alive = false;
    creep.markedForDeletion = true;
    return;
  }

  const wp = path.points[path.currentIdx];
  const d = dist(creep.pos, wp);

  if (d <= ARRIVAL_THRESHOLD) {
    path.currentIdx++;
  } else {
    moveToward(creep, wp, dt);
  }
}

function moveToward(creep: Creep, target: Vec2, dt: number): void {
  const dir = normalize({ x: target.x - creep.pos.x, y: target.y - creep.pos.y });
  creep.pos.x += dir.x * creep.moveSpeed * dt;
  creep.pos.y += dir.y * creep.moveSpeed * dt;
}

function spawnCreepAttack(creep: Creep, target: { id: string; pos: Vec2; hp: number }, state: GameState): void {
  if (creep.variant === CreepVariant.Melee) {
    // Sofort-Schaden
    applyDamage(target.id, creep.attackDamage, creep.id, false, state);
  } else {
    // Projektil spawnen
    state.projectiles.push(
      createProjectile("creep_ranged", creep, target.id, creep.attackDamage, null)
    );
  }
}

function applyDamage(
  targetId: string,
  amount: number,
  sourceId: string,
  isHero: boolean,
  state: GameState
): void {
  const target = findEntity(targetId, state);
  if (!target || !target.alive) return;
  const effective = Math.max(1, amount - target.armor);
  target.hp -= effective;
  if (target.hp <= 0) {
    target.hp = 0;

    // Hero-Tod wird zentral in updateEconomy behandelt (Respawn-System)
    if (target.type === EntityType.Hero) return;

    target.alive = false;
    target.markedForDeletion = true;
    const lohnBounty = target.type === EntityType.Creep ? target.lohnBounty
                     : (target.type === EntityType.Tower || target.type === EntityType.Ancient) ? target.lohnBounty : 0;
    const xpBounty = target.type === EntityType.Creep ? target.xpBounty
                   : (target.type === EntityType.Tower || target.type === EntityType.Ancient) ? target.xpBounty : 0;
    EventBus.emit("ENTITY_KILLED", { killerId: sourceId, targetId, isHeroKill: isHero, lohnBounty, xpBounty });
  }
}

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

export function findEntity(id: string, state: GameState): (Creep | Tower | Hero) | null {
  if (state.hero.id === id) return state.hero;
  for (const c of state.radiantCreeps) if (c.id === id) return c;
  for (const c of state.direCreeps)   if (c.id === id) return c;
  for (const t of state.radiantTowers) if (t.id === id) return t;
  for (const t of state.direTowers)    if (t.id === id) return t;
  return null;
}

function getEnemies(creep: Creep, state: GameState): Array<{ id: string; pos: Vec2; alive: boolean }> {
  if (creep.team === Team.Radiant) {
    return [...state.direCreeps, ...state.direTowers, state.hero.team !== Team.Radiant ? state.hero : null]
      .filter(Boolean) as Array<{ id: string; pos: Vec2; alive: boolean }>;
  }
  return [...state.radiantCreeps, ...state.radiantTowers, state.hero];
}

function getEnemyBase(creep: Creep, state: GameState): Tower | null {
  if (creep.team === Team.Radiant) {
    return state.direTowers[state.direTowers.length - 1] ?? null;
  }
  return state.radiantTowers[state.radiantTowers.length - 1] ?? null;
}
