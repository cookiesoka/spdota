// ─────────────────────────────────────────────────────────────────────────────
// sp_dota — eventbus.ts  |  Typisierter Pub/Sub, verhindert circular imports
// ─────────────────────────────────────────────────────────────────────────────

import { GameEventType, GameEventMap } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (payload: any) => void;

const listeners: Map<GameEventType, AnyHandler[]> = new Map();
const queue: Array<{ type: GameEventType; payload: unknown }> = [];

export const EventBus = {
  on<T extends GameEventType>(type: T, handler: (payload: GameEventMap[T]) => void): void {
    const list = listeners.get(type) ?? [];
    list.push(handler as AnyHandler);
    listeners.set(type, list);
  },

  emit<T extends GameEventType>(type: T, payload: GameEventMap[T]): void {
    queue.push({ type, payload });
  },

  /** Drain the queue — called once per frame AFTER all systems have updated */
  dispatch(): void {
    let i = 0;
    while (i < queue.length) {
      const ev = queue[i++];
      const handlers = listeners.get(ev.type);
      if (handlers) {
        for (const h of handlers) h(ev.payload);
      }
    }
    queue.length = 0;
  },

  clear(): void {
    queue.length = 0;
    listeners.clear();
  },
};
