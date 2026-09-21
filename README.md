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

## API E2E tests

The API E2E suite uses the existing stack: Vitest, SuperTest, the real Express
app, Prisma, and PostgreSQL. It runs against the disposable test database
prepared by `apps/api/src/test/prepare-test-database.ts`.

Run the suite with:

```sh
npm run test:e2e
```

The command performs:

1. `npm run test:db:prepare -w api`
2. `RUN_DATABASE_TESTS=true RUN_E2E_TESTS=true vitest run ...`

The test database URL is resolved from `TEST_DATABASE_URL`, or from
`DATABASE_URL` with the database name replaced by `monumental_test`. The
preparation step refuses to operate unless the database name contains `test`.
This safety check must not be weakened.

The E2E suite covers the customer order lifecycle over HTTP:

- login, refresh-cookie behavior, logout, and authenticated `/auth/me`
- product creation and inventory receiving
- customer catalog privacy
- customer order creation and ownership
- confirmation, manual payment verification, fulfillment, and cancellation
- rollback on insufficient stock during fulfillment
- concurrent fulfillment protection
- Sale, SaleItem, inventory, stock movement, and reporting persistence
- customer-safe response fields
- notification events emitted by the in-memory test provider

Some managed sandboxes block SuperTest local sockets or `tsx` IPC pipes. In
that environment the E2E and integration commands can fail before PostgreSQL is
reached with `listen EPERM`; run them in a local or CI environment that permits
local sockets and IPC.
