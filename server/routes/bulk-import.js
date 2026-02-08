const express = require('express');
const router = express.Router();
const multer = require('multer');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify/sync');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

// Configure multer for CSV uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv') {
      return cb(new Error('Only CSV files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Download CSV template for packaging items
router.get('/template', authenticate, (req, res) => {
  const template = stringify([
    ['product_name', 'manufacturer', 'material_type', 'batch_number', 'production_date', 'expiry_date', 'weight_kg', 'dimensions', 'location'],
    ['Example Product', 'Acme Corp', 'Plastic - PET', 'BATCH-001', '2024-01-15', '2025-01-15', '0.5', '10x10x20cm', 'Warehouse A'],
    ['Glass Bottle 500ml', 'GlassCo UK', 'Glass - Clear', 'BATCH-002', '2024-02-01', '2026-02-01', '0.35', '7x7x25cm', 'Factory Floor']
  ]);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=packaging_import_template.csv');
  res.send(template);
});

// Download CSV template for compliance records
router.get('/template/compliance', authenticate, (req, res) => {
  const template = stringify([
    ['packaging_item_id', 'regulation_type', 'compliance_status', 'assessor', 'notes'],
    ['<packaging-uuid>', 'EPR', 'compliant', 'John Smith', 'Annual assessment passed'],
    ['<packaging-uuid>', 'PPT', 'pending', 'Jane Doe', 'Awaiting lab results']
  ]);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename=compliance_import_template.csv');
  res.send(template);
});

// Bulk import packaging items via CSV
router.post('/packaging', authenticate, requireRole('admin', 'operator'), upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file is required' });
  }

  const orgId = req.user.organizationId;
  const jobId = uuidv4();
  const filePath = req.file.path;

  // Create import job record
  db.run(
    `INSERT INTO import_jobs (id, organization_id, filename, status, created_by, started_at)
     VALUES (?, ?, ?, 'processing', ?, CURRENT_TIMESTAMP)`,
    [jobId, orgId, req.file.originalname, req.user.id]
  );

  // Read and parse CSV
  const records = [];
  const errors = [];
  let rowNum = 0;

  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true
    })
  );

  parser.on('data', (record) => {
    rowNum++;
    records.push({ row: rowNum, data: record });
  });

  parser.on('error', (err) => {
    db.run(
      `UPDATE import_jobs SET status = 'failed', errors = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [JSON.stringify([{ row: 0, error: err.message }]), jobId]
    );
    // Clean up file
    fs.unlink(filePath, () => {});
    return res.status(400).json({ error: 'CSV parsing error', details: err.message });
  });

  parser.on('end', () => {
    // Validate and process all records
    processPackagingImport(orgId, jobId, records, (result) => {
      // Clean up file
      fs.unlink(filePath, () => {});

      // Update job record
      db.run(
        `UPDATE import_jobs SET status = ?, total_rows = ?, processed_rows = ?,
         success_count = ?, error_count = ?, errors = ?, completed_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          result.errors.length > 0 ? 'completed_with_errors' : 'completed',
          records.length,
          result.processed,
          result.success,
          result.errors.length,
          JSON.stringify(result.errors),
          jobId
        ]
      );

      res.json({
        success: true,
        data: {
          job_id: jobId,
          total_rows: records.length,
          successfully_imported: result.success,
          errors: result.errors.length,
          error_details: result.errors.slice(0, 50), // Limit error details in response
          message: result.errors.length > 0
            ? `Imported ${result.success} of ${records.length} items with ${result.errors.length} errors`
            : `Successfully imported all ${result.success} items`
        }
      });
    });
  });
});

// Get import job status
router.get('/jobs', authenticate, (req, res) => {
  db.all(
    `SELECT id, filename, status, total_rows, processed_rows, success_count, error_count, created_at, completed_at
     FROM import_jobs WHERE organization_id = ? ORDER BY created_at DESC LIMIT 20`,
    [req.user.organizationId],
    (err, jobs) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, data: jobs });
    }
  );
});

// Get specific job errors
router.get('/jobs/:jobId/errors', authenticate, (req, res) => {
  db.get(
    'SELECT errors FROM import_jobs WHERE id = ? AND organization_id = ?',
    [req.params.jobId, req.user.organizationId],
    (err, job) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!job) return res.status(404).json({ error: 'Job not found' });
      res.json({ success: true, data: JSON.parse(job.errors || '[]') });
    }
  );
});

// Validate CSV without importing (dry run)
router.post('/validate', authenticate, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'CSV file is required' });
  }

  const filePath = req.file.path;
  const records = [];
  const errors = [];
  let rowNum = 0;

  const parser = fs.createReadStream(filePath).pipe(
    parse({
      columns: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true
    })
  );

  parser.on('data', (record) => {
    rowNum++;
    const validation = validatePackagingRecord(record, rowNum);
    records.push({ row: rowNum, valid: validation.valid, errors: validation.errors, data: record });
    if (!validation.valid) {
      errors.push({ row: rowNum, errors: validation.errors });
    }
  });

  parser.on('error', (err) => {
    fs.unlink(filePath, () => {});
    return res.status(400).json({ error: 'CSV parsing error', details: err.message });
  });

  parser.on('end', () => {
    fs.unlink(filePath, () => {});
    res.json({
      success: true,
      data: {
        total_rows: rowNum,
        valid_rows: rowNum - errors.length,
        invalid_rows: errors.length,
        errors: errors.slice(0, 100),
        preview: records.slice(0, 10).map(r => ({
          row: r.row,
          valid: r.valid,
          data: r.data,
          errors: r.errors
        }))
      }
    });
  });
});

// --- Webhook Management ---

// List webhooks
router.get('/webhooks', authenticate, requireRole('admin'), (req, res) => {
  db.all(
    'SELECT id, name, url, events, is_active, last_triggered, failure_count, created_at FROM webhooks WHERE organization_id = ?',
    [req.user.organizationId],
    (err, webhooks) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        success: true,
        data: webhooks.map(w => ({ ...w, events: JSON.parse(w.events || '["all"]') }))
      });
    }
  );
});

// Create webhook
router.post('/webhooks', authenticate, requireRole('admin'), (req, res) => {
  const { name, url, secret, events } = req.body;

  if (!name || !url) {
    return res.status(400).json({ error: 'Webhook name and URL are required' });
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  const validEvents = ['all', 'packaging.created', 'packaging.updated', 'compliance.alert', 'compliance.check', 'import.completed'];
  const webhookEvents = events || ['all'];
  if (!webhookEvents.every(e => validEvents.includes(e))) {
    return res.status(400).json({ error: `Invalid events. Must be: ${validEvents.join(', ')}` });
  }

  const webhookId = uuidv4();

  db.run(
    `INSERT INTO webhooks (id, organization_id, name, url, secret, events) VALUES (?, ?, ?, ?, ?, ?)`,
    [webhookId, req.user.organizationId, name, url, secret, JSON.stringify(webhookEvents)],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        success: true,
        data: { id: webhookId, name, url, events: webhookEvents }
      });
    }
  );
});

// Delete webhook
router.delete('/webhooks/:webhookId', authenticate, requireRole('admin'), (req, res) => {
  db.run(
    'DELETE FROM webhooks WHERE id = ? AND organization_id = ?',
    [req.params.webhookId, req.user.organizationId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Webhook not found' });
      res.json({ success: true, message: 'Webhook deleted' });
    }
  );
});

// Toggle webhook
router.put('/webhooks/:webhookId/toggle', authenticate, requireRole('admin'), (req, res) => {
  db.get(
    'SELECT is_active FROM webhooks WHERE id = ? AND organization_id = ?',
    [req.params.webhookId, req.user.organizationId],
    (err, webhook) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

      db.run(
        'UPDATE webhooks SET is_active = ? WHERE id = ?',
        [webhook.is_active ? 0 : 1, req.params.webhookId],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, message: `Webhook ${webhook.is_active ? 'disabled' : 'enabled'}` });
        }
      );
    }
  );
});

// --- Helper Functions ---

function validatePackagingRecord(record, rowNum) {
  const errors = [];

  if (!record.product_name || record.product_name.trim() === '') {
    errors.push('product_name is required');
  }
  if (!record.manufacturer || record.manufacturer.trim() === '') {
    errors.push('manufacturer is required');
  }
  if (!record.material_type || record.material_type.trim() === '') {
    errors.push('material_type is required');
  }
  if (record.weight_kg && isNaN(parseFloat(record.weight_kg))) {
    errors.push('weight_kg must be a number');
  }
  if (record.production_date && isNaN(Date.parse(record.production_date))) {
    errors.push('production_date must be a valid date (YYYY-MM-DD)');
  }
  if (record.expiry_date && isNaN(Date.parse(record.expiry_date))) {
    errors.push('expiry_date must be a valid date (YYYY-MM-DD)');
  }

  return { valid: errors.length === 0, errors };
}

function processPackagingImport(orgId, jobId, records, callback) {
  let processed = 0;
  let success = 0;
  const errors = [];

  if (records.length === 0) {
    return callback({ processed: 0, success: 0, errors: [{ row: 0, error: 'No records found in CSV' }] });
  }

  // First, get material type mappings
  db.all('SELECT id, name FROM material_types', [], (err, materials) => {
    if (err) {
      return callback({ processed: 0, success: 0, errors: [{ row: 0, error: err.message }] });
    }

    const materialMap = {};
    materials.forEach(m => {
      materialMap[m.name.toLowerCase()] = m.id;
    });

    function processRecord(index) {
      if (index >= records.length) {
        return callback({ processed, success, errors });
      }

      const { row, data } = records[index];
      const validation = validatePackagingRecord(data, row);

      if (!validation.valid) {
        errors.push({ row, errors: validation.errors });
        processed++;
        return processRecord(index + 1);
      }

      // Look up material type
      const materialId = materialMap[(data.material_type || '').toLowerCase()];
      if (!materialId) {
        errors.push({ row, errors: [`Material type '${data.material_type}' not found. Valid types: ${Object.keys(materialMap).join(', ')}`] });
        processed++;
        return processRecord(index + 1);
      }

      const itemId = uuidv4();
      const sql = `INSERT INTO packaging_items
        (id, organization_id, material_type_id, manufacturer, product_name, batch_number,
         production_date, expiry_date, weight, dimensions, location)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

      db.run(sql, [
        itemId, orgId, materialId, data.manufacturer, data.product_name,
        data.batch_number || null, data.production_date || null, data.expiry_date || null,
        data.weight_kg ? parseFloat(data.weight_kg) : null,
        data.dimensions || null, data.location || null
      ], function(err) {
        processed++;
        if (err) {
          errors.push({ row, errors: [err.message] });
        } else {
          success++;
          // Add traceability event
          db.run(
            `INSERT INTO traceability_events (packaging_item_id, event_type, location, operator, details)
             VALUES (?, 'created', ?, 'bulk_import', ?)`,
            [itemId, data.location || 'imported', `Bulk imported: ${data.product_name} (Job: ${jobId})`]
          );
        }
        processRecord(index + 1);
      });
    }

    processRecord(0);
  });
}

module.exports = router;
