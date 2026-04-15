// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — ui/hud.ts  |  HUD: HP, XP, Lohn, Fähigkeiten, Minimap
// ─────────────────────────────────────────────────────────────────────────────

import { GameState, AbilityState, AbilityId, Team, CreepVariant } from "../types";
import { CANVAS_W, CANVAS_H, renderMinimap } from "../map";
import { tryLevelAbility } from "../systems/abilities";

// ── Info-Panel Toggle ────────────────────────────────────────────────────────

let infoPanelVisible = true;

export function toggleInfoPanel(): void {
  infoPanelVisible = !infoPanelVisible;
}

// ── Farben ────────────────────────────────────────────────────────────────────

const COL = {
  hpBar:    "#4CAF50",
  hpBg:     "#1a1a1a",
  xpBar:    "#00BCD4",
  lohn:     "#FFD700",
  text:     "#E0E0E0",
  dimText:  "#666",
  panel:    "rgba(0,0,0,0.65)",
  border:   "#333",
  ready:    "#FFFFFF",
  cooldown: "#555555",
  passive:  "#9E9E9E",
};

// ── Haupt-HUD Render ──────────────────────────────────────────────────────────

export function renderHUD(ctx: CanvasRenderingContext2D, state: GameState): void {
  const hero = state.hero;

  // ── Obere Leiste: Lohn, Level, Welle ────────────────────────────────────────
  // Hintergrund
  ctx.fillStyle = COL.panel;
  ctx.fillRect(0, 0, CANVAS_W, 36);
  ctx.strokeStyle = COL.border;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(0, 36); ctx.lineTo(CANVAS_W, 36); ctx.stroke();

  // Lohn (links)
  ctx.fillStyle = COL.lohn;
  ctx.font = "bold 18px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`₲ ${Math.floor(hero.lohn).toLocaleString("de-DE")}`, 16, 18);

  // Passiv-Lohn
  ctx.fillStyle = COL.dimText;
  ctx.font = "12px monospace";
  ctx.fillText(`+${hero.passiveLohnRate}/s`, 180, 18);

  // Level + XP (Mitte)
  ctx.fillStyle = COL.text;
  ctx.textAlign = "center";
  ctx.font = "bold 14px monospace";
  ctx.fillText(`LVL ${hero.level}`, CANVAS_W / 2, 12);
  ctx.fillStyle = COL.dimText;
  ctx.font = "11px monospace";
  if (hero.level < 25) {
    ctx.fillText(`${hero.xp}/${hero.xpToNext} XP`, CANVAS_W / 2, 28);
  } else {
    ctx.fillText("MAX", CANVAS_W / 2, 28);
  }

  // Welle (rechts)
  ctx.fillStyle = COL.text;
  ctx.textAlign = "right";
  ctx.font = "13px monospace";
  const waveText = `Welle ${state.wave.waveNumber}`;
  ctx.fillText(waveText, CANVAS_W - 120, 12);
  ctx.fillStyle = COL.dimText;
  ctx.font = "11px monospace";
  ctx.fillText(`Nächste: ${Math.ceil(state.wave.nextWaveTimer)}s`, CANVAS_W - 120, 28);

  // Spielzeit (ganz rechts)
  ctx.fillStyle = COL.dimText;
  ctx.textAlign = "right";
  ctx.font = "12px monospace";
  const mins = Math.floor(state.totalTime / 60);
  const secs = Math.floor(state.totalTime % 60);
  ctx.fillText(`${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`, CANVAS_W - 16, 18);

  // ── Skill-Punkte Hinweis ──────────────────────────────────────────────────
  if (hero.skillPoints > 0) {
    ctx.fillStyle = "#FFD700";
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(`⬆ ${hero.skillPoints} Skillpunkte verfügbar (STRG+Q/W/E/R)`, CANVAS_W / 2, 52);
  }

  // ── Untere Leiste: HP-Bar + Fähigkeiten ─────────────────────────────────────
  const barY = CANVAS_H - 80;

  // Hintergrund-Panel
  ctx.fillStyle = COL.panel;
  ctx.fillRect(0, barY, CANVAS_W, 80);
  ctx.strokeStyle = COL.border;
  ctx.beginPath(); ctx.moveTo(0, barY); ctx.lineTo(CANVAS_W, barY); ctx.stroke();

  // HP-Bar
  const hpBarX = CANVAS_W / 2 - 180;
  const hpBarW = 360;
  const hpBarH = 16;
  const hpBarY = barY + 10;
  const hpPct = Math.max(0, hero.hp / hero.maxHp);

  ctx.fillStyle = COL.hpBg;
  ctx.fillRect(hpBarX, hpBarY, hpBarW, hpBarH);
  ctx.fillStyle = hpPct < 0.3 ? "#f44336" : COL.hpBar;
  ctx.fillRect(hpBarX, hpBarY, Math.round(hpBarW * hpPct), hpBarH);
  ctx.strokeStyle = "#555";
  ctx.strokeRect(hpBarX, hpBarY, hpBarW, hpBarH);

  ctx.fillStyle = COL.text;
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(hero.hp)} / ${hero.maxHp}`, CANVAS_W / 2, hpBarY + hpBarH / 2 + 1);

  // XP-Bar (schmal unter HP)
  const xpBarY = hpBarY + hpBarH + 2;
  const xpBarH = 5;
  const xpPct = hero.level < 25 ? hero.xp / hero.xpToNext : 1;
  ctx.fillStyle = COL.hpBg;
  ctx.fillRect(hpBarX, xpBarY, hpBarW, xpBarH);
  ctx.fillStyle = COL.xpBar;
  ctx.fillRect(hpBarX, xpBarY, Math.round(hpBarW * xpPct), xpBarH);

  // ── Fähigkeiten-Icons (Q/W/E/R) ──────────────────────────────────────────
  const abilityY = barY + 42;
  const abilitySize = 34;
  const abilityGap = 6;
  const totalW = 4 * abilitySize + 3 * abilityGap;
  const startX = CANVAS_W / 2 - totalW / 2;

  const abilityKeys = ["Q", "W", "E", "R"];

  for (let i = 0; i < 4; i++) {
    const ability = hero.abilities[i];
    const x = startX + i * (abilitySize + abilityGap);

    // Box
    let bgColor = COL.hpBg;
    let textColor = COL.ready;

    if (ability.level === 0) {
      bgColor = "#0a0a0a";
      textColor = "#333";
    } else if (ability.isPassive) {
      bgColor = "#1a2a1a";
      textColor = COL.passive;
    } else if (ability.state === AbilityState.OnCooldown) {
      bgColor = "#1a1a1a";
      textColor = COL.cooldown;
    } else {
      bgColor = "#1a2a1a";
    }

    ctx.fillStyle = bgColor;
    ctx.fillRect(x, abilityY, abilitySize, abilitySize);
    ctx.strokeStyle = ability.level > 0 && ability.state === AbilityState.Ready ? "#4CAF50" : "#444";
    ctx.lineWidth = ability.level > 0 && ability.state === AbilityState.Ready ? 2 : 1;
    ctx.strokeRect(x, abilityY, abilitySize, abilitySize);

    // Cooldown-Overlay
    if (ability.state === AbilityState.OnCooldown && ability.level > 0) {
      const cdMax = ability.cooldownMax[ability.level - 1];
      const cdPct = cdMax > 0 ? ability.timer / cdMax : 0;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(x, abilityY, abilitySize, Math.round(abilitySize * cdPct));

      // CD-Timer
      ctx.fillStyle = "#FF5722";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.fillText(Math.ceil(ability.timer).toString(), x + abilitySize / 2, abilityY + abilitySize / 2 + 4);
    }

    // Taste
    ctx.fillStyle = textColor;
    ctx.font = "bold 13px monospace";
    ctx.textAlign = "center";
    ctx.fillText(abilityKeys[i], x + abilitySize / 2, abilityY + abilitySize / 2 + (ability.state === AbilityState.OnCooldown ? -8 : 4));

    // Passiv-Label
    if (ability.isPassive && ability.level > 0) {
      ctx.fillStyle = "#9E9E9E";
      ctx.font = "8px monospace";
      ctx.fillText("PASSIV", x + abilitySize / 2, abilityY + abilitySize - 4);
    }

    // Level-Punkte
    const maxLvl = ability.id === AbilityId.PayrollRun ? 3 : 4;
    for (let lvl = 0; lvl < maxLvl; lvl++) {
      const dotX = x + 5 + lvl * 8;
      const dotY = abilityY - 4;
      ctx.fillStyle = lvl < ability.level ? "#FFD700" : "#333";
      ctx.beginPath(); ctx.arc(dotX, dotY, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ── Items (rechts unten, 6 Slots) ───────────────────────────────────────────
  const itemSize = 30;
  const itemGap  = 4;
  const itemsX   = CANVAS_W - 6 * (itemSize + itemGap) - 16;
  const itemsY   = barY + 14;

  ctx.fillStyle = COL.dimText;
  ctx.font = "10px monospace";
  ctx.textAlign = "left";
  ctx.fillText("Ausrüstung:", itemsX, itemsY - 4);

  for (let i = 0; i < hero.items.length; i++) {
    const item = hero.items[i];
    const x = itemsX + i * (itemSize + itemGap);

    ctx.fillStyle = item.purchased ? "#2a3a2a" : "#0d0d0d";
    ctx.fillRect(x, itemsY, itemSize, itemSize);
    ctx.strokeStyle = item.purchased ? "#4CAF50" : "#222";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, itemsY, itemSize, itemSize);

    if (item.purchased) {
      ctx.fillStyle = COL.lohn;
      ctx.font = "bold 10px monospace";
      ctx.textAlign = "center";
      ctx.fillText(item.name.charAt(0), x + itemSize / 2, itemsY + itemSize / 2 + 3);
    }
  }

  // ── Shop-Hinweis ────────────────────────────────────────────────────────────
  ctx.fillStyle = COL.dimText;
  ctx.font = "11px monospace";
  ctx.textAlign = "right";
  ctx.fillText("[B] Kantine", CANVAS_W - 16, barY + itemsY + itemSize + 14 - barY);

  // ── Hero-Name (links unten) ────────────────────────────────────────────────
  ctx.fillStyle = COL.text;
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "left";
  ctx.fillText(`📋 ${hero.name}`, 210, barY + 18);
  ctx.fillStyle = COL.dimText;
  ctx.font = "11px monospace";
  ctx.fillText(`ATK: ${hero.attackDamage} | SPD: ${hero.moveSpeed} | ARM: ${hero.armor}`, 210, barY + 34);

  // Minimap
  renderMinimap(ctx, state);

  // Info-Panel (rechte Seite, H zum Ein-/Ausschalten)
  if (infoPanelVisible) {
    renderInfoPanel(ctx, state);
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText("[H] Info einblenden", CANVAS_W - 12, 56);
    ctx.textAlign = "left";
  }
}

// ── Info-Panel (rechte Seite, dauerhaft sichtbar) ────────────────────────────

function renderInfoPanel(ctx: CanvasRenderingContext2D, state: GameState): void {
  const hero = state.hero;
  const panelW = 210;
  const panelX = CANVAS_W - panelW - 10;
  const panelY = 44;
  const panelH = 370;

  // Hintergrund
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(panelX, panelY, panelW, panelH);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.strokeRect(panelX, panelY, panelW, panelH);

  const x = panelX + 10;
  let y = panelY + 18;
  const lineH = 15;

  // ── Steuerung ──
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "left";
  ctx.fillText("STEUERUNG", x, y);
  y += lineH + 2;

  ctx.fillStyle = COL.dimText;
  ctx.font = "10px monospace";

  const controls = [
    ["Rechtsklick", "Bewegen / Angriff"],
    ["Pfeiltasten", "Held bewegen"],
    ["Q / W / E / R", "Faehigkeit nutzen"],
    ["STRG+Q/W/E/R", "Faehigkeit leveln"],
    ["B", "Kantine oeffnen"],
    ["ESC", "Kantine schliessen"],
  ];

  for (const [key, desc] of controls) {
    ctx.fillStyle = "#AAAAAA";
    ctx.fillText(key, x, y);
    ctx.fillStyle = COL.dimText;
    ctx.fillText(desc, x + 95, y);
    y += lineH;
  }

  // ── Trennlinie ──
  y += 6;
  ctx.strokeStyle = "#333";
  ctx.beginPath();
  ctx.moveTo(panelX + 8, y);
  ctx.lineTo(panelX + panelW - 8, y);
  ctx.stroke();
  y += 12;

  // ── Faehigkeiten ──
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 11px monospace";
  ctx.fillText("FAEHIGKEITEN", x, y);
  y += lineH + 4;

  const abilityKeys = ["Q", "W", "E", "R"];

  for (let i = 0; i < hero.abilities.length; i++) {
    const ability = hero.abilities[i];
    const key = abilityKeys[i];

    // Taste + Name
    ctx.fillStyle = ability.level > 0 ? "#FFFFFF" : "#555";
    ctx.font = "bold 10px monospace";
    ctx.fillText(`[${key}] ${ability.name}`, x, y);

    // Level
    const maxLvl = ability.id === AbilityId.PayrollRun ? 3 : 4;
    ctx.fillStyle = "#FFD700";
    ctx.font = "10px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`Lv ${ability.level}/${maxLvl}`, panelX + panelW - 10, y);
    ctx.textAlign = "left";
    y += lineH - 2;

    // Beschreibung
    ctx.fillStyle = COL.dimText;
    ctx.font = "9px monospace";
    const desc = ability.description;
    // Beschreibung ggf. kuerzen
    const maxChars = 28;
    ctx.fillText(desc.length > maxChars ? desc.substring(0, maxChars - 1) + ".." : desc, x, y);
    y += lineH + 4;
  }
}

// ── Rendere HP-Bars über Entities (world-space, vor camera restore) ──────────

export function renderEntityHPBars(ctx: CanvasRenderingContext2D, state: GameState): void {
  const hero = state.hero;

  // Creeps
  for (const creep of state.radiantCreeps) renderCreepHPBar(ctx, creep);
  for (const creep of state.direCreeps)    renderCreepHPBar(ctx, creep);

  // Hero HP-Bar (world-space)
  if (hero.alive) {
    const bw = 50;
    const bh = 5;
    const bx = hero.pos.x - bw / 2;
    const by = hero.pos.y - hero.radius - 14;
    const pct = hero.hp / hero.maxHp;

    ctx.fillStyle = "#111";
    ctx.fillRect(Math.round(bx), Math.round(by), bw, bh);
    ctx.fillStyle = pct < 0.3 ? "#f44336" : "#4CAF50";
    ctx.fillRect(Math.round(bx), Math.round(by), Math.round(bw * pct), bh);
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(Math.round(bx), Math.round(by), bw, bh);
  }
}

function renderCreepHPBar(ctx: CanvasRenderingContext2D, creep: import("../types").Creep): void {
  if (!creep.alive) return;
  const bw = 32;
  const bh = 4;
  const bx = creep.pos.x - bw / 2;
  const by = creep.pos.y - creep.radius - 10;
  const pct = creep.hp / creep.maxHp;

  // Hintergrund
  ctx.fillStyle = "#111";
  ctx.fillRect(Math.round(bx), Math.round(by), bw, bh);

  // Farbe
  if (creep.isLastHitWindow && creep.team === Team.Dire) {
    // Blinken bei Last-Hit-Fenster
    ctx.fillStyle = Math.floor(Date.now() / 200) % 2 === 0 ? "#FF1744" : "#FF5722";
  } else {
    ctx.fillStyle = creep.team === Team.Radiant ? "#4CAF50" : "#FF5722";
  }
  ctx.fillRect(Math.round(bx), Math.round(by), Math.round(bw * pct), bh);

  // Creep-Typ Icon
  if (creep.variant === CreepVariant.Siege) {
    ctx.fillStyle = "#FFD700";
    ctx.font = "8px monospace";
    ctx.textAlign = "center";
    ctx.fillText("▣", creep.pos.x, by - 3);
  }
}

// ── Rendere schwebende Texte ──────────────────────────────────────────────────

export function updateFloatingTexts(state: GameState, dt: number): void {
  for (const ft of state.floatingTexts) {
    ft.life -= dt;
    ft.pos.y += ft.vy * dt;
    ft.alpha = Math.max(0, ft.life / 1.5);
  }
  state.floatingTexts = state.floatingTexts.filter(f => f.life > 0);
}

export function renderFloatingTexts(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const ft of state.floatingTexts) {
    if (ft.alpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = ft.alpha;
    ctx.fillStyle = ft.color;
    ctx.font = `bold ${ft.size}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(ft.text, Math.round(ft.pos.x), Math.round(ft.pos.y));
    ctx.restore();
  }
}

// ── AoE-Effekte Render ───────────────────────────────────────────────────────

export function renderAoEEffects(ctx: CanvasRenderingContext2D, state: GameState): void {
  for (const effect of state.aoeEffects) {
    const alpha = (effect.life / effect.maxLife) * 0.35;
    ctx.save();
    ctx.globalAlpha = alpha;

    if (effect.kind === "ring") {
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 4;
      const expandedR = effect.radius * (1 - effect.life / effect.maxLife * 0.3);
      ctx.beginPath();
      ctx.arc(effect.pos.x, effect.pos.y, expandedR, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.fillStyle = effect.color;
      ctx.beginPath();
      ctx.arc(effect.pos.x, effect.pos.y, effect.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
