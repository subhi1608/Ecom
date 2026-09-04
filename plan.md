# Sprint Plan (with UI Layer) — Based on Current Project State

## Current state snapshot (updated 2026-09-04 — see agents.md §5 for full detail)

| Area | Status |
|---|---|
| order-service DB | ✅ Real TypeORM entity + Postgres, `NotFoundException` on missing order |
| inventory-service DB | ✅ Real Postgres (`InventoryItem`/`Reservation`), transactional `pessimistic_write` row lock, idempotent reservation |
| payment-service idempotency | ✅ Real Postgres unique constraint on `Payment.orderId` (insert throws `23505` on duplicate, caught and skipped) |
| DTO validation | ✅ Done — global `ValidationPipe` (class-validator) on api-gateway + order-service (the only two HTTP surfaces) |
| Global exception filter | 🔄 Present in api-gateway + order-service only; not applicable in its current HTTP-only design to the 3 pure-RMQ services (inventory/payment/notification), which still have no equivalent error-handling story |
| Correlation IDs | ✅ Done — middleware generates/propagates `x-correlation-id` on api-gateway + order-service, and every RMQ event across all 5 services carries an `{ correlationId, data }` envelope. Staged on `feature/sprint1-foundation`, not yet committed/merged, not yet runtime-verified |
| CORS on api-gateway | ✅ Done — `app.enableCors()` added in `main.ts`. Staged on `feature/sprint1-foundation`, not yet committed/merged, not yet runtime-verified |
| Health/ready endpoints | ✅ Done — `/health` + `/ready` on all 5 services (Terminus-backed where there's a DB, static otherwise); the 3 pure-RMQ services (inventory/payment/notification) switched to a hybrid HTTP+RMQ bootstrap to expose them. Staged on `feature/sprint1-foundation`, not yet committed/merged, not yet runtime-verified |
| Core event flow (RabbitMQ) | ✅ Working |
| Saga compensation | ✅ Working |
| **Auth** | ❌ **Does not exist anywhere** → out of scope for now, deferred (see note) |
| **UI layer** | ❌ **Does not exist** → added to plan below |
| Current API surface | Only `POST /orders`, `GET /orders/:id` on the gateway |

**Net: Sprint 1 P0 work is now complete**, apart from DLQ/retry policy for the
pure-event services, which is deliberately deferred to the Sprint 2 "Dead-letter
queue in RabbitMQ" line item rather than folded into Sprint 1. A prerequisite fix
for payment-service's missing TypeORM registration was also made along the way.
Everything (CORS, correlation-ID propagation across all 5 services, health/ready
endpoints on all 5 services) was implemented via TDD and covered by new Jest unit
tests in all 5 services (which had zero test infrastructure before this work).
All of it is currently **staged, uncommitted, on branch `feature/sprint1-foundation`**,
awaiting review/commit — nothing here has been merged to `main`. **Runtime
verification (actually booting docker-compose and hitting the live endpoints)
has NOT been done** — Docker was not available in the implementation environment
— so this is still outstanding and remains the user's responsibility before
considering Sprint 1 truly closed.

### Note on auth (your instruction: "if auth exists, implement it; otherwise leave for later")
No auth exists in the project today — no login, no JWT, no user model, no guards. So per your instruction, **auth is deferred**, not built now. The UI is built against the open gateway endpoints. Auth is captured as a clearly-scoped future sprint (Sprint 6) so it's not forgotten, but it's explicitly *not* part of the near-term work. When you do add it, the UI already has the right seam for it (a single API client module where an auth header would slot in).

Sprints are ~1 week, solo part-time. Priorities: **P0** (blocking/foundational) → **P1** (should-have) → **P2** (polish/depth).

---

## Sprint 1 — Close out P0 (backend foundation)
Unchanged from before — finish the backend foundation first so the UI has a stable, validated API to build against.

| Task | Priority | Area |
|---|---|---|
| inventory-service → real Postgres, `InventoryItem` + `Reservation` entities | P0 | DB |
| `reserveStock` in a transaction with `pessimistic_write` row lock | P0 | DB |
| payment-service idempotency → Postgres `processed_orders` (or Redis) | P0 | DB |
| class-validator DTOs + global ValidationPipe (order-service + gateway) | P0 | API |
| Global exception filter (order-service + gateway) | P0 | API |
| Correlation ID middleware → HTTP header + every RMQ event payload + logs | P0 | Queue/Infra |
| **Enable CORS on api-gateway** (UI on :5173 must call gateway on :3000) | P0 | API/Infra |

**Why CORS is here:** the moment a browser UI calls the gateway, cross-origin requests are blocked unless the gateway sends CORS headers. One line in `main.ts` (`app.enableCors(...)`) — trivial, but the UI literally cannot talk to the backend without it, so it belongs in the foundation sprint.

**DoD:** stable, validated API. Malformed request → clean 400. Downstream failure → clean 500. A browser fetch from a different origin succeeds instead of being CORS-blocked.

---

## Sprint 2 — API surface + minimal UI scaffold (parallel tracks)
Now that the API is stable, stand up the UI skeleton AND the endpoints it needs, together.

### Backend (API + queue)
| Task | Priority | Area |
|---|---|---|
| `GET /orders?status=&customerEmail=&page=&limit=` (pagination + filtering) | P1 | API |
| `GET /health` + `GET /ready` on all 5 services | P1 | Infra |
| `POST /orders/:id/cancel` | P1 | API |
| `GET /inventory/:productId` (expose current stock) | P1 | API |
| Gateway routes for all the above (proxy to the right service) | P1 | API |
| Dead-letter queue in RabbitMQ | P1 | Queue |
| Retry w/ exponential backoff (notification-service first) | P1 | Queue |
| Confirm inventory consumer nacks on unexpected error (not blind ack) | P0 | Queue |

### UI (React + Vite + Tailwind ONLY)
| Task | Priority | Area |
|---|---|---|
| Scaffold `ui/` with Vite React-TS template, Tailwind configured | P1 | UI |
| Central API client module (`src/api/client.ts`) — single place all fetches go through (this is the seam auth slots into later) | P1 | UI |
| Env-based gateway URL (`VITE_GATEWAY_URL`) | P1 | UI |
| **Place Order** page — form (productId, quantity, email) → `POST /orders`, show returned order + status | P1 | UI |
| **Order Detail** page — look up an order by ID → `GET /orders/:id`, poll for status change (PENDING→FULFILLED/FAILED) | P1 | UI |
| Basic layout shell (header + routed pages), Tailwind styling only | P1 | UI |
| Loading + error states wired to the gateway's clean error JSON | P1 | UI |

**DoD:** you can open the UI in a browser, place an order through the form, watch its status flip from PENDING to FULFILLED (or FAILED) as the event chain completes, and read stock levels — all without touching curl.

---

## Sprint 3 — Resilience + UI depth
### Backend
| Task | Priority | Area |
|---|---|---|
| Circuit breaker on gateway → order-service | P1 | API/Infra |
| Timeouts on every inter-service call | P1 | API |
| Idempotency-Key header on `POST /orders` | P1 | API |
| Rate limiting on gateway (`@nestjs/throttler`) | P2 | API |
| Outbox pattern (order-service) | P2 | DB/Queue |
| Graceful shutdown (drain in-flight messages) | P2 | Infra |

### UI
| Task | Priority | Area |
|---|---|---|
| **Orders List** page — `GET /orders` with pagination + status filter (uses Sprint 2 endpoint) | P1 | UI |
| **Inventory** view — current stock per product (`GET /inventory/:id`) | P2 | UI |
| **Cancel order** button on Order Detail (`POST /orders/:id/cancel`) | P1 | UI |
| Optimistic UI + reconciliation on cancel (show pending, revert on failure) | P2 | UI |
| Surface the `Idempotency-Key` — UI generates one per order submit so a double-click can't double-order | P1 | UI |

**DoD:** a browsable orders list with filtering/pagination, the ability to cancel an order and see stock returned, and a UI that can't accidentally double-submit an order.

---

## Sprint 4 — Testing (backend + UI)
### Backend
| Task | Priority | Area |
|---|---|---|
| Unit tests — order/inventory/payment business logic | P1 | Testing |
| Integration tests w/ testcontainers (real PG + RMQ) | P1 | Testing |
| E2E: full happy-path order flow across all containers | P1 | Testing |
| E2E: failure path (forced payment fail → stock released, order FAILED) | P1 | Testing |
| Chaos script: kill a service mid-flow, assert recovery | P2 | Testing |
| Load test (k6/Artillery) — real throughput/latency numbers | P2 | Testing |

### UI
| Task | Priority | Area |
|---|---|---|
| Component tests for the order form (validation, submit, error states) — Vitest + React Testing Library | P1 | Testing |
| One UI E2E (Playwright) — place order → see status resolve | P2 | Testing |

**DoD:** green E2E backend suite (happy + failure paths) and at least the order-form component covered by tests.

---

## Sprint 5 — Observability + polish
### Backend
| Task | Priority | Area |
|---|---|---|
| Structured JSON logging w/ correlation ID everywhere | P1 | Infra |
| Prometheus metrics per service | P1 | Infra |
| Grafana dashboard (throughput, payment success/fail, latency) | P1 | Infra |
| RabbitMQ queue-depth monitoring/alerting | P2 | Infra |
| Swagger/OpenAPI docs (gateway) | P1 | API |

### UI + packaging
| Task | Priority | Area |
|---|---|---|
| Dockerize the UI (multi-stage build → nginx serve) + add to docker-compose | P1 | UI/Infra |
| Small **system status** page in UI — hit each service's `/health`, show up/down dots | P2 | UI |
| README: architecture diagram (now incl. UI), design decisions, trade-offs | P2 | Polish |
| Demo recording: place order in UI + one chaos scenario recovering | P2 | Polish |

**DoD:** `docker compose up` brings up the whole stack *including the UI*; Grafana shows live metrics while you drive traffic from the browser.

---

## Sprint 6 — Auth (DEFERRED — only when you're ready)
Explicitly separated because auth doesn't exist yet and you chose to defer it. Pull this forward only if a real requirement appears. When you do:

| Task | Priority | Area |
|---|---|---|
| User model + `auth-service` (or auth module in gateway) | P1 | API/DB |
| `POST /auth/register`, `POST /auth/login` → JWT | P1 | API |
| JWT guard on gateway; protect order endpoints | P1 | API |
| Attach `customerEmail`/userId from token instead of trusting the request body | P1 | API |
| UI: login/register pages, store token, attach `Authorization` header in the API client module (the seam built in Sprint 2) | P1 | UI |
| UI: route guards (redirect to login when unauthenticated) | P1 | UI |
| Refresh-token flow | P2 | API/UI |

**Why it slots in cleanly later:** because Sprint 2 puts every UI request through one API-client module, adding auth is mostly "attach a header in that one file + add login pages," not a rewrite. And the backend already reads `customerEmail` from the request — swapping that to "derive from JWT" is a contained change.

---

## UI tech constraints (per your instruction)
- **React + Vite** (Vite's React-TS template)
- **Tailwind CSS only** — no component library (no MUI, no shadcn, no Chakra). All styling via Tailwind utility classes.
- Keep it minimal: forms, lists, status displays. No design-system overhead.
- One central API client module so base URL (and later, auth headers) live in exactly one place.

## Revised timeline
| Sprint | Focus |
|---|---|
| 1 | P0 backend foundation + CORS |
| 2 | API endpoints + UI scaffold & core pages (place/view order) |
| 3 | Resilience + UI depth (list, cancel, idempotency) |
| 4 | Testing (backend E2E + UI component tests) |
| 5 | Observability + dockerize UI + polish |
| 6 | Auth — deferred, only when needed |

~5 weeks to a full-stack, observable, tested system with a working browser UI; auth is a clean bolt-on afterward.