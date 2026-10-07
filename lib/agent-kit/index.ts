/**
 * The CANVEXIA agent-portal connection kit — the server half, vendored.
 *
 * Copied from `@servd/core/agent-kit` in the canvexia monorepo because that
 * package is private and unpublished and Reseta lives in its own repository.
 * `signing`, `client`, `ref` and `billing` are verbatim; `events` and
 * `callbacks` are ported from zod 3 to zod 4 with the wire format unchanged.
 *
 * Server-only: pulls in node:crypto. For the referral cookie helpers in
 * `proxy.ts` (which must stay Edge-safe) import `./ref` directly.
 */
export * from "./signing";
export * from "./events";
export * from "./callbacks";
export * from "./client";
export * from "./ref";
export * from "./billing";
