import { EventEmitter } from 'node:events';
import { OrderEvent } from '@burger-page/contracts';

class OrderEventBus extends EventEmitter {
  public publish(event: OrderEvent): void {
    this.emit('order_event', event);
  }

  public subscribe(listener: (event: OrderEvent) => void): () => void {
    this.on('order_event', listener);
    return () => this.off('order_event', listener);
  }
}

export const globalOrderEventBus = new OrderEventBus();

// Per-process cap for concurrently open SSE order streams (H3 hardening):
// streams were previously unbounded — a tenant could open unlimited
// connections and every order event fanned out to all of them. 100 is far
// above legitimate storefront/POS usage (a handful of POS terminals per
// tenant) but small enough to bound fan-out and connection accounting.
export const MAX_ACTIVE_STREAMS = 100;

let activeStreamCount = 0;

/**
 * Reserves a stream slot. Returns false when the cap is reached (the route
 * answers 503 in that case, before it hijacks the reply).
 */
export function registerStream(): boolean {
  if (activeStreamCount >= MAX_ACTIVE_STREAMS) return false;
  activeStreamCount++;
  return true;
}

/**
 * Releases a stream slot. Guarded: never decrements below zero, so a stray
 * teardown path can not corrupt the count.
 */
export function unregisterStream(): void {
  if (activeStreamCount > 0) activeStreamCount--;
}

/** Number of currently registered active order streams (observability). */
export function getActiveStreamCount(): number {
  return activeStreamCount;
}

/** Number of subscribers currently listening for order events (observability). */
export function getListenerCount(): number {
  return globalOrderEventBus.listenerCount('order_event');
}
