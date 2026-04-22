// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — entities/hero.ts  |  Spieler-Hero: Der Buchhalter
// ─────────────────────────────────────────────────────────────────────────────

import {
  Hero, EntityType, Team, AbilityId, AbilityState, ShopItem
} from "../types";
import { uniqueId } from "../map";

const XP_TABLE = [0,200,500,900,1400,2000,2700,3500,4400,5400,
                  6500,7700,9000,10400,11900,13500,15200,17000,18900,20900,
                  23000,25200,27500,29900,32400];

export function getXpToNext(level: number): number {
  if (level >= 25) return 0;
  return XP_TABLE[level] - (level > 0 ? XP_TABLE[level - 1] : 0);
}

export function getXpForLevel(level: number): number {
  return level >= 1 ? XP_TABLE[level - 1] : 0;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "kaffee",    name: "Kaffee",                   description: "+15 Bewegungsgeschw.",  cost: 75,   purchased: false, hpBonus: 0,   attackBonus: 0,  moveSpeedBonus: 15, passiveLohnBonus: 0, hpRegenBonus: 0 },
  { id: "token",     name: "Feierabend-Token",          description: "+150 Max-HP",           cost: 200,  purchased: false, hpBonus: 150, attackBonus: 0,  moveSpeedBonus: 0,  passiveLohnBonus: 0, hpRegenBonus: 0 },
  { id: "excel",     name: "Excel-Masterkurs",          description: "+15 Angriffschaden",    cost: 450,  purchased: false, hpBonus: 0,   attackBonus: 15, moveSpeedBonus: 0,  passiveLohnBonus: 0, hpRegenBonus: 0 },
  { id: "steuer",    name: "Steuerberater",             description: "+2 ₲/sek Passivlohn",   cost: 900,  purchased: false, hpBonus: 0,   attackBonus: 0,  moveSpeedBonus: 0,  passiveLohnBonus: 2, hpRegenBonus: 0 },
  { id: "ue_paket",  name: "Überstunden-Paket",         description: "+25 ATK, +200 HP",      cost: 1200, purchased: false, hpBonus: 200, attackBonus: 25, moveSpeedBonus: 0,  passiveLohnBonus: 0, hpRegenBonus: 0 },
  { id: "bav",       name: "Betr. Altersvorsorge",      description: "+500 HP, +5 HP-Regen",  cost: 2500, purchased: false, hpBonus: 500, attackBonus: 0,  moveSpeedBonus: 0,  passiveLohnBonus: 0, hpRegenBonus: 5 },
];

export const HERO_SPAWN_POS = { x: 320, y: 2080 };

export function createHero(): Hero {
  return {
    id:   uniqueId("hero"),
    type: EntityType.Hero,
    team: Team.Radiant,
    pos:  { ...HERO_SPAWN_POS },
    radius: 22,
    hp:    800, maxHp: 800, hpRegen: 4,
    alive: true, markedForDeletion: false,

    attackDamage:   55,
    attackRange:    500,
    attackCooldown: 1.0,
    attackTimer:    0,
    attackTarget:   null,
    moveSpeed:      300,
    baseSpeed:      300,
    armor:          5,

    name:       "Der Buchhalter",
    level:      1,
    xp:         0,
    xpToNext:   200,
    skillPoints:1,
    lohn:       200,
    passiveLohnRate: 1,

    abilities: [
      {
        id: AbilityId.Zeitbuchung,
        name: "Zeitbuchung",
        description: "Nächster Angriff: 1.5× DMG + Audit-Debuff (20% mehr Schaden für 0.5s)",
        cooldownMax: [8, 7, 6, 5],
        timer: 0, 
        state: AbilityState.Ready, 
        level: 0, 
        isPassive: false,
      },
      {
        id: AbilityId.Ueberstunden,
        name: "Überstunden",
        description: "AoE 300px: Schaden + 40% Slow 3s",
        cooldownMax: [16, 14, 12, 10],
        timer: 0, 
        state: AbilityState.Ready, 
        level: 0, 
        isPassive: false,
      },
      {
        id: AbilityId.Gehaltserhöhung,
        name: "Gehaltserhöhung",
        description: "PASSIV: +18 ₲ pro Last-Hit",
        cooldownMax: [0, 0, 0, 0],
        timer: 0, 
        state: AbilityState.Ready, 
        level: 1, 
        isPassive: true,
      },
      {
        id: AbilityId.PayrollRun,
        name: "Payroll Run",
        description: "AoE 450px Riesenschaden (ab Lv 6)",
        cooldownMax: [120, 100, 80],
        timer: 0, 
        state: AbilityState.Ready, 
        level: 0, 
        isPassive: false,
      },
      {
        id: AbilityId.Monatsabschluss,
        name: "Monatsabschluss",
        description: "Heilung (ab Lv 10)",
        cooldownMax: [50, 30, 10],
        timer: 0, 
        state: AbilityState.Ready, 
        level: 0, 
        isPassive: false,
      },
    ],

    items: SHOP_ITEMS.map(i => ({ ...i })),

    moveTarget:    null,
    isAttackMoving: false,

    zeitbuchungReady:   false,
    ueberstundenActive: false,
    ueberstundenTimer:  0,
    payrollRunActive:   false,
    payrollRunTimer:    0,
    slowTimer:          0,
    facingAngle:        -Math.PI / 4,
  };
}

export function heroLevelUp(hero: Hero): void {
  if (hero.level >= 25) return;
  hero.level++;
  hero.skillPoints++;
  // Stat-Steigerungen pro Level
  hero.maxHp        += 18;
  hero.hp            = Math.min(hero.hp + 18, hero.maxHp);
  hero.attackDamage += 2;
  hero.xpToNext = hero.level < 25 ? (XP_TABLE[hero.level] - XP_TABLE[hero.level - 1]) : 0;
}
