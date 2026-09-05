// Shared by every controller that proxies to a downstream service, so the
// correlation-id (and optional idempotency-key) forwarding logic lives in
// exactly one place instead of drifting between AppController and
// InventoryController.
export function buildForwardedHeaders(
  correlationId: string,
  idempotencyKey?: string,
): Record<string, string> {
  const headers: Record<string, string> = { 'x-correlation-id': correlationId };
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  return headers;
}
