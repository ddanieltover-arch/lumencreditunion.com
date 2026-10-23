import { Request, Response, NextFunction } from 'express';

interface ClientBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, ClientBucket>();

export interface RateLimiterOptions {
  windowMs?: number; // default: 60,000ms (1 min)
  max?: number;      // default: 100 requests per window
}

export function createRateLimiter(options: RateLimiterOptions = {}) {
  const windowMs = options.windowMs || 60_000;
  const max = options.max || 100;

  // Cleanup expired buckets periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now > bucket.resetAt) {
        buckets.delete(key);
      }
    }
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req.ip || req.socket.remoteAddress || 'unknown').toString();
    const now = Date.now();

    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 1, resetAt: now + windowMs };
      buckets.set(key, bucket);
    } else {
      bucket.count += 1;
    }

    const remaining = Math.max(0, max - bucket.count);
    const resetSec = Math.ceil((bucket.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSec);

    if (bucket.count > max) {
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests, please slow down.',
        timestamp: new Date().toISOString(),
        path: req.originalUrl || req.url,
      });
      return;
    }

    next();
  };
}
