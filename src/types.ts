// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — types.ts  |  Zentrale Typen-Datei (einzige Source of Truth)
// ─────────────────────────────────────────────────────────────────────────────

// ── Enums ────────────────────────────────────────────────────────────────────

export enum Team {
  Radiant = "radiant",
  Dire    = "dire",
}

export enum GamePhase {
  MainMenu = "mainmenu",
  InGame   = "ingame",
  Victory  = "victory",
  Defeat   = "defeat",
}

export enum EntityType {
  Hero       = "hero",
  Creep      = "creep",
  Tower      = "tower",
  Ancient    = "ancient",
  Projectile = "projectile",
}

export enum CreepVariant {
  Melee  = "melee",
  Ranged = "ranged",
  Siege  = "siege",
}

export enum AbilityId {
  Zeitbuchung      = "Q",
  Ueberstunden     = "W",
  Gehaltserhöhung  = "E",
  PayrollRun       = "R",
}

export enum AbilityState {
  Ready      = "ready",
  OnCooldown = "cooldown",
}

export type TowerTier = 1 | 2 | 3 | 4;  // 4 = Ancient

// ── Geometry ─────────────────────────────────────────────────────────────────

export interface Vec2 {
  x: number;
  y: number;
}

// ── Entities ─────────────────────────────────────────────────────────────────

export interface Entity {
  id:                 string;
  type:               EntityType;
  team:               Team;
  pos:                Vec2;
  radius:             number;
  hp:                 number;
  maxHp:              number;
  hpRegen:            number;
  alive:              boolean;
  markedForDeletion:  boolean;
}

export interface Combatant extends Entity {
  attackDamage:   number;
  attackRange:    number;
  attackCooldown: number;
  attackTimer:    number;
  attackTarget:   string | null;
  moveSpeed:      number;
  armor:          number;
}

// ── Hero ─────────────────────────────────────────────────────────────────────

export interface Ability {
  id:          AbilityId;
  name:        string;
  description: string;
  cooldownMax: number[];   // per level (index 0 = level 1)
  timer:       number;
  state:       AbilityState;
  level:       number;     // 0 = not learned, 1-4 = learned
  isPassive:   boolean;
}

export interface ShopItem {
  id:              string;
  name:            string;
  description:     string;
  cost:            number;
  purchased:       boolean;
  hpBonus:         number;
  attackBonus:     number;
  moveSpeedBonus:  number;
  passiveLohnBonus:number;
  hpRegenBonus:    number;
}

export interface Hero extends Combatant {
  type:            EntityType.Hero;
  name:            string;
  level:           number;
  xp:              number;
  xpToNext:        number;
  skillPoints:     number;
  lohn:            number;
  passiveLohnRate: number;
  abilities:       Ability[];
  items:           ShopItem[];
  baseSpeed:       number;
  moveTarget:      Vec2 | null;
  isAttackMoving:  boolean;
  // Ability state flags
  zeitbuchungReady:   boolean;   // next attack enhanced (Q)
  ueberstundenActive: boolean;   // W visual timer
  ueberstundenTimer:  number;
  payrollRunActive:   boolean;   // R animation timer
  payrollRunTimer:    number;
  slowTimer:          number;
  facingAngle:        number;    // radians, for directional indicator
}

// ── Creep ────────────────────────────────────────────────────────────────────

export interface WaypointPath {
  points:     Vec2[];
  currentIdx: number;
}

export interface Creep extends Combatant {
  type:             EntityType.Creep;
  variant:          CreepVariant;
  waypointPath:     WaypointPath;
  lohnBounty:       number;
  xpBounty:         number;
  isLastHitWindow:  boolean;
  slowTimer:        number;
  baseSpeed:        number;
  aggroCheckTimer:  number;
}

// ── Tower ────────────────────────────────────────────────────────────────────

export interface Tower extends Combatant {
  type:              EntityType.Tower | EntityType.Ancient;
  tier:              TowerTier;
  label:             string;
  lohnBounty:        number;
  xpBounty:          number;
  aggroCheckTimer:   number;
  attackFlashTimer:  number;
  destroyed:         boolean;
}

// ── Projectile ───────────────────────────────────────────────────────────────

export type ProjectileKind =
  | "hero_basic"
  | "hero_zeitbuchung"
  | "tower_bolt"
  | "creep_ranged"
  | "payroll_coin";

export interface Projectile extends Entity {
  type:        EntityType.Projectile;
  kind:        ProjectileKind;
  targetId:    string;
  speed:       number;
  damage:      number;
  isLastHit:   boolean;   // flagged by hero for last-hit intent
  fromAbility: AbilityId | null;
  angle:       number;    // fallback direction if target dies
  orbitAngle:  number;    // for payroll_coin orbiting effect
}

// ── Floating Text ────────────────────────────────────────────────────────────

export interface FloatingText {
  id:    string;
  pos:   Vec2;
  text:  string;
  color: string;
  alpha: number;
  vy:    number;
  life:  number;
  size:  number;
}

// ── EventBus ─────────────────────────────────────────────────────────────────

export interface GameEventMap {
  LAST_HIT:             { lohn: number; xp: number };
  DENY:                 Record<string, never>;
  ENTITY_KILLED:        { killerId: string; targetId: string; isHeroKill: boolean; lohnBounty: number; xpBounty: number };
  TOWER_DESTROYED:      { tower: Tower; lohn: number; xp: number };
  ANCIENT_DESTROYED:    Record<string, never>;
  RADIANT_HQ_DESTROYED: Record<string, never>;
  HERO_KILLED:          Record<string, never>;
  LEVEL_UP:             { level: number };
  ITEM_PURCHASED:       { itemId: string; name: string };
  ABILITY_USED:         { abilityId: string };
}

export type GameEventType = keyof GameEventMap;

// ── Wave ─────────────────────────────────────────────────────────────────────

export interface WaveState {
  waveNumber:    number;
  nextWaveTimer: number;
  WAVE_INTERVAL: number;
}

// ── Economy ──────────────────────────────────────────────────────────────────

export interface EconomyState {
  passiveTimer: number;
  lohnHistory:  number[];
}

// ── Camera ───────────────────────────────────────────────────────────────────

export interface Camera {
  x:          number;
  y:          number;
  targetX:    number;
  targetY:    number;
  LERP_SPEED: number;
}

// ── Input ────────────────────────────────────────────────────────────────────

export interface InputState {
  mouseWorld:      Vec2;
  mouseScreen:     Vec2;
  keys:            Set<string>;
  rightClickDown:  boolean;
  leftClickDown:   boolean;
  // consumed each frame
  rightClickFired: boolean;
  leftClickFired:  boolean;
  pendingAbility:  AbilityId | null;   // key pressed, waiting for target click
}

// ── AoE Effect (visual only) ─────────────────────────────────────────────────

export interface AoEEffect {
  id:       string;
  pos:      Vec2;
  radius:   number;
  maxLife:  number;
  life:     number;
  color:    string;
  kind:     "ring" | "fill";
}

// ── Global GameState ─────────────────────────────────────────────────────────

export interface GameState {
  phase:          GamePhase;
  hero:           Hero;
  radiantCreeps:  Creep[];
  direCreeps:     Creep[];
  radiantTowers:  Tower[];   // index 0=T1, 1=T2, 2=T3, 3=HQ
  direTowers:     Tower[];   // index 0=T1, 1=T2, 2=T3, 3=Ancient
  projectiles:    Projectile[];
  floatingTexts:  FloatingText[];
  aoeEffects:     AoEEffect[];
  wave:           WaveState;
  economy:        EconomyState;
  camera:         Camera;
  input:          InputState;
  canvas:         HTMLCanvasElement;
  ctx:            CanvasRenderingContext2D;
  totalTime:      number;
  shopOpen:       boolean;
  victoryTime:    number;
  logoImage:      HTMLImageElement | null;
  respawnTimer:   number;       // 0 = nicht am Respawnen, >0 = Countdown
  deathCount:     number;
}
