// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — main.ts  |  Bootstrap, Input-Handler, Game Loop Start
// ─────────────────────────────────────────────────────────────────────────────

import { GamePhase, AbilityId } from "./types";
import { CANVAS_W, CANVAS_H, screenToWorld } from "./map";
import { createGameState, resetForNewGame, update, render, isStartButtonClicked, isRestartButtonClicked } from "./game";
import { handleHeroRightClick } from "./systems/combat";
import { tryUseAbility, tryLevelAbility } from "./systems/abilities";
import { handleShopClick } from "./ui/shop";
import { toggleInfoPanel } from "./ui/hud";

// ── Init ──────────────────────────────────────────────────────────────────────

const canvas = document.getElementById("gameCanvas") as HTMLCanvasElement;
canvas.width  = CANVAS_W;
canvas.height = CANVAS_H;

const ctx = canvas.getContext("2d")!;
ctx.imageSmoothingEnabled = false;

const state = createGameState(canvas, ctx);

// Logo laden
const logo = new Image();
logo.src = "assets/sp_dota_logo.png";
logo.onload = () => { state.logoImage = logo; };

const ABILITY_KEYS: Record<string, AbilityId> = {
  "Q": AbilityId.Zeitbuchung,
  "W": AbilityId.Ueberstunden,
  "E": AbilityId.Gehaltserhöhung,
  "R": AbilityId.PayrollRun,
  "M": AbilityId.Monatsabschluss,
};

// ── Input-Handler ─────────────────────────────────────────────────────────────

function updateMousePos(e: MouseEvent): void {
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (CANVAS_W / rect.width);
  const sy = (e.clientY - rect.top)  * (CANVAS_H / rect.height);
  state.input.mouseScreen = { x: sx, y: sy };
  state.input.mouseWorld  = screenToWorld(state.input.mouseScreen, state.camera);
}

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("mousedown", (e) => {
  updateMousePos(e);

  if (e.button === 0) {
    // Linksklick
    state.input.leftClickDown  = true;
    state.input.leftClickFired = true;

    if (state.phase === GamePhase.MainMenu) {
      if (isStartButtonClicked(state)) {
        state.phase = GamePhase.InGame;
      }
      return;
    }

    if (state.phase === GamePhase.Victory || state.phase === GamePhase.Defeat) {
      if (isRestartButtonClicked(state)) {
        resetForNewGame(state);
      }
      return;
    }

    if (state.phase === GamePhase.InGame) {
      // Shop-Klick abfangen
      if (state.shopOpen) {
        handleShopClick(state);
        return;
      }
    }
  }

  if (e.button === 2) {
    // Rechtsklick
    state.input.rightClickDown  = true;
    state.input.rightClickFired = true;

    if (state.phase === GamePhase.InGame && !state.shopOpen) {
      handleHeroRightClick(state);
    }
  }
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) state.input.leftClickDown = false;
  if (e.button === 2) state.input.rightClickDown = false;
});

canvas.addEventListener("mousemove", (e) => {
  updateMousePos(e);
});

window.addEventListener("keydown", (e) => {
  const key = e.key.toUpperCase();
  state.input.keys.add(key);

  if (state.phase !== GamePhase.InGame) return;

  // Pause-Toggle (Leertaste)
  if (key === " " || e.code === "Space") {
    state.paused = !state.paused;
    e.preventDefault();
    return;
  }

  // Info-Panel Toggle
  if (key === "H") {
    toggleInfoPanel();
    e.preventDefault();
    return;
  }

  // Shop Toggle
  if (key === "B") {
    state.shopOpen = !state.shopOpen;
    e.preventDefault();
    return;
  }

  if (key === "ESCAPE" && state.shopOpen) {
    state.shopOpen = false;
    e.preventDefault();
    return;
  }

  // SHIFT+Taste → Fähigkeit leveln
  if (e.shiftKey) {
    if (ABILITY_KEYS[key]) {
      tryLevelAbility(state, ABILITY_KEYS[key]);
      e.preventDefault();
      return;
    }
  }

  // Q/W/E/R/M → Fähigkeit aktivieren
  if (ABILITY_KEYS[key]) {
    tryUseAbility(state, ABILITY_KEYS[key]);
    e.preventDefault();
  }

  // Pfeiltasten: preventDefault damit die Seite nicht scrollt
  if (key.startsWith("ARROW")) {
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  state.input.keys.delete(e.key.toUpperCase());
});

// ── Game Loop (fixed-timestep accumulator) ────────────────────────────────────

let lastTime = 0;
let accumulator = 0;

function gameLoop(timestamp: number): void {
  const rawDt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;
  accumulator += rawDt;

  while (accumulator >= FIXED_DT) {
    update(state, FIXED_DT);
    accumulator -= FIXED_DT;
  }

  render(state);

  requestAnimationFrame(gameLoop);
}

const FIXED_DT = 1 / 60;
requestAnimationFrame((ts) => {
  lastTime = ts;
  requestAnimationFrame(gameLoop);
});
