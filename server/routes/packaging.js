// Compare multiple packaging items side-by-side (cost, carbon, material, EPR, PPT)
router.post('/compare', (req, res) => {
  const { packagingIds } = req.body;
  if (!packagingIds || !Array.isArray(packagingIds) || packagingIds.length < 2) {
    return res.status(400).json({ error: 'Please provide at least 2 packaging IDs for comparison' });
  }

  const placeholders = packagingIds.map(() => '?').join(',');
  const sql = `
    SELECT pi.*, mt.name as material_name, mt.category, mt.recyclable, mt.biodegradable
    FROM packaging_items pi
    JOIN material_types mt ON pi.material_type_id = mt.id
    WHERE pi.id IN (${placeholders})
  `;

  db.all(sql, packagingIds, (err, items) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (items.length < 2) {
      return res.status(400).json({ error: 'Not enough valid packaging items found for comparison' });
    }

    // Example: EPR and PPT rates (could be dynamic/configurable)
    const EPR_RATE = 0.15; // £/kg (example)
    const PPT_RATE = 0.20; // £/kg (example)
    const CO2_PER_KG = 2.5; // kg CO2 per kg packaging (example)

    const comparison = items.map(item => {
      const weight = parseFloat(item.weight) || 0.1;
      const cost = parseFloat(item.cost) || 0; // Add 'cost' to schema if not present
      const epr_cost = weight * EPR_RATE;
      const ppt_cost = weight * PPT_RATE;
      const carbon_emissions = weight * CO2_PER_KG;
      return {
        id: item.id,
        product_name: item.product_name,
        manufacturer: item.manufacturer,
        material: item.material_name,
        category: item.category,
        recyclable: !!item.recyclable,
        biodegradable: !!item.biodegradable,
        weight_kg: weight,
        cost_gbp: cost,
        epr_cost_gbp: epr_cost,
        ppt_cost_gbp: ppt_cost,
        carbon_emissions_kg: carbon_emissions
      };
    });

    res.json({
      success: true,
      data: {
        comparison,
        summary: {
          total_items: comparison.length,
          total_cost_gbp: comparison.reduce((sum, i) => sum + i.cost_gbp, 0),
          total_epr_gbp: comparison.reduce((sum, i) => sum + i.epr_cost_gbp, 0),
          total_ppt_gbp: comparison.reduce((sum, i) => sum + i.ppt_cost_gbp, 0),
          total_carbon_kg: comparison.reduce((sum, i) => sum + i.carbon_emissions_kg, 0)
        }
      }
    });
  });
});
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

// Create new packaging item
router.post('/', (req, res) => {
  const {
    material_type_id,
    manufacturer,
    product_name,
    batch_number,
    production_date,
    expiry_date,
    weight,
    dimensions,
    location
  } = req.body;
  
  if (!material_type_id || !product_name || !manufacturer) {
    return res.status(400).json({ 
      error: 'Material type ID, product name, and manufacturer are required' 
    });
  }
  
  const id = uuidv4();
  const sql = `
    INSERT INTO packaging_items 
    (id, material_type_id, manufacturer, product_name, batch_number, 
     production_date, expiry_date, weight, dimensions, location)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  db.run(sql, [
    id, material_type_id, manufacturer, product_name, batch_number,
    production_date, expiry_date, weight, dimensions, location
  ], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Add creation event to traceability
    const eventSql = `
      INSERT INTO traceability_events 
      (packaging_item_id, event_type, location, operator, details)
      VALUES (?, 'created', ?, ?, ?)
    `;
    
    db.run(eventSql, [
      id, location || 'factory', manufacturer, 
      `New ${product_name} created by ${manufacturer}`
    ], (eventErr) => {
      if (eventErr) {
        console.error('Error creating traceability event:', eventErr.message);
      }
    });
    
    res.status(201).json({
      success: true,
      data: {
        id,
        material_type_id,
        manufacturer,
        product_name,
        batch_number,
        production_date,
        expiry_date,
        weight,
        dimensions,
        location,
        status: 'active'
      }
    });
  });
});

// Get all packaging items with filters
router.get('/', (req, res) => {
  const { 
    material_type, 
    status, 
    manufacturer, 
    batch_number, 
    limit = 100, 
    offset = 0 
  } = req.query;
  
  let sql = `
    SELECT 
      pi.*,
      mt.name as material_name,
      mt.category as material_category,
      COUNT(pc.id) as total_cycles,
      MAX(pc.cycle_number) as max_cycle_number
    FROM packaging_items pi
    JOIN material_types mt ON pi.material_type_id = mt.id
    LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (material_type) {
    sql += ' AND mt.name LIKE ?';
    params.push(`%${material_type}%`);
  }
  
  if (status) {
    sql += ' AND pi.status = ?';
    params.push(status);
  }
  
  if (manufacturer) {
    sql += ' AND pi.manufacturer LIKE ?';
    params.push(`%${manufacturer}%`);
  }
  
  if (batch_number) {
    sql += ' AND pi.batch_number = ?';
    params.push(batch_number);
  }
  
  sql += ' GROUP BY pi.id ORDER BY pi.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));
  
  db.all(sql, params, (err, rows) => {
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

// Get packaging item by ID
router.get('/:id', (req, res) => {
  const sql = `
    SELECT 
      pi.*,
      mt.name as material_name,
      mt.category as material_category,
      mt.recyclable,
      mt.biodegradable,
      mt.uk_waste_code
    FROM packaging_items pi
    JOIN material_types mt ON pi.material_type_id = mt.id
    WHERE pi.id = ?
  `;
  
  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Packaging item not found' });
    }
    res.json({
      success: true,
      data: row
    });
  });
});

// Start new reuse cycle
router.post('/:id/cycles', (req, res) => {
  const packageId = req.params.id;
  const { reuse_type, condition_score, notes } = req.body;
  
  if (!reuse_type || condition_score === undefined) {
    return res.status(400).json({ 
      error: 'Reuse type and condition score are required' 
    });
  }
  
  // Get current cycle number
  const getCurrentCycleSql = `
    SELECT MAX(cycle_number) as max_cycle 
    FROM packaging_cycles 
    WHERE packaging_item_id = ?
  `;
  
  db.get(getCurrentCycleSql, [packageId], (err, result) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const nextCycleNumber = (result.max_cycle || 0) + 1;
    
    const sql = `
      INSERT INTO packaging_cycles 
      (packaging_item_id, cycle_number, start_date, reuse_type, condition_score, notes)
      VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
    `;
    
    db.run(sql, [packageId, nextCycleNumber, reuse_type, condition_score, notes], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Add traceability event
      const eventSql = `
        INSERT INTO traceability_events 
        (packaging_item_id, event_type, location, operator, details)
        VALUES (?, 'reuse_cycle_start', ?, 'system', ?)
      `;
      
      db.run(eventSql, [
        packageId, 
        'reuse_facility', 
        `Started reuse cycle ${nextCycleNumber} - ${reuse_type} (condition: ${condition_score}/10)`
      ]);
      
      res.status(201).json({
        success: true,
        data: {
          id: this.lastID,
          packaging_item_id: packageId,
          cycle_number: nextCycleNumber,
          reuse_type,
          condition_score,
          notes,
          start_date: new Date().toISOString()
        }
      });
    });
  });
});

// End reuse cycle
router.put('/:id/cycles/:cycleId/end', (req, res) => {
  const { cycleId } = req.params;
  const { condition_score, notes } = req.body;
  
  const sql = `
    UPDATE packaging_cycles 
    SET end_date = CURRENT_TIMESTAMP, condition_score = ?, notes = ?
    WHERE id = ?
  `;
  
  db.run(sql, [condition_score, notes, cycleId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cycle not found' });
    }
    
    res.json({
      success: true,
      message: 'Reuse cycle ended successfully'
    });
  });
});

// Get circular packaging performance
router.get('/:id/performance', (req, res) => {
  const packageId = req.params.id;
  
  const sql = `
    SELECT 
      pi.*,
      mt.name as material_name,
      COUNT(pc.id) as total_cycles,
      AVG(pc.condition_score) as avg_condition_score,
      MAX(pc.cycle_number) as max_cycle_number,
      MIN(pc.start_date) as first_reuse_date,
      MAX(pc.end_date) as last_reuse_date,
      SUM(CASE WHEN pc.end_date IS NULL THEN 1 ELSE 0 END) as active_cycles
    FROM packaging_items pi
    JOIN material_types mt ON pi.material_type_id = mt.id
    LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    WHERE pi.id = ?
    GROUP BY pi.id
  `;
  
  db.get(sql, [packageId], (err, item) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (!item) {
      return res.status(404).json({ error: 'Packaging item not found' });
    }
    
    // Get cycle details
    const cyclesSql = `
      SELECT * FROM packaging_cycles 
      WHERE packaging_item_id = ?
      ORDER BY cycle_number DESC
    `;
    
    db.all(cyclesSql, [packageId], (err, cycles) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Calculate performance metrics
      const performance = {
        item_info: {
          id: item.id,
          product_name: item.product_name,
          material_name: item.material_name,
          created_at: item.created_at
        },
        circular_metrics: {
          total_reuse_cycles: item.total_cycles || 0,
          average_condition_score: parseFloat(item.avg_condition_score || 0).toFixed(2),
          max_cycle_achieved: item.max_cycle_number || 0,
          active_cycles: item.active_cycles || 0,
          reuse_efficiency: item.total_cycles > 0 ? 
            (item.avg_condition_score / 10 * 100).toFixed(2) + '%' : 'N/A'
        },
        sustainability_impact: {
          estimated_co2_saved: (item.total_cycles || 0) * 0.5, // kg CO2 per cycle
          estimated_waste_prevented: (item.total_cycles || 0) * (item.weight || 0.1), // kg
          circularity_score: calculateCircularityScore(item, cycles)
        },
        cycle_history: cycles
      };
      
      res.json({
        success: true,
        data: performance
      });
    });
  });
});

// Compare single-use vs reuse analysis
router.get('/analysis/single-use-vs-reuse', (req, res) => {
  const { material_type_id, time_period = 30 } = req.query;
  
  let materialFilter = '';
  const params = [time_period];
  
  if (material_type_id) {
    materialFilter = 'AND pi.material_type_id = ?';
    params.push(material_type_id);
  }
  
  const sql = `
    SELECT 
      mt.name as material_name,
      mt.category,
      COUNT(DISTINCT pi.id) as total_items,
      COUNT(pc.id) as total_cycles,
      AVG(pc.condition_score) as avg_condition_score,
      SUM(CASE WHEN pc.id IS NULL THEN 1 ELSE 0 END) as single_use_items,
      SUM(CASE WHEN pc.id IS NOT NULL THEN 1 ELSE 0 END) as reused_items,
      AVG(pi.weight) as avg_weight
    FROM packaging_items pi
    JOIN material_types mt ON pi.material_type_id = mt.id
    LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    WHERE pi.created_at >= date('now', '-' || ? || ' days') ${materialFilter}
    GROUP BY mt.id, mt.name, mt.category
    ORDER BY total_items DESC
  `;
  
  db.all(sql, params, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const analysis = results.map(material => {
      const reuse_rate = material.total_items > 0 ? 
        (material.reused_items / material.total_items * 100).toFixed(2) : '0.00';
      
      const avg_cycles_per_item = material.reused_items > 0 ? 
        (material.total_cycles / material.reused_items).toFixed(2) : '0.00';
      
      const environmental_impact = {
        single_use_waste: material.single_use_items * (material.avg_weight || 0.1),
        reuse_waste_saved: material.total_cycles * (material.avg_weight || 0.1),
        co2_reduction: material.total_cycles * 0.5
      };
      
      return {
        material_name: material.material_name,
        category: material.category,
        total_items: material.total_items,
        single_use_items: material.single_use_items,
        reused_items: material.reused_items,
        reuse_rate: reuse_rate + '%',
        total_reuse_cycles: material.total_cycles,
        avg_cycles_per_item: avg_cycles_per_item,
        avg_condition_score: parseFloat(material.avg_condition_score || 0).toFixed(2),
        environmental_impact
      };
    });
    
    // Calculate overall summary
    const totals = analysis.reduce((acc, material) => {
      acc.total_items += material.total_items;
      acc.single_use_items += material.single_use_items;
      acc.reused_items += material.reused_items;
      acc.total_cycles += material.total_reuse_cycles;
      acc.waste_saved += material.environmental_impact.reuse_waste_saved;
      acc.co2_saved += material.environmental_impact.co2_reduction;
      return acc;
    }, {
      total_items: 0,
      single_use_items: 0,
      reused_items: 0,
      total_cycles: 0,
      waste_saved: 0,
      co2_saved: 0
    });
    
    const overall_reuse_rate = totals.total_items > 0 ? 
      (totals.reused_items / totals.total_items * 100).toFixed(2) : '0.00';
    
    res.json({
      success: true,
      data: {
        time_period_days: time_period,
        summary: {
          ...totals,
          overall_reuse_rate: overall_reuse_rate + '%',
          avg_cycles_per_reused_item: totals.reused_items > 0 ? 
            (totals.total_cycles / totals.reused_items).toFixed(2) : '0.00'
        },
        material_breakdown: analysis
      }
    });
  });
});

// Helper function to calculate circularity score
function calculateCircularityScore(item, cycles) {
  if (!cycles || cycles.length === 0) return 0;
  
  const maxCycles = cycles.length;
  const avgCondition = cycles.reduce((sum, cycle) => sum + (cycle.condition_score || 0), 0) / cycles.length;
  const completedCycles = cycles.filter(cycle => cycle.end_date).length;
  
  // Score based on number of cycles (40%), condition maintenance (40%), completion rate (20%)
  const cycleScore = Math.min(maxCycles / 10 * 40, 40); // Max 10 cycles for full score
  const conditionScore = (avgCondition / 10) * 40;
  const completionScore = cycles.length > 0 ? (completedCycles / cycles.length) * 20 : 0;
  
  return Math.round(cycleScore + conditionScore + completionScore);
}

module.exports = router;