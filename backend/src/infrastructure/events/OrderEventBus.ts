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
