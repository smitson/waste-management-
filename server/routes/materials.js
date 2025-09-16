const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all material types
router.get('/', (req, res) => {
  const sql = `SELECT * FROM material_types ORDER BY category, name`;
  
  db.all(sql, [], (err, rows) => {
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

// Get material type by ID
router.get('/:id', (req, res) => {
  const sql = `SELECT * FROM material_types WHERE id = ?`;
  
  db.get(sql, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Material type not found' });
    }
    res.json({
      success: true,
      data: row
    });
  });
});

// Compare material types (Insight Tools feature)
router.post('/compare', (req, res) => {
  const { materialIds } = req.body;
  
  if (!materialIds || !Array.isArray(materialIds) || materialIds.length < 2) {
    return res.status(400).json({ 
      error: 'Please provide at least 2 material IDs for comparison' 
    });
  }
  
  const placeholders = materialIds.map(() => '?').join(',');
  const sql = `SELECT * FROM material_types WHERE id IN (${placeholders})`;
  
  db.all(sql, materialIds, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (rows.length < 2) {
      return res.status(400).json({ 
        error: 'Not enough valid material types found for comparison' 
      });
    }
    
    // Generate comparison analysis
    const comparison = {
      materials: rows,
      analysis: {
        recyclability: {
          recyclable_count: rows.filter(m => m.recyclable).length,
          non_recyclable_count: rows.filter(m => !m.recyclable).length
        },
        biodegradability: {
          biodegradable_count: rows.filter(m => m.biodegradable).length,
          non_biodegradable_count: rows.filter(m => !m.biodegradable).length
        },
        categories: [...new Set(rows.map(m => m.category))],
        sustainability_score: calculateSustainabilityScore(rows)
      },
      recommendations: generateRecommendations(rows)
    };
    
    res.json({
      success: true,
      data: comparison
    });
  });
});

// Get lifecycle data for material types
router.get('/:id/lifecycle', (req, res) => {
  const materialId = req.params.id;
  
  // Get packaging items of this material type
  const sql = `
    SELECT 
      pi.*,
      COUNT(pc.id) as reuse_cycles,
      AVG(pc.condition_score) as avg_condition_score,
      MAX(pc.cycle_number) as max_cycles
    FROM packaging_items pi
    LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    WHERE pi.material_type_id = ?
    GROUP BY pi.id
    ORDER BY pi.created_at DESC
  `;
  
  db.all(sql, [materialId], (err, items) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Calculate lifecycle statistics
    const lifecycleData = {
      total_items: items.length,
      total_reuse_cycles: items.reduce((sum, item) => sum + (item.reuse_cycles || 0), 0),
      average_cycles_per_item: items.length > 0 ? 
        items.reduce((sum, item) => sum + (item.reuse_cycles || 0), 0) / items.length : 0,
      average_condition_score: items.length > 0 ?
        items.reduce((sum, item) => sum + (item.avg_condition_score || 0), 0) / items.length : 0,
      items: items
    };
    
    res.json({
      success: true,
      data: lifecycleData
    });
  });
});

// Helper functions
function calculateSustainabilityScore(materials) {
  let score = 0;
  materials.forEach(material => {
    if (material.recyclable) score += 30;
    if (material.biodegradable) score += 40;
    if (material.category === 'Biodegradable') score += 20;
    if (material.category === 'Paper') score += 10;
  });
  return Math.min(100, score / materials.length);
}

function generateRecommendations(materials) {
  const recommendations = [];
  
  const nonRecyclable = materials.filter(m => !m.recyclable);
  const nonBiodegradable = materials.filter(m => !m.biodegradable);
  
  if (nonRecyclable.length > 0) {
    recommendations.push({
      type: 'sustainability',
      priority: 'high',
      message: `Consider replacing ${nonRecyclable.map(m => m.name).join(', ')} with recyclable alternatives`
    });
  }
  
  if (nonBiodegradable.length > 0) {
    recommendations.push({
      type: 'environmental',
      priority: 'medium',
      message: `Consider biodegradable options for ${nonBiodegradable.map(m => m.name).join(', ')}`
    });
  }
  
  const plastics = materials.filter(m => m.category === 'Plastic');
  if (plastics.length > 0) {
    recommendations.push({
      type: 'circular_economy',
      priority: 'medium',
      message: 'Plastic materials have good reuse potential - consider implementing circular packaging schemes'
    });
  }
  
  return recommendations;
}

module.exports = router;