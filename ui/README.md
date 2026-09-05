# Ecom Console (UI)

Sprint 2 UI scaffold — React + Vite + Tailwind, talking to the api-gateway.

## Run

```
npm install
npm run dev
```

Defaults to `VITE_GATEWAY_URL=http://localhost:3000` (see `.env`). The gateway
must have CORS enabled for this origin (already done in Sprint 1).

## Structure

- `src/api/client.ts` — the single module every request goes through. This is
  the seam auth will slot into later (Sprint 6): one `Authorization` header
  added here, nowhere else changes.
- `src/pages/PlaceOrderPage.tsx` — form → `POST /orders`, shows the created
  order.
- `src/pages/FindOrderPage.tsx` — look up an order by ID.
- `src/pages/OrderDetailPage.tsx` — `GET /orders/:id`, polls every 2s until
  status reaches a terminal state (FULFILLED/FAILED/CANCELLED).

## Not in this scrape (deferred to later sprints per plan.md)

- Orders list/filter page, inventory view, cancel button (Sprint 3)
- Auth (Sprint 6)
