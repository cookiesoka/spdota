// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — game.ts  |  Gameloop, State Machine, Verdrahtung aller Systeme
// ─────────────────────────────────────────────────────────────────────────────

import {
  GameState, GamePhase, Team, EntityType, Vec2
} from "./types";
import { CANVAS_W, CANVAS_H, WORLD_W, WORLD_H, updateCamera, renderMap } from "./map";
import { EventBus } from "./eventbus";
import { createHero } from "./entities/hero";
import { createAllTowers } from "./entities/tower";
import { renderTower, updateTowers } from "./entities/tower";
import { updateCreeps } from "./entities/creep";
import { updateProjectiles, renderProjectile } from "./entities/projectile";
import { updateHeroCombat, entityCleanup } from "./systems/combat";
import { initEconomyListeners, updateEconomy } from "./systems/economy";
import { updateWaves } from "./systems/waves";
import { updateAbilities, updatePayrollCoins, updateAoEEffects } from "./systems/abilities";
import { renderHUD, renderEntityHPBars, updateFloatingTexts, renderFloatingTexts, renderAoEEffects } from "./ui/hud";
import { renderShop } from "./ui/shop";

const FIXED_DT = 1 / 60;

// ── State initialisieren ──────────────────────────────────────────────────────

export function createGameState(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): GameState {
  const hero = createHero();
  const { radiantTowers, direTowers } = createAllTowers();

  const state: GameState = {
    phase:       GamePhase.MainMenu,
    hero,
    radiantCreeps: [],
    direCreeps:    [],
    radiantTowers,
    direTowers,
    projectiles: [],
    floatingTexts: [],
    aoeEffects: [],
    wave: {
      waveNumber:    0,
      nextWaveTimer: 5,   // Erste Welle nach 5s
      WAVE_INTERVAL: 30,
    },
    economy: {
      passiveTimer: 0,
      lohnHistory:  [],
    },
    camera: {
      x: hero.pos.x - CANVAS_W / 2,
      y: hero.pos.y - CANVAS_H / 2,
      targetX: 0, targetY: 0,
      LERP_SPEED: 0.08,
    },
    input: {
      mouseWorld:  { x: 0, y: 0 },
      mouseScreen: { x: 0, y: 0 },
      keys:            new Set(),
      rightClickDown:  false,
      leftClickDown:   false,
      rightClickFired: false,
      leftClickFired:  false,
      pendingAbility:  null,
    },
    canvas, ctx,
    totalTime:  0,
    shopOpen:   false,
    victoryTime: 0,
    logoImage:  null,
    respawnTimer: 0,
    deathCount:   0,
    stage:        1,
    stageBannerTimer: 0,
    paused:       false,
  };

  // Event-Listener
  EventBus.clear();
  initEconomyListeners(state);

  return state;
}

export function resetForNewGame(state: GameState): void {
  const hero = createHero();
  const { radiantTowers, direTowers } = createAllTowers();

  state.hero           = hero;
  state.radiantCreeps  = [];
  state.direCreeps     = [];
  state.radiantTowers  = radiantTowers;
  state.direTowers     = direTowers;
  state.projectiles    = [];
  state.floatingTexts  = [];
  state.aoeEffects     = [];
  state.wave           = { waveNumber: 0, nextWaveTimer: 5, WAVE_INTERVAL: 30 };
  state.economy        = { passiveTimer: 0, lohnHistory: [] };
  state.camera.x       = hero.pos.x - CANVAS_W / 2;
  state.camera.y       = hero.pos.y - CANVAS_H / 2;
  state.totalTime      = 0;
  state.shopOpen       = false;
  state.phase          = GamePhase.InGame;
  state.respawnTimer   = 0;
  state.deathCount     = 0;
  state.stage          = 1;
  state.stageBannerTimer = 0;
  state.paused         = false;

  EventBus.clear();
  initEconomyListeners(state);
}

// ── Update ────────────────────────────────────────────────────────────────────

export function update(state: GameState, dt: number): void {
  if (state.phase !== GamePhase.InGame) return;
  if (state.paused) {
    // Input-Flags trotzdem zurücksetzen, damit kein Klick "hängen" bleibt
    state.input.rightClickFired = false;
    state.input.leftClickFired  = false;
    return;
  }

  state.totalTime += dt;

  // 1. Wellen
  updateWaves(state, dt);

  // 2. Passiv-Ökonomie
  updateEconomy(state, dt);

  // 3. Hero (Bewegung + Angriff)
  updateHeroCombat(state, dt);

  // 4. Creeps (Pathfinding + Aggro)
  updateCreeps(state, dt);

  // 5. Towers
  updateTowers(state, dt);

  // 6. Projektile
  updateProjectiles(state, dt);

  // 7. Fähigkeiten-Cooldowns
  updateAbilities(state, dt);

  // 8. Payroll-Coins
  updatePayrollCoins(state, dt);

  // 9. AoE-Effekte
  updateAoEEffects(state, dt);

  // 10. Events dispatchen
  EventBus.dispatch();

  // 11. Kamera
  updateCamera(state, dt);

  // 12. Floating Texts
  updateFloatingTexts(state, dt);

  // 13. Cleanup
  entityCleanup(state);

  // Input-Flags zurücksetzen
  state.input.rightClickFired = false;
  state.input.leftClickFired  = false;
}

// ── Render ────────────────────────────────────────────────────────────────────

export function render(state: GameState): void {
  const ctx = state.ctx;
  const cam = state.camera;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  if (state.phase === GamePhase.MainMenu) {
    renderMainMenu(ctx, state);
    return;
  }

  // === World-Space ===
  ctx.save();
  ctx.translate(Math.round(-cam.x), Math.round(-cam.y));

  // 1. Boden
  renderMap(ctx, cam);

  // 2. Towers
  for (const t of state.radiantTowers) renderTower(ctx, t);
  for (const t of state.direTowers)    renderTower(ctx, t);

  // 3. AoE-Effekte (unter Einheiten)
  renderAoEEffects(ctx, state);

  // 4. Creeps (sortiert nach Y)
  const allCreeps = [...state.radiantCreeps, ...state.direCreeps]
    .filter(c => c.alive)
    .sort((a, b) => a.pos.y - b.pos.y);
  for (const creep of allCreeps) renderCreep(ctx, creep);

  // 5. Hero
  if (state.hero.alive) renderHero(ctx, state);

  // 6. Projektile
  for (const p of state.projectiles) {
    if (p.alive) renderProjectile(ctx, p);
  }

  // 7. HP-Bars (world-space)
  renderEntityHPBars(ctx, state);

  // 8. Floating Texts (world-space)
  renderFloatingTexts(ctx, state);

  // Move target indicator
  if (state.hero.moveTarget && state.hero.alive) {
    const mt = state.hero.moveTarget;
    ctx.strokeStyle = "rgba(76,175,80,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(mt.x, mt.y, 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();

  // === Screen-Space ===
  // 8. HUD
  renderHUD(ctx, state);

  // 9. Shop
  renderShop(ctx, state);

  // 10. Respawn-Countdown
  if (state.respawnTimer > 0 && !state.hero.alive) {
    renderRespawnOverlay(ctx, state);
  }

  // 10b. Akt-Banner
  if (state.stageBannerTimer > 0) {
    renderStageBanner(ctx, state);
  }

  // 10c. Pause-Overlay
  if (state.paused && state.phase === GamePhase.InGame) {
    renderPauseOverlay(ctx);
  }

  // 11. Victory/Defeat
  if (state.phase === GamePhase.Victory)  renderVictory(ctx, state);
  if (state.phase === GamePhase.Defeat)   renderDefeat(ctx, state);
}

function renderPauseOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 56px monospace";
  ctx.textAlign = "center";
  ctx.fillText("⏸  PAUSE", CANVAS_W / 2, CANVAS_H / 2 - 10);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "16px monospace";
  ctx.fillText("Leertaste drücken zum Fortsetzen", CANVAS_W / 2, CANVAS_H / 2 + 30);
  ctx.restore();
}

function renderStageBanner(ctx: CanvasRenderingContext2D, state: GameState): void {
  const t = state.stageBannerTimer;
  const alpha = t > 4 ? (5 - t) : t > 1 ? 1 : t;   // ein/aus Fade
  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fillRect(0, CANVAS_H / 2 - 80, CANVAS_W, 160);

  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 42px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`AKT ${state.stage} / 6`, CANVAS_W / 2, CANVAS_H / 2 - 10);

  ctx.fillStyle = "#FF7043";
  ctx.font = "bold 18px monospace";
  ctx.fillText("Die Direktion verstärkt sich!", CANVAS_W / 2, CANVAS_H / 2 + 25);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "14px monospace";
  ctx.fillText("Volles Leben + Akt-Bonus erhalten", CANVAS_W / 2, CANVAS_H / 2 + 55);

  ctx.restore();
}

// ── Creep Render ──────────────────────────────────────────────────────────────

function renderCreep(ctx: CanvasRenderingContext2D, creep: import("./types").Creep): void {
  const { pos, radius, team, variant, alive, isLastHitWindow, slowTimer } = creep;
  if (!alive) return;

  const baseColor = team === Team.Radiant ? "#66BB6A" : "#FF7043";

  ctx.save();
  ctx.translate(Math.round(pos.x), Math.round(pos.y));

  // Slow-Indikator
  if (slowTimer > 0) {
    ctx.strokeStyle = "rgba(255,152,0,0.4)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, radius + 6, 0, Math.PI * 2); ctx.stroke();
  }

  // Körper
  ctx.beginPath();
  if (variant === "melee") {
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
  } else if (variant === "ranged") {
    // Diamant
    ctx.moveTo(0, -radius);
    ctx.lineTo(radius, 0);
    ctx.lineTo(0, radius);
    ctx.lineTo(-radius, 0);
    ctx.closePath();
  } else {
    // Siege: Quadrat
    ctx.rect(-radius, -radius, radius * 2, radius * 2);
  }

  ctx.fillStyle = isLastHitWindow && team === Team.Dire
    ? (Math.floor(Date.now() / 150) % 2 === 0 ? "#FF1744" : baseColor)
    : baseColor;
  ctx.fill();
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Team-Indikator
  ctx.fillStyle = team === Team.Radiant ? "#1B5E20" : "#BF360C";
  ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// ── Hero Render ───────────────────────────────────────────────────────────────

function renderHero(ctx: CanvasRenderingContext2D, state: GameState): void {
  const hero = state.hero;
  const { pos, radius, facingAngle, zeitbuchungReady, payrollRunActive } = hero;

  ctx.save();
  ctx.translate(Math.round(pos.x), Math.round(pos.y));

  // Glow
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 2.5);
  glow.addColorStop(0, payrollRunActive ? "rgba(255,215,0,0.35)" : "rgba(76,175,80,0.2)");
  glow.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(0, 0, radius * 2.5, 0, Math.PI * 2); ctx.fill();

  // Body
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#4CAF50";
  ctx.fill();
  ctx.strokeStyle = zeitbuchungReady ? "#00BCD4" : "#1B5E20";
  ctx.lineWidth = zeitbuchungReady ? 3 : 2;
  ctx.stroke();

  // Richtungspfeil
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(Math.cos(facingAngle) * (radius + 10), Math.sin(facingAngle) * (radius + 10));
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Buchhalter-Symbol
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("₲", 0, 0);

  // Zeitbuchung bereit → Schimmer
  if (zeitbuchungReady) {
    ctx.strokeStyle = "#00BCD4";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(Date.now() / 200);
    ctx.beginPath(); ctx.arc(0, 0, radius + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

// ── Respawn-Overlay ──────────────────────────────────────────────────────────

function renderRespawnOverlay(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Leichtes Abdunkeln
  ctx.fillStyle = "rgba(30,0,0,0.4)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Countdown
  const secs = Math.ceil(state.respawnTimer);
  ctx.fillStyle = "#FF5722";
  ctx.font = "bold 28px monospace";
  ctx.textAlign = "center";
  ctx.fillText("GEFALLEN!", CANVAS_W / 2, CANVAS_H / 2 - 20);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 22px monospace";
  ctx.fillText(`Respawn in ${secs}s`, CANVAS_W / 2, CANVAS_H / 2 + 15);

  ctx.fillStyle = "#FFD700";
  ctx.font = "14px monospace";
  ctx.fillText(`Tod #${state.deathCount}  |  -15% Lohn`, CANVAS_W / 2, CANVAS_H / 2 + 45);
}

// ── Hauptmenü ─────────────────────────────────────────────────────────────────

function renderMainMenu(ctx: CanvasRenderingContext2D, state: GameState): void {
  // Dunkler Hintergrund
  ctx.fillStyle = "#0a0f0a";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Dekorative Linien
  ctx.strokeStyle = "#1a2a1a";
  ctx.lineWidth = 1;
  for (let i = 0; i < CANVAS_W; i += 60) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, CANVAS_H); ctx.stroke();
  }

  // Logo laden und anzeigen
  if (state.logoImage && state.logoImage.complete) {
    const logoH = 80;
    const logoW = (state.logoImage.width / state.logoImage.height) * logoH;
    ctx.drawImage(state.logoImage, (CANVAS_W - logoW) / 2, 140, logoW, logoH);
  } else {
    // Fallback-Text
    ctx.fillStyle = "#4CAF50";
    ctx.font = "bold 48px monospace";
    ctx.textAlign = "center";
    ctx.fillText("sp_dota", CANVAS_W / 2, 190);
  }

  // Untertitel
  ctx.fillStyle = "#666";
  ctx.font = "16px monospace";
  ctx.textAlign = "center";
  ctx.fillText("P A Y R O L L   W A R S", CANVAS_W / 2, 260);

  // Held auswählen
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 14px monospace";
  ctx.fillText("Dein Held:", CANVAS_W / 2, 320);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 20px monospace";
  ctx.fillText("📋 Der Buchhalter", CANVAS_W / 2, 350);

  ctx.fillStyle = "#AAAAAA";
  ctx.font = "13px monospace";
  ctx.fillText("620 HP  |  55 ATK  |  300 SPD  |  Ranged", CANVAS_W / 2, 375);

  // Start-Button
  const btnW = 260;
  const btnH = 50;
  const btnX = (CANVAS_W - btnW) / 2;
  const btnY = 420;

  const hover = state.input.mouseScreen.x >= btnX &&
                state.input.mouseScreen.x <= btnX + btnW &&
                state.input.mouseScreen.y >= btnY &&
                state.input.mouseScreen.y <= btnY + btnH;

  ctx.fillStyle = hover ? "#388E3C" : "#2E7D32";
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = "#4CAF50";
  ctx.lineWidth = 2;
  ctx.strokeRect(btnX, btnY, btnW, btnH);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 18px monospace";
  ctx.fillText("▶  SPIEL STARTEN", CANVAS_W / 2, btnY + btnH / 2 + 6);

  // Steuerung
  ctx.fillStyle = "#555";
  ctx.font = "11px monospace";
  const controlY = 520;
  ctx.fillText("Rechtsklick: Bewegen / Angreifen  |  Q/W/E/R: Fähigkeiten  |  B: Kantine", CANVAS_W / 2, controlY);
  ctx.fillText("SHIFT+Q/W/E/R: Fähigkeit leveln  |  Ziel: Dire Direktionszentrale zerstören!", CANVAS_W / 2, controlY + 18);
}

// ── Victory-Overlay ───────────────────────────────────────────────────────────

function renderVictory(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "rgba(0,30,0,0.85)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = "#4CAF50";
  ctx.font = "bold 36px monospace";
  ctx.textAlign = "center";
  ctx.fillText("✅ DIREKTIONSZENTRALE ZERSTÖRT!", CANVAS_W / 2, 200);

  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 24px monospace";
  ctx.fillText("SIEG!", CANVAS_W / 2, 250);

  const mins = Math.floor(state.victoryTime / 60);
  const secs = Math.floor(state.victoryTime % 60);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "16px monospace";
  ctx.fillText(`Spielzeit: ${mins}:${String(secs).padStart(2, "0")}`, CANVAS_W / 2, 310);
  ctx.fillText(`Level: ${state.hero.level}`, CANVAS_W / 2, 340);
  ctx.fillText(`Lohn verdient: ₲ ${Math.floor(state.hero.lohn).toLocaleString("de-DE")}`, CANVAS_W / 2, 370);

  renderRestartButton(ctx, state);
}

// ── Defeat-Overlay ────────────────────────────────────────────────────────────

function renderDefeat(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.fillStyle = "rgba(30,0,0,0.85)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.fillStyle = "#FF5722";
  ctx.font = "bold 36px monospace";
  ctx.textAlign = "center";
  ctx.fillText("💀 GEHALTSKÜRZUNG FATAL!", CANVAS_W / 2, 220);

  ctx.fillStyle = "#FF8A80";
  ctx.font = "bold 20px monospace";
  ctx.fillText("NIEDERLAGE", CANVAS_W / 2, 260);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "16px monospace";
  const mins = Math.floor(state.totalTime / 60);
  const secs = Math.floor(state.totalTime % 60);
  ctx.fillText(`Spielzeit: ${mins}:${String(secs).padStart(2, "0")}`, CANVAS_W / 2, 320);
  ctx.fillText(`Level: ${state.hero.level}`, CANVAS_W / 2, 350);

  renderRestartButton(ctx, state);
}

function renderRestartButton(ctx: CanvasRenderingContext2D, state: GameState): void {
  const btnW = 220;
  const btnH = 44;
  const btnX = (CANVAS_W - btnW) / 2;
  const btnY = 430;

  const hover = state.input.mouseScreen.x >= btnX &&
                state.input.mouseScreen.x <= btnX + btnW &&
                state.input.mouseScreen.y >= btnY &&
                state.input.mouseScreen.y <= btnY + btnH;

  ctx.fillStyle = hover ? "#333" : "#222";
  ctx.fillRect(btnX, btnY, btnW, btnH);
  ctx.strokeStyle = "#666";
  ctx.lineWidth = 1;
  ctx.strokeRect(btnX, btnY, btnW, btnH);

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "center";
  ctx.fillText("🔄 NOCHMAL SPIELEN", CANVAS_W / 2, btnY + btnH / 2 + 5);
}

// ── Button Hit-Test (für Hauptmenü & Restart) ─────────────────────────────────

export function isStartButtonClicked(state: GameState): boolean {
  const btnW = 260; const btnH = 50;
  const btnX = (CANVAS_W - btnW) / 2;
  const btnY = 420;
  const mx = state.input.mouseScreen.x;
  const my = state.input.mouseScreen.y;
  return mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH;
}

export function isRestartButtonClicked(state: GameState): boolean {
  const btnW = 220; const btnH = 44;
  const btnX = (CANVAS_W - btnW) / 2;
  const btnY = 430;
  const mx = state.input.mouseScreen.x;
  const my = state.input.mouseScreen.y;
  return mx >= btnX && mx <= btnX + btnW && my >= btnY && my <= btnY + btnH;
}
