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

## Production configuration

The API validates configuration at startup. In production, missing or unsafe
required values fail fast without printing secret values.

Required production API settings:

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `CORS_ORIGIN`, as a comma-separated allowlist of the deployed frontend origins
- `JWT_ACCESS_SECRET`, at least 32 random characters and production-specific
- `JWT_REFRESH_SECRET`, at least 32 random characters and production-specific
- `ACCESS_TOKEN_EXPIRES_IN`
- `REFRESH_TOKEN_EXPIRES_IN_DAYS`
- `REFRESH_TOKEN_COOKIE_NAME`
- `REFRESH_TOKEN_COOKIE_PATH`
- `REFRESH_TOKEN_COOKIE_SAME_SITE`
- `BUSINESS_TIMEZONE`, currently `Africa/Lagos`

Optional production API settings:

- `REFRESH_TOKEN_COOKIE_DOMAIN`, only when the frontend and API share a parent domain
- `REFRESH_TOKEN_COOKIE_SECURE`, which defaults to secure in production and must not be `false`
- `JSON_BODY_LIMIT` and `URLENCODED_BODY_LIMIT`, both defaulting to `100kb`
- `AUTH_RATE_LIMIT_WINDOW_MS` and `AUTH_RATE_LIMIT_MAX`
- `ORDER_RATE_LIMIT_WINDOW_MS` and `ORDER_RATE_LIMIT_MAX`
- `SHUTDOWN_GRACE_MS`
- `ENABLE_API_DOCS`, disabled by default in production unless explicitly set to `true`
- `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and `BOOTSTRAP_ADMIN_PASSWORD` for the first-admin bootstrap flow

Do not put real secrets in committed files. Use `apps/api/.env.example` as a
shape reference only.

## CORS and refresh cookies

The API uses credentialed CORS because refresh tokens are stored in HttpOnly
cookies. Production must use an explicit `CORS_ORIGIN` allowlist; wildcard
origins are rejected. Disallowed origins receive a safe CORS error.

Refresh-token cookies are:

- `HttpOnly`
- `Secure` in production
- scoped to `REFRESH_TOKEN_COOKIE_PATH`, defaulting to `/api/v1/auth`
- configured with `SameSite` from `REFRESH_TOKEN_COOKIE_SAME_SITE`
- cleared on logout

Use `SameSite=lax` when the frontend and API are same-site. Use
`SameSite=none` only for HTTPS cross-site deployments, and keep secure cookies
enabled. The origin allowlist is also used as the CSRF origin check for
cookie-authenticated refresh/logout requests.

## Security middleware

The API sets conservative response headers for content sniffing, framing,
referrer behavior, DNS prefetching, cross-origin resource policy, and a narrow
API-oriented Content Security Policy. HSTS is emitted in production only.

Request bodies are explicitly bounded by `JSON_BODY_LIMIT` and
`URLENCODED_BODY_LIMIT`. The current API does not require large payloads, so the
default is `100kb`.

Sensitive endpoints use process-local in-memory rate limiting:

- authentication/session routes use `AUTH_RATE_LIMIT_*`
- customer order creation uses `ORDER_RATE_LIMIT_*`

This limiter is intentionally simple and process-local. If the API is deployed
with multiple Node processes, each process maintains its own counters.

## Health, readiness, and shutdown

Deployment probes can use:

- `GET /health` for process liveness
- `GET /ready` for dependency readiness, including a safe database connectivity check
- the same endpoints under `/api/v1/health` and `/api/v1/ready`

Readiness failures return `503` without database credentials, connection
strings, or internal stack traces.

The HTTP server handles `SIGTERM` and `SIGINT` by stopping new requests,
allowing in-flight requests to complete for `SHUTDOWN_GRACE_MS`, disconnecting
Prisma, and exiting. If the grace period is exceeded, the process exits with a
failure code.

## Frontend production configuration

The Vite frontend reads only public configuration. Production builds require:

- `VITE_API_BASE_URL`, for example `https://api.example.com/api/v1`

Production frontend config must not point to `localhost` or include backend
secrets. Backend secrets such as JWT keys and database URLs must never be
exposed through `VITE_` variables.

## Production database procedure

Run Prisma migrations as an explicit deployment step, not from application
startup:

```sh
npm run prisma:generate --workspace=apps/api
npm run prisma:deploy --workspace=apps/api
npm run build --workspaces
```

The application does not run destructive migrations or database resets at
startup.

## Verification commands

Use these commands before release:

```sh
npm run prisma:generate --workspace=apps/api
npm run lint --workspaces
npm run typecheck --workspaces
npm run test --workspaces
npm run build --workspaces
npm run test:integration
npm run test:e2e
```

Integration and E2E commands require a PostgreSQL test database and an
environment that permits local sockets and `tsx` IPC pipes.
