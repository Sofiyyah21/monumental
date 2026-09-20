# monumental

## Notification foundation

The API has an internal notification boundary for customer order lifecycle
events. It currently emits typed in-process events for:

- `ORDER_CREATED`
- `ORDER_CONFIRMED`
- `PAYMENT_VERIFIED`
- `ORDER_FULFILLED`
- `ORDER_CANCELLED`

Order logic depends on `NotificationService`, which publishes through a
`NotificationProvider` interface. The default provider is a no-op provider, so
development and test runs do not send real email, SMS, push, WhatsApp, or other
external notifications.

Tests can inject `InMemoryNotificationProvider` to inspect emitted events. Event
payloads are deliberately small and customer-safe: order identifiers, customer
ID, order reference, timestamp, status/payment status, and payment method where
relevant. They do not include passwords, tokens, cost/COGS/profit values, stock
quantities, or internal actor audit IDs.

Notifications are emitted only after the corresponding order operation succeeds.
For transactional operations such as fulfillment, the Sale, inventory decrement,
SOLD stock movements, and order state change must commit before
`ORDER_FULFILLED` is published. No external notification provider is connected
yet; that is a future production-hardening slice.
