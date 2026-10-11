const { verifyAccessToken, isSupabaseAuthConfigured } = require('./supabaseAdmin');
const { isSecureTrackingEnabled } = require('./trackingSecurity');

function isStrictHttpAuthRequired() {
  return isSecureTrackingEnabled();
}

const resolve = (value) => (typeof value === 'function' ? value() : value);

function createAuthMiddleware({ verifyToken, supabaseConfigured, secureMode }) {
  async function attachAuthUser(req, res, next) {
    req.user = null;
    if (!resolve(supabaseConfigured)) {
      return next();
    }

    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) {
      return next();
    }

    const token = header.slice(7).trim();
    if (!token) {
      return next();
    }

    try {
      const user = await verifyToken(token);
      if (user) {
        req.user = user;
      }
    } catch {
      /* leave req.user null; protected routes will reject */
    }
    return next();
  }

  function requireAuthWhenConfigured(req, res, next) {
    if (!resolve(secureMode)) {
      return next();
    }
    if (!resolve(supabaseConfigured)) {
      return res.status(503).json({
        error: 'Authentication is not configured on this server',
        code: 'AUTH_NOT_CONFIGURED',
      });
    }
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', code: 'AUTH_REQUIRED' });
    }
    return next();
  }

  return { attachAuthUser, requireAuthWhenConfigured };
}

const defaultMiddleware = createAuthMiddleware({
  verifyToken: verifyAccessToken,
  supabaseConfigured: isSupabaseAuthConfigured,
  secureMode: isStrictHttpAuthRequired,
});

module.exports = {
  createAuthMiddleware,
  attachAuthUser: defaultMiddleware.attachAuthUser,
  requireAuthWhenConfigured: defaultMiddleware.requireAuthWhenConfigured,
  isStrictHttpAuthRequired,
};
