const os = require('os');

let cachedPublicUrl = null;

function detectLanIp() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        return entry.address;
      }
    }
  }
  return '127.0.0.1';
}

function resolvePublicServerUrl(port = Number(process.env.PORT) || 3001) {
  if (cachedPublicUrl) return cachedPublicUrl;

  const envUrl = process.env.PUBLIC_SERVER_URL || process.env.PUBLIC_BASE_URL;
  if (envUrl && envUrl.trim()) {
    cachedPublicUrl = envUrl.trim().replace(/\/$/, '');
    return cachedPublicUrl;
  }

  const lanIp = detectLanIp();
  cachedPublicUrl = `http://${lanIp}:${port}`;
  return cachedPublicUrl;
}

function invalidatePublicUrlCache() {
  cachedPublicUrl = null;
}

module.exports = {
  resolvePublicServerUrl,
  detectLanIp,
  invalidatePublicUrlCache,
};
