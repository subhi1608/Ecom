# E-commerce Microservices (NestJS + RabbitMQ)

Starter scaffold for the order-processing microservices project.

## Services
- **api-gateway** (3000) — single entry point, proxies to order-service
- **order-service** (3001) — creates orders, publishes `order_created` event
- **inventory-service** (3002) — listens for `order_created`, reserves stock, publishes `stock_reserved` / `stock_failed`
- **payment-service** (3003) — listens for `stock_reserved`, processes (mock) payment, publishes `payment_completed` / `payment_failed`
- **notification-service** (3004) — listens for `payment_completed`, sends (mock) notification

## Event flow (happy path)
```
POST /orders (gateway)
  -> order-service creates order (status: PENDING), emits order_created
     -> inventory-service reserves stock, emits stock_reserved
        -> payment-service charges (mock), emits payment_completed
           -> notification-service sends confirmation (mock)
           -> order-service listens for payment_completed, updates order to FULFILLED
```

## Failure path (compensating transaction / saga)
```
payment-service fails -> emits payment_failed
  -> inventory-service listens for payment_failed -> releases reserved stock
  -> order-service listens for payment_failed -> updates order to FAILED
```

## Running it
```bash
docker compose up --build
```

RabbitMQ management UI: http://localhost:15672 (guest/guest) — watch queues fill/drain live.

## Try it
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"productId": "prod-1", "quantity": 2, "customerEmail": "test@example.com"}'
```

Watch the logs of all 4 services (`docker compose logs -f`) to see the event chain fire across services.

## What's stubbed vs real
- Payment is **mocked** — `payment.service.ts` randomly succeeds/fails (~85% success) so you can observe the failure/compensation path without needing a real payment gateway.
- Notification is **mocked** — just logs "email sent" instead of hitting a real provider.
- Databases are real Postgres, but this starter uses plain SQL via `pg` for simplicity — swap in TypeORM/Prisma once you're comfortable with the flow.

## Next steps (see the execution plan doc)
- Add idempotency keys on payment-service (dedupe `order_created` events)
- Add correlation IDs threaded through every event for tracing
- Add retry/backoff on notification-service
- Add Grafana + Prometheus for observability
