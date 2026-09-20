import type {
  OrderPaymentStatus,
  OrderStatus,
  PaymentMethod,
} from "@prisma/client";

export const notificationEventTypes = {
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_CONFIRMED: "ORDER_CONFIRMED",
  PAYMENT_VERIFIED: "PAYMENT_VERIFIED",
  ORDER_FULFILLED: "ORDER_FULFILLED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
} as const;

export type NotificationEventType =
  (typeof notificationEventTypes)[keyof typeof notificationEventTypes];

export type OrderNotificationSnapshot = {
  id: string;
  customerId: string;
  reference: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paymentMethod?: PaymentMethod | null;
};

export type OrderNotificationEvent = {
  eventId: string;
  type: NotificationEventType;
  orderId: string;
  customerId: string;
  orderReference: string;
  occurredAt: Date;
  orderStatus: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paymentMethod?: PaymentMethod;
};

export interface NotificationProvider {
  publish(event: OrderNotificationEvent): Promise<void> | void;
}

export class NoopNotificationProvider implements NotificationProvider {
  publish(): Promise<void> {
    return Promise.resolve();
  }
}

export class InMemoryNotificationProvider implements NotificationProvider {
  readonly events: OrderNotificationEvent[] = [];
  private readonly eventIds = new Set<string>();

  publish(event: OrderNotificationEvent): void {
    if (this.eventIds.has(event.eventId)) {
      return;
    }

    this.eventIds.add(event.eventId);
    this.events.push(event);
  }

  clear() {
    this.events.length = 0;
    this.eventIds.clear();
  }
}

export class NotificationService {
  constructor(private readonly provider: NotificationProvider) {}

  notifyOrderCreated(order: OrderNotificationSnapshot) {
    return this.publishOrderEvent(notificationEventTypes.ORDER_CREATED, order);
  }

  notifyOrderConfirmed(order: OrderNotificationSnapshot) {
    return this.publishOrderEvent(
      notificationEventTypes.ORDER_CONFIRMED,
      order,
    );
  }

  notifyPaymentVerified(order: OrderNotificationSnapshot) {
    return this.publishOrderEvent(
      notificationEventTypes.PAYMENT_VERIFIED,
      order,
    );
  }

  notifyOrderFulfilled(order: OrderNotificationSnapshot) {
    return this.publishOrderEvent(
      notificationEventTypes.ORDER_FULFILLED,
      order,
    );
  }

  notifyOrderCancelled(order: OrderNotificationSnapshot) {
    return this.publishOrderEvent(
      notificationEventTypes.ORDER_CANCELLED,
      order,
    );
  }

  private async publishOrderEvent(
    type: NotificationEventType,
    order: OrderNotificationSnapshot,
  ) {
    await this.provider.publish({
      eventId: `${type}:${order.id}`,
      type,
      orderId: order.id,
      customerId: order.customerId,
      orderReference: order.reference,
      occurredAt: new Date(),
      orderStatus: order.status,
      paymentStatus: order.paymentStatus,
      ...(order.paymentMethod ? { paymentMethod: order.paymentMethod } : {}),
    });
  }
}

export function createNotificationService(
  provider: NotificationProvider = new NoopNotificationProvider(),
) {
  return new NotificationService(provider);
}
