import { RateLimiter, rateLimitKeyFromToken } from '../rate-limit';

describe('RateLimiter', () => {
  it('allows up to limit then rejects', () => {
    let now = 1_000;
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
