import { RateLimiter, rateLimitKeyFromToken } from '../rate-limit';

/** Use an injected clock to verify rate-limit boundaries without sleeping or depending on wall time. */
describe('RateLimiter', () => {
  /** Assert the inclusive allowed-count boundary and rejection of the immediately following request. */
  it('allows up to limit then rejects', () => {
    const now = 1_000;
    const limiter = new RateLimiter({
      limit: 2,
      windowMs: 60_000,
      now: () => now,
    });

    expect(limiter.check('a').allowed).toBe(true);
    expect(limiter.check('a').allowed).toBe(true);
    const blocked = limiter.check('a');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('hashes tokens without retaining plaintext', () => {
    const key = rateLimitKeyFromToken('super-secret-token');
    expect(key).toHaveLength(32);
    expect(key).not.toContain('secret');
  });
});
