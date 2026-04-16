// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — entities/tower.ts  |  Tower-KI, Angriff, Aggro-Priorität
// ─────────────────────────────────────────────────────────────────────────────

import { Tower, EntityType, Team, TowerTier, GameState, Creep, Hero } from "../types";
import { dist, uniqueId, TOWER_POSITIONS } from "../map";
import { findEntity } from "./creep";
import { createProjectile } from "./projectile";

// ── Factories ─────────────────────────────────────────────────────────────────

function makeTower(
  team: Team,
  tier: TowerTier,
  label: string,
  pos: { x: number; y: number },
  isAncient = false,
  stage = 1
): Tower {
  const tierStats: Record<TowerTier, { hp: number; dmg: number; range: number; cd: number; bounty: number }> = {
    1: { hp: 1200, dmg: 55,  range: 550, cd: 1.1, bounty: 150 },
    2: { hp: 1600, dmg: 75,  range: 580, cd: 1.05, bounty: 200 },
    3: { hp: 2000, dmg: 95,  range: 600, cd: 1.0,  bounty: 250 },
    4: { hp: 4000, dmg: 110, range: 620, cd: 0.95, bounty: 400 },
  };
  const s = tierStats[tier];

  // Dire-Towers werden pro Akt deutlich stärker; Radiant unverändert
  const hpMult  = team === Team.Dire ? 1 + (stage - 1) * 0.50 : 1;
  const dmgMult = team === Team.Dire ? 1 + (stage - 1) * 0.30 : 1;
  const bountyMult = team === Team.Dire ? 1 + (stage - 1) * 0.40 : 1;
  const hp  = Math.round(s.hp * hpMult);
  const dmg = Math.round(s.dmg * dmgMult);
  const bounty = Math.round(s.bounty * bountyMult);

  return {
    id:   uniqueId(`tower_${team}_t${tier}`),
    type: isAncient ? EntityType.Ancient : EntityType.Tower,
    team,
    pos:  { ...pos },
    radius: isAncient ? 55 : 38,
    hp, maxHp: hp, hpRegen: 0,
    alive: true, markedForDeletion: false, destroyed: false,

    attackDamage:   dmg,
    attackRange:    s.range,
    attackCooldown: s.cd,
    attackTimer:    0,
    attackTarget:   null,
    moveSpeed:      0,
    armor:          8,

    tier,
    label,
    lohnBounty: bounty,
    xpBounty:   Math.round(bounty * 0.5),
    aggroCheckTimer: 0,
    attackFlashTimer: 0,
  };
}

export function createAllTowers(stage: number = 1): { radiantTowers: Tower[]; direTowers: Tower[] } {
  const p = TOWER_POSITIONS;
  return {
    radiantTowers: [
      makeTower(Team.Radiant, 1, "HR-Abt. T1",      p.radiant.t1, false, stage),
      makeTower(Team.Radiant, 2, "Finance T2",       p.radiant.t2, false, stage),
      makeTower(Team.Radiant, 3, "IT-Kern T3",       p.radiant.t3, false, stage),
      makeTower(Team.Radiant, 4, "Unternehmens-HQ",  p.radiant.hq, true,  stage),
    ],
    direTowers: [
      makeTower(Team.Dire, 1, "Kontroll-T1",        p.dire.t1,      false, stage),
      makeTower(Team.Dire, 2, "Chaos-T2",           p.dire.t2,      false, stage),
      makeTower(Team.Dire, 3, "Bürokratie-T3",      p.dire.t3,      false, stage),
      makeTower(Team.Dire, 4, "Direktionszentrale", p.dire.ancient, true,  stage),
    ],
  };
}

// Nur Dire-Towers für nächsten Akt neu aufbauen (Radiant bleibt erhalten)
export function rebuildDireTowers(stage: number): Tower[] {
  const p = TOWER_POSITIONS;
  return [
    makeTower(Team.Dire, 1, "Kontroll-T1",        p.dire.t1,      false, stage),
    makeTower(Team.Dire, 2, "Chaos-T2",           p.dire.t2,      false, stage),
    makeTower(Team.Dire, 3, "Bürokratie-T3",      p.dire.t3,      false, stage),
    makeTower(Team.Dire, 4, "Direktionszentrale", p.dire.ancient, true,  stage),
  ];
}

// ── Update ────────────────────────────────────────────────────────────────────

export function updateTowers(state: GameState, dt: number): void {
  for (const tower of state.radiantTowers) updateSingleTower(tower, state, dt);
  for (const tower of state.direTowers)    updateSingleTower(tower, state, dt);
}

function updateSingleTower(tower: Tower, state: GameState, dt: number): void {
  if (!tower.alive || tower.destroyed) return;

  if (tower.attackFlashTimer > 0) tower.attackFlashTimer -= dt;
  if (tower.attackTimer > 0)      tower.attackTimer -= dt;

  tower.aggroCheckTimer -= dt;
  if (tower.aggroCheckTimer <= 0) {
    tower.aggroCheckTimer = 0.5;
    resolveTowerAggro(tower, state);
  }

  if (tower.attackTarget !== null) {
    const target = findEntity(tower.attackTarget, state);
    if (!target || !target.alive) {
      tower.attackTarget = null;
      return;
    }
    const d = dist(tower.pos, target.pos);
    if (d > tower.attackRange + target.radius + 20) {
      tower.attackTarget = null;
      return;
    }
    if (tower.attackTimer <= 0 && d <= tower.attackRange + target.radius) {
      tower.attackTimer       = tower.attackCooldown;
      tower.attackFlashTimer  = 0.15;
      spawnTowerBolt(tower, target.id, state);
    }
  }
}

function resolveTowerAggro(tower: Tower, state: GameState): void {
  const enemies = getTowerEnemies(tower, state);
  if (enemies.length === 0) { tower.attackTarget = null; return; }

  // Prio 1: Einheit die Freunde angreift
  for (const e of enemies) {
    if (!e.alive) continue;
    if (dist(tower.pos, e.pos) > tower.attackRange) continue;
    const asCreep = e as Creep;
    if (asCreep.attackTarget) {
      const tgt = findEntity(asCreep.attackTarget, state);
      if (tgt && tgt.team === tower.team) {
        tower.attackTarget = e.id;
        return;
      }
    }
  }

  // Prio 2: Nächste feindliche Einheit (Creeps vor Hero, wie in Dota)
  let closest: { id: string; d: number } | null = null;
  for (const e of enemies) {
    if (!e.alive) continue;
    const d = dist(tower.pos, e.pos);
    if (d <= tower.attackRange) {
      if (!closest || d < closest.d) closest = { id: e.id, d };
    }
  }
  tower.attackTarget = closest?.id ?? null;
}

function getTowerEnemies(tower: Tower, state: GameState): Array<Creep | Hero> {
  if (tower.team === Team.Radiant) {
    return [...state.direCreeps];  // hero ist Radiant, also kein Feind
  }
  return [...state.radiantCreeps, state.hero];
}

function spawnTowerBolt(tower: Tower, targetId: string, state: GameState): void {
  state.projectiles.push(createProjectile("tower_bolt", tower, targetId, tower.attackDamage, null));
}

// ── Render ────────────────────────────────────────────────────────────────────

export function renderTower(ctx: CanvasRenderingContext2D, tower: Tower): void {
  if (tower.destroyed) return;

  const { pos, radius, team, tier, hp, maxHp, attackFlashTimer, label } = tower;
  const isAncient = tier === 4;
  const baseColor  = team === Team.Radiant ? "#4CAF50" : "#FF5722";
  const flashColor = "#FFFFFF";

  ctx.save();
  ctx.translate(Math.round(pos.x), Math.round(pos.y));

  // Glühen
  const glowAlpha = isAncient ? 0.22 + 0.08 * Math.sin(Date.now() / 600) : 0.1;
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 2.2);
  glow.addColorStop(0, team === Team.Radiant ? `rgba(76,175,80,${glowAlpha})` : `rgba(255,87,34,${glowAlpha})`);
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, radius * 2.2, 0, Math.PI * 2); ctx.fill();

  // Pentagon
  const sides = isAncient ? 6 : 5;
  const color = attackFlashTimer > 0 ? flashColor : baseColor;
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color + "33";
  ctx.strokeStyle = color;
  ctx.lineWidth = isAncient ? 4 : 3;
  ctx.fill();
  ctx.stroke();

  // Inneres Symbol
  ctx.fillStyle = color;
  ctx.font = `bold ${isAncient ? 18 : 13}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(isAncient ? "★" : `T${tier}`, 0, 0);

  ctx.restore();

  // HP-Balken
  const bw = radius * 3;
  const bh = 5;
  const bx = pos.x - bw / 2;
  const by = pos.y - radius - 12;
  const pct = hp / maxHp;
  ctx.fillStyle = "#111";
  ctx.fillRect(Math.round(bx), Math.round(by), bw, bh);
  ctx.fillStyle = team === Team.Radiant ? "#4CAF50" : "#FF5722";
  ctx.fillRect(Math.round(bx), Math.round(by), Math.round(bw * pct), bh);

  // Label
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "10px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(label, Math.round(pos.x), Math.round(by - 4));
}
