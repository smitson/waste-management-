const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Get traceability events for a packaging item
router.get('/:packageId/events', (req, res) => {
  const sql = `
    SELECT te.*, pi.product_name, mt.name as material_name
    FROM traceability_events te
    JOIN packaging_items pi ON te.packaging_item_id = pi.id
    JOIN material_types mt ON pi.material_type_id = mt.id
    WHERE te.packaging_item_id = ?
    ORDER BY te.event_date DESC
  `;
  
  db.all(sql, [req.params.packageId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      success: true,
      data: rows,
      count: rows.length
    });
  });
});

// Add traceability event
router.post('/:packageId/events', (req, res) => {
  const { event_type, location, operator, details } = req.body;
  const packageId = req.params.packageId;
  
  if (!event_type || !location || !operator) {
    return res.status(400).json({ 
      error: 'Event type, location, and operator are required' 
    });
  }
  
  const sql = `
    INSERT INTO traceability_events 
    (packaging_item_id, event_type, location, operator, details)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [packageId, event_type, location, operator, details], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    res.json({
      success: true,
      data: {
        id: this.lastID,
        packaging_item_id: packageId,
        event_type,
        location,
        operator,
        details,
        event_date: new Date().toISOString()
      }
    });
  });
});

// Get complete traceability chain for end-to-end tracking
router.get('/:packageId/chain', (req, res) => {
  const packageId = req.params.packageId;
  
  // Get packaging item details
  const packageSql = `
    SELECT pi.*, mt.name as material_name, mt.category, mt.uk_waste_code
    FROM packaging_items pi
    JOIN material_types mt ON pi.material_type_id = mt.id
    WHERE pi.id = ?
  `;
  
  db.get(packageSql, [packageId], (err, packageItem) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!packageItem) {
      return res.status(404).json({ error: 'Packaging item not found' });
    }
    
    // Get all events
    const eventsSql = `
      SELECT * FROM traceability_events 
      WHERE packaging_item_id = ?
      ORDER BY event_date ASC
    `;
    
    db.all(eventsSql, [packageId], (err, events) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Get packaging cycles
      const cyclesSql = `
        SELECT * FROM packaging_cycles 
        WHERE packaging_item_id = ?
        ORDER BY cycle_number ASC
      `;
      
      db.all(cyclesSql, [packageId], (err, cycles) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Get compliance records
        const complianceSql = `
          SELECT * FROM uk_compliance_records 
          WHERE packaging_item_id = ?
          ORDER BY assessment_date DESC
        `;
        
        db.all(complianceSql, [packageId], (err, compliance) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          const traceabilityChain = {
            package_info: packageItem,
            events: events,
            reuse_cycles: cycles,
            compliance_records: compliance,
            summary: {
              total_events: events.length,
              total_cycles: cycles.length,
              current_status: packageItem.status,
              last_event: events.length > 0 ? events[events.length - 1] : null,
              compliance_status: compliance.length > 0 ? compliance[0].compliance_status : 'not_assessed'
            }
          };
          
          res.json({
            success: true,
            data: traceabilityChain
          });
        });
      });
    });
  });
});

// Batch traceability tracking
router.get('/batch/:batchNumber', (req, res) => {
  const batchNumber = req.params.batchNumber;
  
  const sql = `
    SELECT 
      pi.*,
      mt.name as material_name,
      mt.category,
      COUNT(te.id) as total_events,
      COUNT(pc.id) as total_cycles,
      MAX(te.event_date) as last_event_date
    FROM packaging_items pi
    JOIN material_types mt ON pi.material_type_id = mt.id
    LEFT JOIN traceability_events te ON pi.id = te.packaging_item_id
    LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    WHERE pi.batch_number = ?
    GROUP BY pi.id
    ORDER BY pi.created_at DESC
  `;
  
  db.all(sql, [batchNumber], (err, items) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (items.length === 0) {
      return res.status(404).json({ error: 'No items found for this batch number' });
    }
    
    // Calculate batch statistics
    const batchStats = {
      batch_number: batchNumber,
      total_items: items.length,
      active_items: items.filter(item => item.status === 'active').length,
      retired_items: items.filter(item => item.status === 'retired').length,
      total_events: items.reduce((sum, item) => sum + item.total_events, 0),
      total_cycles: items.reduce((sum, item) => sum + item.total_cycles, 0),
      material_breakdown: items.reduce((acc, item) => {
        acc[item.material_name] = (acc[item.material_name] || 0) + 1;
        return acc;
      }, {})
    };
    
    res.json({
      success: true,
      data: {
        batch_statistics: batchStats,
        items: items
      }
    });
  });
});

// Track packaging fleet movements
router.get('/fleet/movements', (req, res) => {
  const { start_date, end_date, location, event_type } = req.query;
  
  let sql = `
    SELECT 
      te.*,
      pi.product_name,
      pi.batch_number,
      mt.name as material_name,
      mt.category
    FROM traceability_events te
    JOIN packaging_items pi ON te.packaging_item_id = pi.id
    JOIN material_types mt ON pi.material_type_id = mt.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (start_date) {
    sql += ' AND te.event_date >= ?';
    params.push(start_date);
  }
  
  if (end_date) {
    sql += ' AND te.event_date <= ?';
    params.push(end_date);
  }
  
  if (location) {
    sql += ' AND te.location LIKE ?';
    params.push(`%${location}%`);
  }
  
  if (event_type) {
    sql += ' AND te.event_type = ?';
    params.push(event_type);
  }
  
  sql += ' ORDER BY te.event_date DESC LIMIT 1000';
  
  db.all(sql, params, (err, movements) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Analyze movement patterns
    const analysis = {
      total_movements: movements.length,
      locations: [...new Set(movements.map(m => m.location))],
      event_types: movements.reduce((acc, m) => {
        acc[m.event_type] = (acc[m.event_type] || 0) + 1;
        return acc;
      }, {}),
      material_activity: movements.reduce((acc, m) => {
        acc[m.material_name] = (acc[m.material_name] || 0) + 1;
        return acc;
      }, {}),
      daily_activity: movements.reduce((acc, m) => {
        const date = m.event_date.split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {})
    };
    
    res.json({
      success: true,
      data: {
        movements: movements,
        analysis: analysis
      }
    });
  });
});

module.exports = router;