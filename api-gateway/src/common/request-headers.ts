// Shared by every controller that proxies to a downstream service, so the
// correlation-id (plus optional idempotency-key and bearer token)
// forwarding logic lives in exactly one place instead of drifting between
// AppController and InventoryController.
export function buildForwardedHeaders(
  correlationId: string,
  idempotencyKey?: string,
  authToken?: string,
): Record<string, string> {
  const headers: Record<string, string> = { 'x-correlation-id': correlationId };
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey;
  // Forwarded so order-service can verify identity itself rather than
  // trusting us — see order-service/src/common/jwt-auth.guard.ts.
  if (authToken) headers['authorization'] = `Bearer ${authToken}`;
  return headers;
}
