const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../config/database');
const { authenticate, requireRole, generateToken } = require('../middleware/auth');

// Register new organization + admin user
router.post('/register', (req, res) => {
  const {
    org_name,
    industry,
    company_number,
    address,
    contact_email,
    contact_phone,
    admin_email,
    admin_password,
    admin_first_name,
    admin_last_name
  } = req.body;

  if (!org_name || !admin_email || !admin_password) {
    return res.status(400).json({
      error: 'Organization name, admin email, and admin password are required'
    });
  }

  if (admin_password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  const orgId = uuidv4();
  const userId = uuidv4();
  const slug = org_name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const passwordHash = bcrypt.hashSync(admin_password, 12);

  // Create organization
  const orgSql = `INSERT INTO organizations (id, name, slug, industry, company_number, address, contact_email, contact_phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

  db.run(orgSql, [orgId, org_name, slug, industry, company_number, address, contact_email || admin_email, contact_phone], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint')) {
        return res.status(409).json({ error: 'Organization with this name already exists' });
      }
      return res.status(500).json({ error: err.message });
    }

    // Create admin user
    const userSql = `INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role)
      VALUES (?, ?, ?, ?, ?, ?, 'admin')`;

    db.run(userSql, [userId, orgId, admin_email, passwordHash, admin_first_name, admin_last_name], function(err) {
      if (err) {
        // Rollback org creation
        db.run('DELETE FROM organizations WHERE id = ?', [orgId]);
        if (err.message.includes('UNIQUE constraint')) {
          return res.status(409).json({ error: 'Email already registered' });
        }
        return res.status(500).json({ error: err.message });
      }

      // Insert default compliance deadlines for the new org
      insertDefaultDeadlines(orgId);

      const token = generateToken({ id: userId, email: admin_email, role: 'admin', organization_id: orgId });

      res.status(201).json({
        success: true,
        data: {
          organization: { id: orgId, name: org_name, slug },
          user: { id: userId, email: admin_email, role: 'admin' },
          token
        }
      });
    });
  });
});

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  db.get(
    `SELECT u.*, o.name as org_name, o.is_active as org_active
     FROM users u JOIN organizations o ON u.organization_id = o.id
     WHERE u.email = ?`,
    [email],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated' });
      if (!user.org_active) return res.status(403).json({ error: 'Organization is inactive' });

      if (!bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

      const token = generateToken(user);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
            role: user.role,
            organization_id: user.organization_id,
            org_name: user.org_name
          },
          token
        }
      });
    }
  );
});

// Get current organization details
router.get('/me', authenticate, (req, res) => {
  db.get('SELECT * FROM organizations WHERE id = ?', [req.user.organizationId], (err, org) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Get user count
    db.get('SELECT COUNT(*) as user_count FROM users WHERE organization_id = ?', [org.id], (err, userCount) => {
      if (err) return res.status(500).json({ error: err.message });

      // Get item count
      db.get('SELECT COUNT(*) as item_count FROM packaging_items WHERE organization_id = ?', [org.id], (err, itemCount) => {
        if (err) return res.status(500).json({ error: err.message });

        res.json({
          success: true,
          data: {
            ...org,
            settings: JSON.parse(org.settings || '{}'),
            usage: {
              users: userCount.user_count,
              max_users: org.max_users,
              items: itemCount.item_count,
              max_items: org.max_items
            }
          }
        });
      });
    });
  });
});

// Update organization
router.put('/me', authenticate, requireRole('admin'), (req, res) => {
  const { name, industry, company_number, address, contact_email, contact_phone, settings } = req.body;

  const updates = [];
  const params = [];

  if (name) { updates.push('name = ?'); params.push(name); }
  if (industry) { updates.push('industry = ?'); params.push(industry); }
  if (company_number) { updates.push('company_number = ?'); params.push(company_number); }
  if (address) { updates.push('address = ?'); params.push(address); }
  if (contact_email) { updates.push('contact_email = ?'); params.push(contact_email); }
  if (contact_phone) { updates.push('contact_phone = ?'); params.push(contact_phone); }
  if (settings) { updates.push('settings = ?'); params.push(JSON.stringify(settings)); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(req.user.organizationId);

  db.run(`UPDATE organizations SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, message: 'Organization updated' });
  });
});

// --- User Management ---

// List users in organization
router.get('/users', authenticate, requireRole('admin', 'auditor'), (req, res) => {
  db.all(
    `SELECT id, email, first_name, last_name, role, is_active, last_login, created_at
     FROM users WHERE organization_id = ? ORDER BY created_at DESC`,
    [req.user.organizationId],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, data: users });
    }
  );
});

// Invite / create user
router.post('/users', authenticate, requireRole('admin'), (req, res) => {
  const { email, password, first_name, last_name, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const validRoles = ['admin', 'auditor', 'operator', 'readonly'];
  if (role && !validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
  }

  // Check user limit
  db.get('SELECT COUNT(*) as count FROM users WHERE organization_id = ?', [req.user.organizationId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    db.get('SELECT max_users FROM organizations WHERE id = ?', [req.user.organizationId], (err, org) => {
      if (err) return res.status(500).json({ error: err.message });

      if (result.count >= org.max_users) {
        return res.status(403).json({ error: `User limit reached (${org.max_users}). Upgrade your plan.` });
      }

      const userId = uuidv4();
      const passwordHash = bcrypt.hashSync(password, 12);

      db.run(
        `INSERT INTO users (id, organization_id, email, password_hash, first_name, last_name, role)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, req.user.organizationId, email, passwordHash, first_name, last_name, role || 'operator'],
        function(err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint')) {
              return res.status(409).json({ error: 'Email already registered' });
            }
            return res.status(500).json({ error: err.message });
          }
          res.status(201).json({
            success: true,
            data: { id: userId, email, first_name, last_name, role: role || 'operator' }
          });
        }
      );
    });
  });
});

// Update user role or status
router.put('/users/:userId', authenticate, requireRole('admin'), (req, res) => {
  const { role, is_active, first_name, last_name } = req.body;
  const { userId } = req.params;

  const updates = [];
  const params = [];

  if (role) {
    const validRoles = ['admin', 'auditor', 'operator', 'readonly'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }
    updates.push('role = ?');
    params.push(role);
  }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (first_name) { updates.push('first_name = ?'); params.push(first_name); }
  if (last_name) { updates.push('last_name = ?'); params.push(last_name); }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(userId, req.user.organizationId);

  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ? AND organization_id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'User updated' });
  });
});

// Delete user
router.delete('/users/:userId', authenticate, requireRole('admin'), (req, res) => {
  const { userId } = req.params;

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }

  db.run(
    'DELETE FROM users WHERE id = ? AND organization_id = ?',
    [userId, req.user.organizationId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true, message: 'User deleted' });
    }
  );
});

// --- API Key Management ---

// List API keys
router.get('/api-keys', authenticate, requireRole('admin'), (req, res) => {
  db.all(
    `SELECT id, name, key_prefix, permissions, is_active, last_used, expires_at, created_at
     FROM api_keys WHERE organization_id = ? ORDER BY created_at DESC`,
    [req.user.organizationId],
    (err, keys) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        success: true,
        data: keys.map(k => ({ ...k, permissions: JSON.parse(k.permissions || '["read"]') }))
      });
    }
  );
});

// Create API key
router.post('/api-keys', authenticate, requireRole('admin'), (req, res) => {
  const { name, permissions, expires_in_days } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'API key name is required' });
  }

  const validPermissions = ['read', 'write', 'admin'];
  const perms = permissions || ['read'];
  if (!perms.every(p => validPermissions.includes(p))) {
    return res.status(400).json({ error: `Invalid permissions. Must be: ${validPermissions.join(', ')}` });
  }

  const keyId = uuidv4();
  const rawKey = `wm_${crypto.randomBytes(32).toString('hex')}`;
  const keyPrefix = rawKey.substring(0, 8);
  const keyHash = bcrypt.hashSync(rawKey, 10);
  const expiresAt = expires_in_days
    ? new Date(Date.now() + expires_in_days * 86400000).toISOString()
    : null;

  db.run(
    `INSERT INTO api_keys (id, organization_id, name, key_hash, key_prefix, permissions, expires_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [keyId, req.user.organizationId, name, keyHash, keyPrefix, JSON.stringify(perms), expiresAt, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        success: true,
        data: {
          id: keyId,
          name,
          key: rawKey,  // Only shown once!
          key_prefix: keyPrefix,
          permissions: perms,
          expires_at: expiresAt,
          warning: 'Store this key securely. It will not be shown again.'
        }
      });
    }
  );
});

// Revoke API key
router.delete('/api-keys/:keyId', authenticate, requireRole('admin'), (req, res) => {
  db.run(
    'UPDATE api_keys SET is_active = 0 WHERE id = ? AND organization_id = ?',
    [req.params.keyId, req.user.organizationId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'API key not found' });
      res.json({ success: true, message: 'API key revoked' });
    }
  );
});

// Organization dashboard (tenant-specific KPIs)
router.get('/dashboard', authenticate, (req, res) => {
  const orgId = req.user.organizationId;

  const statsSql = `
    SELECT
      COUNT(DISTINCT pi.id) as total_items,
      COUNT(DISTINCT pi.manufacturer) as total_manufacturers,
      COUNT(pc.id) as total_cycles,
      AVG(pc.condition_score) as avg_condition_score,
      SUM(CASE WHEN pi.status = 'active' THEN 1 ELSE 0 END) as active_items,
      SUM(CASE WHEN pi.status = 'retired' THEN 1 ELSE 0 END) as retired_items
    FROM packaging_items pi
    LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    WHERE pi.organization_id = ?
  `;

  db.get(statsSql, [orgId], (err, stats) => {
    if (err) return res.status(500).json({ error: err.message });

    // Get compliance stats
    db.all(
      `SELECT compliance_status, COUNT(*) as count FROM uk_compliance_records
       WHERE organization_id = ? GROUP BY compliance_status`,
      [orgId],
      (err, compliance) => {
        if (err) return res.status(500).json({ error: err.message });

        // Get unread alerts
        db.get(
          'SELECT COUNT(*) as count FROM compliance_alerts WHERE organization_id = ? AND is_read = 0',
          [orgId],
          (err, alerts) => {
            if (err) return res.status(500).json({ error: err.message });

            // Get upcoming deadlines
            db.all(
              `SELECT * FROM compliance_deadlines
               WHERE organization_id = ? AND status = 'upcoming' AND deadline_date >= date('now')
               ORDER BY deadline_date ASC LIMIT 5`,
              [orgId],
              (err, deadlines) => {
                if (err) return res.status(500).json({ error: err.message });

                res.json({
                  success: true,
                  data: {
                    organization: { id: orgId, name: req.user.orgName },
                    packaging_stats: stats,
                    compliance_breakdown: compliance,
                    unread_alerts: alerts.count,
                    upcoming_deadlines: deadlines
                  }
                });
              }
            );
          }
        );
      }
    );
  });
});

// Helper: insert default UK compliance deadlines for new org
function insertDefaultDeadlines(orgId) {
  const currentYear = new Date().getFullYear();
  const deadlines = [
    ['EPR Data Submission', 'Annual EPR packaging data submission to EA', 'EPR', `${currentYear}-04-01`, 30],
    ['PRN/PERN Purchase Deadline', 'Purchase Packaging Recovery Notes by deadline', 'PRN', `${currentYear}-01-31`, 30],
    ['Plastic Packaging Tax Return', 'Quarterly PPT return submission', 'PPT', `${currentYear}-04-30`, 14],
    ['Q2 PPT Return', 'Quarterly PPT return submission', 'PPT', `${currentYear}-07-31`, 14],
    ['Q3 PPT Return', 'Quarterly PPT return submission', 'PPT', `${currentYear}-10-31`, 14],
    ['Q4 PPT Return', 'Quarterly PPT return submission', 'PPT', `${currentYear + 1}-01-31`, 14],
    ['Annual Waste Report', 'Annual waste transfer and disposal report', 'WasteRegulations', `${currentYear}-03-31`, 30],
    ['Carrier License Renewal', 'Waste carrier license renewal check', 'WasteCarrier', `${currentYear}-12-31`, 60]
  ];

  deadlines.forEach(([title, desc, regType, date, reminder]) => {
    db.run(
      `INSERT INTO compliance_deadlines (organization_id, title, description, regulation_type, deadline_date, reminder_days)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orgId, title, desc, regType, date, reminder]
    );
  });
}

module.exports = router;
