const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'ink-diary-secret-change-in-production';

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

// Required auth — returns 401 if not logged in
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: '请先登录' });
  }
  try {
    const payload = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// Optional auth — sets req.userId if token present, but doesn't block
function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.split(' ')[1], JWT_SECRET);
      req.userId = payload.userId;
    } catch {}
  }
  next();
}

module.exports = { generateToken, requireAuth, optionalAuth, JWT_SECRET };
