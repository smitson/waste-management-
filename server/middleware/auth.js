const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'uk-waste-mgmt-secret-change-in-production';
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

// Role hierarchy: admin > auditor > operator > readonly
const ROLE_HIERARCHY = {
  admin: 4,
  auditor: 3,
  operator: 2,
  readonly: 1
};

// Authenticate via JWT token or API key
function authenticate(req, res, next) {
  // Check for API key first (X-API-Key header)
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    return authenticateApiKey(apiKey, req, res, next);
  }

  // Check for Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide Bearer token or X-API-Key header.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Look up user to ensure they're still active
    db.get(
      `SELECT u.*, o.is_active as org_active, o.name as org_name, o.subscription_tier
       FROM users u JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = ? AND u.is_active = 1`,
      [decoded.userId],
      (err, user) => {
        if (err) return res.status(500).json({ error: 'Authentication error' });
        if (!user) return res.status(401).json({ error: 'User not found or inactive' });
        if (!user.org_active) return res.status(403).json({ error: 'Organization is inactive' });

        req.user = {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          organizationId: user.organization_id,
          orgName: user.org_name,
          subscriptionTier: user.subscription_tier
        };
        next();
      }
    );
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function authenticateApiKey(key, req, res, next) {
  const prefix = key.substring(0, 8);
  const keyHash = bcrypt.hashSync(key, 10);

  // Find API key by prefix, then verify
  db.get(
    `SELECT ak.*, o.is_active as org_active, o.name as org_name, o.subscription_tier
     FROM api_keys ak JOIN organizations o ON ak.organization_id = o.id
     WHERE ak.key_prefix = ? AND ak.is_active = 1`,
    [prefix],
    (err, apiKeyRecord) => {
      if (err) return res.status(500).json({ error: 'Authentication error' });
      if (!apiKeyRecord) return res.status(401).json({ error: 'Invalid API key' });
      if (!apiKeyRecord.org_active) return res.status(403).json({ error: 'Organization is inactive' });

      // Check expiry
      if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at) < new Date()) {
        return res.status(401).json({ error: 'API key expired' });
      }

      // Verify the key hash
      if (!bcrypt.compareSync(key, apiKeyRecord.key_hash)) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      // Update last used
      db.run('UPDATE api_keys SET last_used = CURRENT_TIMESTAMP WHERE id = ?', [apiKeyRecord.id]);

      const permissions = JSON.parse(apiKeyRecord.permissions || '["read"]');
      req.user = {
        id: apiKeyRecord.id,
        role: 'api_key',
        permissions,
        organizationId: apiKeyRecord.organization_id,
        orgName: apiKeyRecord.org_name,
        subscriptionTier: apiKeyRecord.subscription_tier,
        isApiKey: true
      };
      next();
    }
  );
}

// Optional auth - continues even without token (for backward compatibility)
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  if (!authHeader && !apiKey) {
    req.user = null;
    return next();
  }

  return authenticate(req, res, next);
}

// Require minimum role
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.isApiKey) {
      // API keys: check permissions array
      const hasPermission = roles.some(role => {
        if (role === 'readonly') return true; // API keys always have read
        return req.user.permissions.includes(role) || req.user.permissions.includes('admin');
      });
      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient API key permissions' });
      }
      return next();
    }

    if (!roles.includes(req.user.role) && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }
    next();
  };
}

// Ensure user can only access their organization's data
function tenantIsolation(req, res, next) {
  if (!req.user) return next();

  // Admins with no org can see everything (super-admin concept)
  req.organizationId = req.user.organizationId;
  next();
}

// Generate JWT token
function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

module.exports = {
  authenticate,
  optionalAuth,
  requireRole,
  tenantIsolation,
  generateToken,
  JWT_SECRET,
  ROLE_HIERARCHY
};
