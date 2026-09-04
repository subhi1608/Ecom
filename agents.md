# agents.md — Codebase Guide

Living reference for anyone (human or agent) picking up this repo. Companion to
[plan.md](plan.md), which tracks the sprint roadmap — this file is the "what exists
and why" snapshot. Keep both in sync as work lands.

## 1. What this is

An order-processing system built as 5 independent NestJS services communicating
over RabbitMQ, each with its own Postgres database (database-per-service). No UI,
no auth yet — pure backend event-driven core with a synchronous HTTP front door.

## 2. Services

| Service | Port | Transport | Own DB | Role |
|---|---|---|---|---|
| **api-gateway** | 3000 | HTTP only | none | Single public entry point. Proxies `POST/GET /orders` to order-service over HTTP (`@nestjs/axios`). Not a NestJS microservice — no RMQ connection of its own. |
| **order-service** | 3001 | HTTP + RMQ | `orders_db` | Owns the `Order` aggregate. Creates orders (HTTP), emits `order_created`, and listens for `payment_completed` / `payment_failed` / `stock_failed` to update order status. |
| **inventory-service** | 3002 | HTTP + RMQ | `inventory_db` | Event consumer, business logic all RMQ-driven. Hybrid `NestFactory.create` + `connectMicroservice` bootstrap (HTTP listener exists only to serve `/health`+`/ready`). Reserves/releases stock. |
| **payment-service** | 3003 | HTTP + RMQ | `payment_db` | Event consumer, business logic all RMQ-driven. Same hybrid bootstrap as inventory-service, HTTP only for health endpoints. Mocks a payment gateway (~85% success). |
| **notification-service** | 3004 | HTTP + RMQ | none | Event consumer, business logic all RMQ-driven. Same hybrid bootstrap, HTTP only for health endpoints. Mocked email send (console.log only, no DB, no retry yet). |

Each service is a standalone Nest app with its own `package.json`, `Dockerfile`,
`.env`, and `node_modules` — no shared/monorepo tooling (no Nx/Turborepo, no
shared npm package for common code). `common/all-exceptions.filter.ts` is
**duplicated** per service rather than shared, by choice-of-simplicity so far
(currently present in api-gateway and order-service only).

## 3. Event flow

**Happy path:**
```
POST /orders (gateway) → order-service creates Order(PENDING), emits order_created
  → inventory-service reserves stock (row-locked tx), emits stock_reserved
    → payment-service charges (mock), emits payment_completed
      → notification-service sends confirmation (mock)
      → order-service marks Order FULFILLED
```

**Failure / compensating saga:**
```
inventory-service: insufficient stock → emits stock_failed → order-service marks FAILED
payment-service: payment declined → emits payment_failed
  → inventory-service releases the reservation (compensating tx)
  → order-service marks Order FAILED
```

RabbitMQ topology: default exchange, one durable queue per consuming service
(`order_service_queue`, `events_queue` for inventory, implied queues for
payment/notification). No DLQ, no retry/backoff configured yet.

## 4. Design decisions (and why)

- **Database-per-service, TypeORM, `synchronize: true`.** Deliberate shortcut for
  this stage — migrations are a known follow-up before anything resembling prod.
- **Idempotency is handled at the data layer, not with a message dedup library:**
  - `inventory-service`: `Reservation.orderId` is unique; `reserveStock` checks
    for an existing reservation inside the same transaction before locking the
    stock row, so a duplicate `order_created` event is a no-op.
  - `payment-service`: `Payment.orderId` has a DB unique constraint; a duplicate
    `stock_reserved` event fails the `insert` with Postgres `23505`, which is
    caught and treated as "already processed" rather than retried as an error.
  - Both use **pessimistic row locks** (`setLock('pessimistic_write')`) inside a
    `DataSource.transaction`, not application-level mutexes — correctness comes
    from Postgres, not from in-process state (important since each service can
    run multiple replicas).
- **Manual ack in inventory-service's `order_created` handler** — acked only
  after `reserveStock` completes, so a crash mid-reservation redelivers the
  message instead of silently losing it. Other handlers rely on the RMQ
  transport's default ack behavior (noted as "illustrative, wire up fully with
  DLQ/retry later" in the code comment).
- **Events publish only after the DB write commits** (see payment-service) —
  never announce a state you haven't durably recorded.
- **`AllExceptionsFilter` is HTTP-only by design**: it explicitly re-throws when
  `host.getType() !== 'http'`, because RMQ event handlers have no HTTP response
  to write to — letting the microservice transport's own ack/nack handle those
  errors instead of the filter swallowing them.
- **api-gateway is a thin, dumb proxy** — no business logic, no direct DB or RMQ
  access. It exists purely as the one public HTTP surface (future seam for auth,
  rate limiting, circuit breakers per plan.md Sprint 3).
- **No shared library between services.** Cross-cutting concerns (the exception
  filter, correlation-ID middleware) are copy-pasted per service rather than
  extracted into a shared package — keeps each service independently
  deployable/buildable with zero internal package-publishing step, at the cost
  of drift risk (the filter already isn't present in inventory/payment/
  notification-service).
- **Event envelope `{ correlationId, data }` is now a real, implemented
  convention** on every RMQ event across all 5 services (not just a proposal) —
  correlation IDs generated/propagated by api-gateway + order-service middleware
  are threaded through every published event and read back out by every
  consumer, so a request can be traced end-to-end across the async hop. Staged
  on `feature/sprint1-foundation`, not yet runtime-verified.
- **payment-service's missing TypeORM registration bug is fixed** — it was
  flagged as an open issue/design-decision candidate; the prerequisite fix
  landed as part of closing out Sprint 1.
- **Payment success/failure is randomized (`Math.random() > 0.15`)** — intentional
  stand-in so the failure/compensation path is observable without a real payment
  gateway integration.

## 5. Current state vs. plan.md — reconciliation

`plan.md`'s "current state snapshot" table is now **stale** on two points; the
actual code is further along than the doc claims:

| plan.md says | Actual code |
|---|---|
| inventory-service DB ❌ still in-memory | ✅ Real Postgres, TypeORM, transactional row-locked reservation — **done** |
| payment idempotency ❌ in-memory `Set` | ✅ Real Postgres unique-constraint idempotency — **done** |

**Now implemented** (closing out the Sprint 1 close-out plan): CORS on
api-gateway, correlation-ID middleware + propagation as an `{ correlationId,
data }` envelope on every RMQ event across all 5 services, and `/health` +
`/ready` on all 5 services (Terminus-backed where there's a DB, static
otherwise — the 3 pure-RMQ services moved to a hybrid HTTP+RMQ bootstrap to
expose them). A prerequisite fix for payment-service's missing TypeORM
registration also landed. All of it was built via TDD with new Jest unit tests
across all 5 services (previously zero test infrastructure), spec- and
code-quality-reviewed. **Everything here is staged, uncommitted, on branch
`feature/sprint1-foundation`** — not yet committed/merged to `main`, and **not
yet runtime-verified** against real Docker/Postgres/RabbitMQ (Docker was not
available in the implementation environment); that verification is still
pending and is the user's responsibility.

Verified still accurate / outstanding from Sprint 1 (P0):
- 🔄 **DTO validation** — done via global `ValidationPipe` in api-gateway and
  order-service (the only two services with HTTP surfaces). N/A for the three
  pure-event services.
- 🔄 **Global exception filter** — present in api-gateway and order-service only
  (matches the git status: `common/` exists in both, nowhere else). N/A for
  pure-event services under the current filter design (see §4), but they have
  **no equivalent error-handling story yet** (no DLQ, no nack-vs-ack policy
  documented beyond inventory's one manual ack).
- ❌ Dead-letter queue / retry-with-backoff — not present (RabbitMQ has no DLQ configured; notification-service has no retry). Deferred to Sprint 2 per plan.md.
- ❌ UI (`ui/` directory) — does not exist yet; nothing from Sprint 2+ UI work has started.
- ❌ Auth — confirmed absent everywhere, per plan.md's explicit deferral to Sprint 6.

**Net: Sprint 1 P0 work is now complete**, apart from the DLQ/retry-with-backoff
line item, which was always Sprint 2 scope. What remains before calling Sprint 1
truly *done* is (a) the user's own review/commit of the staged changes and
(b) runtime verification against a real docker-compose stack, which could not
be performed here.

## 6. Repo layout

```
api-gateway/          HTTP proxy only (see §2)
  src/app.controller.ts   POST/GET /orders → forwards to order-service
  src/common/              AllExceptionsFilter
  src/dto/                 CreateOrderDto (class-validator)
order-service/         HTTP + RMQ, owns Order entity
  src/orders/
    entities/order.entity.ts   Order (PENDING/FULFILLED/FAILED), TypeORM
    orders.controller.ts        HTTP endpoints + @EventPattern consumers
    orders.service.ts
  src/common/              AllExceptionsFilter (duplicated, not shared)
inventory-service/      RMQ-only microservice, owns InventoryItem/Reservation
payment-service/        RMQ-only microservice, owns Payment (idempotency ledger)
notification-service/   RMQ-only microservice, no DB (mock send)
docker-compose.yml       rabbitmq + 3 postgres DBs (orders/inventory/payment) + 5 services
plan.md                  Sprint roadmap (see §5 for drift vs. reality)
README.md                Original scaffold description (also slightly stale re: "plain SQL via pg" — services now use TypeORM)
```

Note: README.md's "What's stubbed vs real" section still says databases use
"plain SQL via `pg`" — also stale; all three DB-backed services now use TypeORM
entities/repositories, not raw `pg` queries. Worth a fix alongside plan.md.

## 7. Open questions for you

1. **plan.md and README.md are both out of date** relative to the code (inventory
   DB, payment idempotency, and the pg→TypeORM switch are all further along than
   documented). Want me to update `plan.md`'s snapshot table and `README.md` now,
   or fold that into whichever sprint task you pick up next?
2. Given Sprint 1 is ~2/3 done, do you want to **finish the remaining Sprint 1
   items** (CORS, correlation IDs, health endpoints, DLQ) before touching UI/
   Sprint 2, or is there a reason to jump ahead?
3. For the three pure-event services (inventory/payment/notification), do you
   want a **shared error-handling policy** (e.g. explicit ack/nack + DLQ) defined
   now as part of "closing out Sprint 1", or is that intentionally deferred to
   the Sprint 2 "DLQ in RabbitMQ" line item?
4. Should the duplicated `AllExceptionsFilter` (and future correlation-ID
   middleware) stay copy-pasted per service, or is it worth extracting a small
   shared internal package now before more services need it — tradeoff being
   independent deploys/simplicity vs. drift (it's already missing from 3 of 5
   services)?
