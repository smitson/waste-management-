const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '../../database/waste_management.db');

// Create database connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  const tables = [
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

    // Packaging items table
    `CREATE TABLE IF NOT EXISTS packaging_items (
      id TEXT PRIMARY KEY,
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
      FOREIGN KEY (material_type_id) REFERENCES material_types (id)
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
      regulation_type TEXT NOT NULL,
      compliance_status TEXT DEFAULT 'pending',
      assessment_date DATETIME,
      assessor TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (packaging_item_id) REFERENCES packaging_items (id)
    )`,

    // Performance metrics table
    `CREATE TABLE IF NOT EXISTS performance_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      metric_type TEXT NOT NULL,
      metric_value REAL,
      unit TEXT,
      period_start DATE,
      period_end DATE,
      category TEXT,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  // Create tables sequentially
  function createTable(index) {
    if (index >= tables.length) {
      // All tables created, now insert default data
      setTimeout(insertDefaultMaterialTypes, 100);
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