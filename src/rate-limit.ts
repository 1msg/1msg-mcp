import { createHash } from 'node:crypto';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
  limit: number;
}

export interface RateLimiterOptions {
  /** Max requests per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Optional clock for tests. */
  now?: () => number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** In-memory sliding fixed-window limiter keyed by opaque client id. */
export class RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.now = options.now ?? (() => Date.now());
  }

  check(key: string): RateLimitResult {
    const now = this.now();
    let bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(key, bucket);
    }

    if (bucket.count >= this.limit) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec,
        limit: this.limit,
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      remaining: Math.max(0, this.limit - bucket.count),
      retryAfterSec: 0,
      limit: this.limit,
    };
  }
}

/** Hash token for rate-limit keys — never store raw tokens. */
export function rateLimitKeyFromToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 32);
}
