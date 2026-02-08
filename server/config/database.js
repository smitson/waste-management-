const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../database/waste_management.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    db.run('PRAGMA foreign_keys = ON');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  const tables = [
    // Organizations table (multi-tenant)
    `CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      industry TEXT,
      company_number TEXT,
      address TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      subscription_tier TEXT DEFAULT 'starter',
      max_users INTEGER DEFAULT 5,
      max_items INTEGER DEFAULT 1000,
      is_active BOOLEAN DEFAULT 1,
      settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      role TEXT DEFAULT 'operator',
      is_active BOOLEAN DEFAULT 1,
      last_login DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations (id)
    )`,

    // API keys table
    `CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE,
      key_prefix TEXT NOT NULL,
      permissions TEXT DEFAULT '["read"]',
      is_active BOOLEAN DEFAULT 1,
      last_used DATETIME,
      expires_at DATETIME,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )`,

    // Material types table
    `CREATE TABLE IF NOT EXISTS material_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      recyclable BOOLEAN DEFAULT 0,
      biodegradable BOOLEAN DEFAULT 0,
      uk_waste_code TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Packaging items table (with organization_id)
    `CREATE TABLE IF NOT EXISTS packaging_items (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      material_type_id INTEGER,
      manufacturer TEXT,
      product_name TEXT NOT NULL,
      batch_number TEXT,
      production_date DATE,
      expiry_date DATE,
      weight REAL,
      dimensions TEXT,
      status TEXT DEFAULT 'active',
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (material_type_id) REFERENCES material_types (id),
      FOREIGN KEY (organization_id) REFERENCES organizations (id)
    )`,

    // Traceability events table
    `CREATE TABLE IF NOT EXISTS traceability_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      packaging_item_id TEXT,
      event_type TEXT NOT NULL,
      event_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      location TEXT,
      operator TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (packaging_item_id) REFERENCES packaging_items (id)
    )`,

    // Circular packaging cycles table
    `CREATE TABLE IF NOT EXISTS packaging_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      packaging_item_id TEXT,
      cycle_number INTEGER,
      start_date DATETIME,
      end_date DATETIME,
      reuse_type TEXT,
      condition_score INTEGER,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (packaging_item_id) REFERENCES packaging_items (id)
    )`,

    // UK compliance records table
    `CREATE TABLE IF NOT EXISTS uk_compliance_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      packaging_item_id TEXT,
      organization_id TEXT,
      regulation_type TEXT NOT NULL,
      compliance_status TEXT DEFAULT 'pending',
      assessment_date DATETIME,
      assessor TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (packaging_item_id) REFERENCES packaging_items (id),
      FOREIGN KEY (organization_id) REFERENCES organizations (id)
    )`,

    // Performance metrics table
    `CREATE TABLE IF NOT EXISTS performance_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id TEXT,
      metric_type TEXT NOT NULL,
      metric_value REAL,
      unit TEXT,
      period_start DATE,
      period_end DATE,
      category TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations (id)
    )`,

    // Compliance alerts table
    `CREATE TABLE IF NOT EXISTS compliance_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      severity TEXT DEFAULT 'medium',
      title TEXT NOT NULL,
      message TEXT,
      regulation_type TEXT,
      is_read BOOLEAN DEFAULT 0,
      is_resolved BOOLEAN DEFAULT 0,
      resolved_at DATETIME,
      resolved_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations (id)
    )`,

    // Compliance schedules table
    `CREATE TABLE IF NOT EXISTS compliance_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id TEXT NOT NULL,
      schedule_name TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      cron_expression TEXT,
      last_run DATETIME,
      next_run DATETIME,
      is_active BOOLEAN DEFAULT 1,
      config TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations (id)
    )`,

    // Compliance deadlines / calendar
    `CREATE TABLE IF NOT EXISTS compliance_deadlines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      regulation_type TEXT,
      deadline_date DATE NOT NULL,
      reminder_days INTEGER DEFAULT 14,
      status TEXT DEFAULT 'upcoming',
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations (id)
    )`,

    // Webhooks table
    `CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      secret TEXT,
      events TEXT DEFAULT '["all"]',
      is_active BOOLEAN DEFAULT 1,
      last_triggered DATETIME,
      failure_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations (id)
    )`,

    // Bulk import jobs table
    `CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      total_rows INTEGER DEFAULT 0,
      processed_rows INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      errors TEXT DEFAULT '[]',
      created_by TEXT,
      started_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations (id),
      FOREIGN KEY (created_by) REFERENCES users (id)
    )`
  ];

  // Create tables sequentially
  function createTable(index) {
    if (index >= tables.length) {
      // All tables created, now insert default data
      setTimeout(insertDefaultMaterialTypes, 100);
      // Add organization_id column to existing tables if missing
      setTimeout(migrateExistingTables, 200);
      return;
    }

    db.run(tables[index], (err) => {
      if (err) {
        console.error(`Error creating table ${index + 1}:`, err.message);
      } else {
        console.log(`Table ${index + 1} created successfully`);
      }
      createTable(index + 1);
    });
  }

  createTable(0);
}

function migrateExistingTables() {
  // Add organization_id to packaging_items if not present
  db.run(`ALTER TABLE packaging_items ADD COLUMN organization_id TEXT REFERENCES organizations(id)`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Migration note:', err.message);
    }
  });
  // Add organization_id to uk_compliance_records if not present
  db.run(`ALTER TABLE uk_compliance_records ADD COLUMN organization_id TEXT REFERENCES organizations(id)`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Migration note:', err.message);
    }
  });
  // Add organization_id to performance_metrics if not present
  db.run(`ALTER TABLE performance_metrics ADD COLUMN organization_id TEXT REFERENCES organizations(id)`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.error('Migration note:', err.message);
    }
  });
}

function insertDefaultMaterialTypes() {
  const defaultMaterials = [
    ['Plastic - PET', 'Plastic', 1, 0, 'W001', 'Polyethylene terephthalate - commonly used for bottles'],
    ['Plastic - HDPE', 'Plastic', 1, 0, 'W002', 'High-density polyethylene - milk jugs, detergent bottles'],
    ['Plastic - PVC', 'Plastic', 1, 0, 'W003', 'Polyvinyl chloride - pipes, packaging'],
    ['Plastic - LDPE', 'Plastic', 1, 0, 'W004', 'Low-density polyethylene - plastic bags, containers'],
    ['Plastic - PP', 'Plastic', 1, 0, 'W005', 'Polypropylene - yogurt containers, bottle caps'],
    ['Plastic - PS', 'Plastic', 1, 0, 'W006', 'Polystyrene - disposable cups, takeaway containers'],
    ['Glass - Clear', 'Glass', 1, 0, 'W020', 'Clear glass bottles and jars'],
    ['Glass - Colored', 'Glass', 1, 0, 'W021', 'Colored glass bottles and containers'],
    ['Paper - Cardboard', 'Paper', 1, 1, 'W030', 'Corrugated cardboard packaging'],
    ['Paper - Paperboard', 'Paper', 1, 1, 'W031', 'Folding cartons and lightweight packaging'],
    ['Metal - Aluminum', 'Metal', 1, 0, 'W040', 'Aluminum cans and containers'],
    ['Metal - Steel', 'Metal', 1, 0, 'W041', 'Steel cans and containers'],
    ['Biodegradable - PLA', 'Biodegradable', 1, 1, 'W050', 'Polylactic acid - compostable plastic alternative'],
    ['Biodegradable - Starch', 'Biodegradable', 1, 1, 'W051', 'Starch-based biodegradable materials']
  ];

  const insertSql = `INSERT OR IGNORE INTO material_types
    (name, category, recyclable, biodegradable, uk_waste_code, description)
    VALUES (?, ?, ?, ?, ?, ?)`;

  defaultMaterials.forEach((material) => {
    db.run(insertSql, material, (err) => {
      if (err) {
        console.error('Error inserting default material:', err.message);
      }
    });
  });
}

module.exports = db;
