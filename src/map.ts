// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — map.ts  |  Lane-Layout, Waypoints, Render
// ─────────────────────────────────────────────────────────────────────────────

import { Vec2, Camera, GameState, Team } from "./types";

export const WORLD_W = 2400;
export const WORLD_H = 2400;
export const CANVAS_W = 1280;
export const CANVAS_H = 720;
export const LANE_WIDTH = 160;

// Waypoints: Radiant (links-unten) → Dire (rechts-oben)
export const LANE_WAYPOINTS: Vec2[] = [
  { x: 220,  y: 2180 },
  { x: 600,  y: 1800 },
  { x: 1000, y: 1400 },
  { x: 1200, y: 1200 },
  { x: 1400, y: 1000 },
  { x: 1800, y: 600  },
  { x: 2180, y: 220  },
];

// Radiant Creeps folgen den Waypoints vorwärts (Richtung Dire)
export const RADIANT_PATH: Vec2[] = [...LANE_WAYPOINTS];
// Dire Creeps folgen rückwärts (Richtung Radiant)
export const DIRE_PATH: Vec2[] = [...LANE_WAYPOINTS].reverse();

// Tower-Positionen
export const TOWER_POSITIONS = {
  radiant: {
    t1:  { x: 600,  y: 1800 },
    t2:  { x: 1050, y: 1350 },
    t3:  { x: 1750, y: 650  },
    hq:  { x: 220,  y: 2180 },
  },
  dire: {
    t1:  { x: 1800, y: 600  },
    t2:  { x: 1350, y: 1050 },
    t3:  { x: 650,  y: 1750 },
    ancient: { x: 2180, y: 220 },
  },
};

// ── Hilfsfunktionen ───────────────────────────────────────────────────────────

export function worldToScreen(pos: Vec2, cam: Camera): Vec2 {
  return { x: pos.x - cam.x, y: pos.y - cam.y };
}

export function screenToWorld(pos: Vec2, cam: Camera): Vec2 {
  return { x: pos.x + cam.x, y: pos.y + cam.y };
}

export function dist(a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
}

export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

export function uniqueId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// ── Kamera-Update (smooth follow) ────────────────────────────────────────────

export function updateCamera(state: GameState, dt: number): void {
  const cam = state.camera;
  const hero = state.hero;

  // Ziel: Held zentriert im Viewport
  cam.targetX = hero.pos.x - CANVAS_W / 2;
  cam.targetY = hero.pos.y - CANVAS_H / 2;

  // Grenzen der Weltkarte
  cam.targetX = clamp(cam.targetX, 0, WORLD_W - CANVAS_W);
  cam.targetY = clamp(cam.targetY, 0, WORLD_H - CANVAS_H);

  // Smooth interpolation
  cam.x += (cam.targetX - cam.x) * cam.LERP_SPEED * dt * 60;
  cam.y += (cam.targetY - cam.y) * cam.LERP_SPEED * dt * 60;
}

// ── Map-Render ────────────────────────────────────────────────────────────────

export function renderMap(ctx: CanvasRenderingContext2D, cam: Camera): void {
  // Hintergrund (Dota-dunkles Grün)
  ctx.fillStyle = "#0d1a0d";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Gras-Texture-Andeutung (Raster, nur sichtbarer Bereich)
  ctx.strokeStyle = "#0f1f0f";
  ctx.lineWidth = 1;
  const gridSize = 120;
  const startX = Math.floor(cam.x / gridSize) * gridSize;
  const endX   = cam.x + CANVAS_W + gridSize;
  const startY = Math.floor(cam.y / gridSize) * gridSize;
  const endY   = cam.y + CANVAS_H + gridSize;
  for (let x = startX; x <= endX; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  // Lane-Boden
  const wps = LANE_WAYPOINTS;
  ctx.save();
  ctx.lineWidth = LANE_WIDTH;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Lane-Füllung
  ctx.strokeStyle = "#1c2c1c";
  ctx.beginPath();
  ctx.moveTo(wps[0].x, wps[0].y);
  for (let i = 1; i < wps.length; i++) {
    ctx.lineTo(wps[i].x, wps[i].y);
  }
  ctx.stroke();

  // Lane-Rand
  ctx.lineWidth = LANE_WIDTH + 12;
  ctx.strokeStyle = "#0a150a";
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.moveTo(wps[0].x, wps[0].y);
  for (let i = 1; i < wps.length; i++) {
    ctx.lineTo(wps[i].x, wps[i].y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Mittellinie (gestrichelt, wie Fahrbahnmarkierung)
  ctx.setLineDash([20, 20]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#2a4a2a";
  ctx.beginPath();
  ctx.moveTo(wps[0].x, wps[0].y);
  for (let i = 1; i < wps.length; i++) {
    ctx.lineTo(wps[i].x, wps[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // Radiant-Base (grüner Bereich links-unten)
  const radHQ = TOWER_POSITIONS.radiant.hq;
  const radGrad = ctx.createRadialGradient(radHQ.x, radHQ.y, 0, radHQ.x, radHQ.y, 320);
  radGrad.addColorStop(0, "rgba(76,175,80,0.18)");
  radGrad.addColorStop(1, "rgba(76,175,80,0)");
  ctx.fillStyle = radGrad;
  ctx.beginPath();
  ctx.arc(radHQ.x, radHQ.y, 320, 0, Math.PI * 2);
  ctx.fill();

  // Dire-Base (roter Bereich rechts-oben)
  const dirAncient = TOWER_POSITIONS.dire.ancient;
  const dirGrad = ctx.createRadialGradient(dirAncient.x, dirAncient.y, 0, dirAncient.x, dirAncient.y, 320);
  dirGrad.addColorStop(0, "rgba(255,87,34,0.18)");
  dirGrad.addColorStop(1, "rgba(255,87,34,0)");
  ctx.fillStyle = dirGrad;
  ctx.beginPath();
  ctx.arc(dirAncient.x, dirAncient.y, 320, 0, Math.PI * 2);
  ctx.fill();
}

// ── Minimap-Render ────────────────────────────────────────────────────────────

const MM_X = 16;
const MM_Y = CANVAS_H - 196;
const MM_W = 180;
const MM_H = 180;

export function renderMinimap(ctx: CanvasRenderingContext2D, state: GameState): void {
  const { hero, radiantCreeps, direCreeps, radiantTowers, direTowers } = state;

  // Hintergrund
  ctx.fillStyle = "rgba(0,0,0,0.75)";
  ctx.fillRect(MM_X, MM_Y, MM_W, MM_H);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 1;
  ctx.strokeRect(MM_X, MM_Y, MM_W, MM_H);

  function toMM(pos: Vec2): Vec2 {
    return {
      x: MM_X + (pos.x / WORLD_W) * MM_W,
      y: MM_Y + (pos.y / WORLD_H) * MM_H,
    };
  }

  // Lane auf Minimap
  ctx.strokeStyle = "#2a4a2a";
  ctx.lineWidth = 4;
  ctx.beginPath();
  const wps = LANE_WAYPOINTS;
  const mm0 = toMM(wps[0]);
  ctx.moveTo(mm0.x, mm0.y);
  for (let i = 1; i < wps.length; i++) {
    const mm = toMM(wps[i]);
    ctx.lineTo(mm.x, mm.y);
  }
  ctx.stroke();

  // Towers
  for (const t of radiantTowers) {
    if (!t.destroyed) {
      const mm = toMM(t.pos);
      ctx.fillStyle = t.team === Team.Radiant ? "#4CAF50" : "#FF5722";
      ctx.fillRect(mm.x - 3, mm.y - 3, 6, 6);
    }
  }
  for (const t of direTowers) {
    if (!t.destroyed) {
      const mm = toMM(t.pos);
      ctx.fillStyle = "#FF5722";
      ctx.fillRect(mm.x - 3, mm.y - 3, 6, 6);
    }
  }

  // Creeps
  for (const c of radiantCreeps) {
    if (!c.alive) continue;
    const mm = toMM(c.pos);
    ctx.fillStyle = "#66BB6A";
    ctx.beginPath(); ctx.arc(mm.x, mm.y, 2, 0, Math.PI * 2); ctx.fill();
  }
  for (const c of direCreeps) {
    if (!c.alive) continue;
    const mm = toMM(c.pos);
    ctx.fillStyle = "#FF7043";
    ctx.beginPath(); ctx.arc(mm.x, mm.y, 2, 0, Math.PI * 2); ctx.fill();
  }

  // Viewport-Rechteck
  const cam = state.camera;
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.strokeRect(
    MM_X + (cam.x / WORLD_W) * MM_W,
    MM_Y + (cam.y / WORLD_H) * MM_H,
    (CANVAS_W / WORLD_W) * MM_W,
    (CANVAS_H / WORLD_H) * MM_H
  );

  // Held (größerer Punkt)
  const mmH = toMM(hero.pos);
  ctx.fillStyle = "#FFEB3B";
  ctx.beginPath(); ctx.arc(mmH.x, mmH.y, 4, 0, Math.PI * 2); ctx.fill();

  // Label
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "10px sans-serif";
  ctx.fillText("KARTE", MM_X + 4, MM_Y + MM_H - 4);
}
