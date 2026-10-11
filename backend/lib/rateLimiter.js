/** Fixed-window-by-timestamps limiter for a single server instance. */
function createRateLimiter({ windowMs, max, keyFn, message, now = Date.now, maxKeys = 10000 }) {
  const hits = new Map();

  function middleware(req, res, next) {
    const key = keyFn(req);
    if (!key) return next();
    const t = now();
    const recent = (hits.get(key) || []).filter((ts) => t - ts < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return res.status(429).json({ error: message, code: 'RATE_LIMITED' });
    }
    recent.push(t);
    hits.set(key, recent);
    if (hits.size > maxKeys) {
      const oldest = hits.keys().next().value;
      hits.delete(oldest);
    }
    return next();
  }

  middleware.reset = () => hits.clear();
  return middleware;
}

module.exports = { createRateLimiter };
