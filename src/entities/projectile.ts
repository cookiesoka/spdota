// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — entities/projectile.ts  |  Homing-Projektile
// ─────────────────────────────────────────────────────────────────────────────

import {
  Projectile, EntityType, Team, ProjectileKind, AbilityId, Vec2, Combatant, GameState,
  Creep, Tower, Hero
} from "../types";
import { dist, normalize, uniqueId } from "../map";
import { findEntity } from "./creep";
import { EventBus } from "../eventbus";

// ── Factory ──────────────────────────────────────────────────────────────────

export function createProjectile(
  kind: ProjectileKind,
  source: Combatant,
  targetId: string,
  damage: number,
  fromAbility: AbilityId | null
): Projectile {
  const speedMap: Record<ProjectileKind, number> = {
    hero_basic:       800,
    hero_zeitbuchung: 900,
    tower_bolt:       1100,
    creep_ranged:     700,
    payroll_coin:     400,
  };

  const dir = Math.atan2(0, 1); // fallback, overridden by homing

  return {
    id:     uniqueId("proj"),
    type:   EntityType.Projectile,
    team:   source.team,
    pos:    { x: source.pos.x, y: source.pos.y },
    radius: kind === "payroll_coin" ? 8 : 5,
    hp: 1, maxHp: 1, hpRegen: 0,
    alive: true,
    markedForDeletion: false,

    kind,
    targetId,
    speed:  speedMap[kind],
    damage,
    isLastHit: source.type === EntityType.Hero,
    fromAbility,
    angle: dir,
    orbitAngle: Math.random() * Math.PI * 2,
  };
}

// ── Update ────────────────────────────────────────────────────────────────────

export function updateProjectiles(state: GameState, dt: number): void {
  for (const proj of state.projectiles) {
    if (!proj.alive) continue;

    const target = findEntity(proj.targetId, state);

    if (!target || !target.alive) {
      // Ziel tot → Projektil verfällt
      proj.alive = false;
      proj.markedForDeletion = true;
      continue;
    }

    // Homing: Richtung zum Ziel jedes Frame
    const dx = target.pos.x - proj.pos.x;
    const dy = target.pos.y - proj.pos.y;
    const d  = Math.sqrt(dx * dx + dy * dy);

    if (d < target.radius + proj.radius) {
      // Treffer!
      onProjectileHit(proj, target, state);
      proj.alive = false;
      proj.markedForDeletion = true;
      continue;
    }

    // Bewegen
    const nx = dx / d;
    const ny = dy / d;
    proj.pos.x += nx * proj.speed * dt;
    proj.pos.y += ny * proj.speed * dt;
    proj.angle  = Math.atan2(ny, nx);

    // Payroll-Coin dreht sich
    if (proj.kind === "payroll_coin") {
      proj.orbitAngle += dt * 6;
    }
  }
}

function onProjectileHit(
  proj: Projectile,
  target: Creep | Tower | Hero,
  state: GameState
): void {
  const effective = Math.max(1, proj.damage - target.armor);
  target.hp -= effective;

  // Floating Text (Schaden)
  spawnDamageFloat(target.pos, effective, proj.isLastHit, state);

  if (target.hp <= 0) {
    target.hp = 0;

    // Hero-Tod wird zentral in updateEconomy behandelt (Respawn-System)
    if (target.type === EntityType.Hero) return;

    target.alive = false;
    target.markedForDeletion = true;

    if (proj.isLastHit && target.team === Team.Dire) {
      if (target.type === EntityType.Creep) {
        EventBus.emit("LAST_HIT", { lohn: target.lohnBounty, xp: target.xpBounty });
      } else if (target.type === EntityType.Tower || target.type === EntityType.Ancient) {
        EventBus.emit("TOWER_DESTROYED", { tower: target, lohn: target.lohnBounty, xp: target.xpBounty });
        if (target.type === EntityType.Ancient) {
          EventBus.emit("ANCIENT_DESTROYED", {} as Record<string, never>);
        }
      }
    } else if (!proj.isLastHit && target.team === Team.Dire) {
      // Creep wurde von eigenen Creeps/Towers getötet → kein Last-Hit
      const xpBounty = target.type === EntityType.Creep ? target.xpBounty : (target.type === EntityType.Tower || target.type === EntityType.Ancient) ? target.xpBounty : 0;
      EventBus.emit("ENTITY_KILLED", { targetId: target.id, killerId: proj.id, isHeroKill: false, lohnBounty: 0, xpBounty: Math.round(xpBounty * 0.4) });
    }

    // Radiant-Einheiten getötet → prüfe auf HQ
    if (target.type === EntityType.Ancient && target.team === Team.Radiant) {
      EventBus.emit("RADIANT_HQ_DESTROYED", {} as Record<string, never>);
    }

    // Tower/Ancient zerstört (Markierung)
    if (target.type === EntityType.Tower || target.type === EntityType.Ancient) {
      target.destroyed = true;
    }
  }
}

function spawnDamageFloat(pos: Vec2, amount: number, isHero: boolean, state: GameState): void {
  state.floatingTexts.push({
    id:    uniqueId("ft"),
    pos:   { x: pos.x + (Math.random() - 0.5) * 20, y: pos.y - 20 },
    text:  `-${amount}`,
    color: isHero ? "#FFFFFF" : "#888888",
    alpha: 1,
    vy:    -60,
    life:  0.8,
    size:  isHero ? 16 : 12,
  });
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderProjectile(ctx: CanvasRenderingContext2D, proj: Projectile): void {
  if (!proj.alive) return;
  const { pos, kind, orbitAngle } = proj;

  ctx.save();
  ctx.translate(Math.round(pos.x), Math.round(pos.y));

  switch (kind) {
    case "hero_basic":
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
      break;

    case "hero_zeitbuchung":
      ctx.shadowColor = "#00BCD4";
      ctx.shadowBlur = 12;
      ctx.fillStyle = "#00BCD4";
      ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      break;

    case "tower_bolt":
      ctx.strokeStyle = "#FFD700";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8 * Math.cos(proj.angle), -8 * Math.sin(proj.angle));
      ctx.lineTo(8 * Math.cos(proj.angle), 8 * Math.sin(proj.angle));
      ctx.stroke();
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      break;

    case "creep_ranged":
      ctx.fillStyle = proj.team === Team.Radiant ? "#66BB6A" : "#FF7043";
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
      break;

    case "payroll_coin":
      ctx.fillStyle = "#FFD700";
      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.rotate(orbitAngle);
      ctx.fillText("₲", 0, 0);
      break;
  }

  ctx.restore();
}
