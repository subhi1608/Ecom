import * as jwt from 'jsonwebtoken';

export interface AuthenticatedUser {
  id: string;
  email: string;
}

// Verification only — the gateway never signs tokens. auth-service is the
// sole issuer; the gateway and order-service both verify against the same
// shared secret.
export function verifyToken(token: string): AuthenticatedUser {
  const secret = process.env.JWT_SECRET as jwt.Secret;

  // Pin the algorithm explicitly. With a string secret, jsonwebtoken
  // currently infers an HS-family allow-list on its own, so this isn't
  // exploitable today — but that safety is an implicit side effect of the
  // secret's TYPE. If the secret is ever swapped for a KeyObject/PEM, or the
  // library's inference default changes, the hole would open silently with
  // nothing in this code to stop it. Pinning removes that dependency.
  const claims = jwt.verify(token, secret, {
    algorithms: ['HS256'],
  }) as jwt.JwtPayload;

  // downstream (order-service) uses `email` as the ownership key deciding
  // which orders a user may read/cancel. Fail closed rather than coerce:
  // String(undefined) === "undefined" and String({}) === "[object Object]",
  // either of which would become a shared, colliding ownership key across
  // any tokens missing/mangling this claim. Never let a malformed claim
  // silently produce a plausible-looking identity.
  const { sub, email } = claims;
  if (typeof sub !== 'string' || sub.length === 0) {
    throw new Error('Invalid token: sub claim missing or not a string');
  }
  if (typeof email !== 'string' || email.length === 0) {
    throw new Error('Invalid token: email claim missing or not a string');
  }

  return { id: sub, email };
}
