/**
 * bcrypt cost factor for every password this application hashes.
 *
 * Single source of truth so the login route's dummy-compare hash (below)
 * cannot drift away from the cost real accounts are stored at.
 */
export const PASSWORD_HASH_COST = 12;

/**
 * A real bcrypt hash of a passphrase no account uses.
 *
 * POST /api/login compares against this when no user matches the submitted
 * email, so the "unknown account" path costs the same as the "wrong password"
 * path. Without it, response time alone discloses whether an email is
 * registered — the enumeration oracle reported as H1.
 *
 * Its cost factor MUST equal PASSWORD_HASH_COST. If the two drift, the dummy
 * comparison becomes measurably cheaper or dearer than a real one and the
 * oracle reopens; `__tests__/verify-login-hardening.test.ts` asserts they match.
 */
export const DUMMY_PASSWORD_HASH =
  '$2b$12$D0YP7tRTFcFaBNvdfg1lt.xZoQIENZCbUn1x2o2x6YabDCP1cL9sO';
