// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — ui/shop.ts  |  Kantine (Shop-Overlay), Kauf-Logik
// ─────────────────────────────────────────────────────────────────────────────

import { GameState, ShopItem, Vec2 } from "../types";
import { CANVAS_W, CANVAS_H, uniqueId } from "../map";
import { EventBus } from "../eventbus";

const SHOP_W = 520;
const SHOP_H = 420;
const SHOP_X = (CANVAS_W - SHOP_W) / 2;
const SHOP_Y = (CANVAS_H - SHOP_H) / 2;

const ITEM_W = 230;
const ITEM_H = 55;
const ITEM_GAP = 8;
const COLS = 2;
const GRID_X = SHOP_X + 20;
const GRID_Y = SHOP_Y + 70;

// ── Render ────────────────────────────────────────────────────────────────────

export function renderShop(ctx: CanvasRenderingContext2D, state: GameState): void {
  if (!state.shopOpen) return;
  const hero = state.hero;

  // Dimmer
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Panel
  ctx.fillStyle = "rgba(15,20,15,0.96)";
  ctx.fillRect(SHOP_X, SHOP_Y, SHOP_W, SHOP_H);
  ctx.strokeStyle = "#4CAF50";
  ctx.lineWidth = 2;
  ctx.strokeRect(SHOP_X, SHOP_Y, SHOP_W, SHOP_H);

  // Titel
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.fillText("🍽  K A N T I N E", CANVAS_W / 2, SHOP_Y + 30);

  // Lohn-Anzeige
  ctx.fillStyle = "#FFD700";
  ctx.font = "bold 14px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`Verfügbar: ₲ ${Math.floor(hero.lohn).toLocaleString("de-DE")}`, CANVAS_W / 2, SHOP_Y + 52);

  // Items rendern
  for (let i = 0; i < hero.items.length; i++) {
    const item = hero.items[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = GRID_X + col * (ITEM_W + ITEM_GAP);
    const y = GRID_Y + row * (ITEM_H + ITEM_GAP);

    renderShopItem(ctx, item, x, y, hero.lohn);
  }

  // Hinweis
  ctx.fillStyle = "#666";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.fillText("Klicke ein Item zum Kaufen  |  [B] oder [ESC] zum Schließen", CANVAS_W / 2, SHOP_Y + SHOP_H - 14);
}

function renderShopItem(
  ctx: CanvasRenderingContext2D,
  item: ShopItem,
  x: number, y: number,
  currentLohn: number
): void {
  const affordable = currentLohn >= item.cost && !item.purchased;
  const purchased = item.purchased;

  // Hintergrund
  ctx.fillStyle = purchased ? "#1a2a1a" : affordable ? "#1a1a2a" : "#1a1a1a";
  ctx.fillRect(x, y, ITEM_W, ITEM_H);
  ctx.strokeStyle = purchased ? "#4CAF50" : affordable ? "#1565C0" : "#333";
  ctx.lineWidth = purchased ? 2 : 1;
  ctx.strokeRect(x, y, ITEM_W, ITEM_H);

  if (purchased) {
    // Gekauft-Marker
    ctx.fillStyle = "rgba(76,175,80,0.15)";
    ctx.fillRect(x, y, ITEM_W, ITEM_H);
    ctx.fillStyle = "#4CAF50";
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "right";
    ctx.fillText("✓", x + ITEM_W - 8, y + 18);
  }

  // Name
  ctx.fillStyle = purchased ? "#4CAF50" : affordable ? "#FFFFFF" : "#666";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "left";
  ctx.fillText(item.name, x + 8, y + 18);

  // Beschreibung
  ctx.fillStyle = purchased ? "#666" : "#AAAAAA";
  ctx.font = "11px monospace";
  ctx.fillText(item.description, x + 8, y + 34);

  // Preis
  if (!purchased) {
    ctx.fillStyle = affordable ? "#FFD700" : "#FF5722";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "right";
    ctx.fillText(`₲ ${item.cost}`, x + ITEM_W - 8, y + 46);
  }
}

// ── Klick-Handling ────────────────────────────────────────────────────────────

export function handleShopClick(state: GameState): boolean {
  if (!state.shopOpen) return false;

  const mx = state.input.mouseScreen.x;
  const my = state.input.mouseScreen.y;

  // Außerhalb des Panels? → Schließen
  if (mx < SHOP_X || mx > SHOP_X + SHOP_W || my < SHOP_Y || my > SHOP_Y + SHOP_H) {
    state.shopOpen = false;
    return true;
  }

  // Item-Klick prüfen
  for (let i = 0; i < state.hero.items.length; i++) {
    const item = state.hero.items[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = GRID_X + col * (ITEM_W + ITEM_GAP);
    const y = GRID_Y + row * (ITEM_H + ITEM_GAP);

    if (mx >= x && mx <= x + ITEM_W && my >= y && my <= y + ITEM_H) {
      if (!item.purchased && state.hero.lohn >= item.cost) {
        purchaseItem(state, item);
        return true;
      }
    }
  }

  return true;
}

function purchaseItem(state: GameState, item: ShopItem): void {
  const hero = state.hero;
  hero.lohn -= item.cost;
  item.purchased = true;

  // Stats anwenden
  hero.maxHp         += item.hpBonus;
  hero.hp            += item.hpBonus;
  hero.attackDamage  += item.attackBonus;
  hero.moveSpeed     += item.moveSpeedBonus;
  hero.baseSpeed     += item.moveSpeedBonus;
  hero.passiveLohnRate += item.passiveLohnBonus;
  hero.hpRegen       += item.hpRegenBonus;

  // Floating text
  state.floatingTexts.push({
    id:    uniqueId("ft"),
    pos:   { x: hero.pos.x, y: hero.pos.y - 50 },
    text:  `📦 ${item.name}!`,
    color: "#4CAF50",
    alpha: 1, vy: -60, life: 1.5, size: 16,
  });

  EventBus.emit("ITEM_PURCHASED", { itemId: item.id, name: item.name });
}
