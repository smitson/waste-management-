const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Dashboard analytics - Key Performance Indicators
router.get('/dashboard', (req, res) => {
  const { period = 30 } = req.query;
  
  // Get overall statistics
  const statsSql = `
    SELECT 
      COUNT(DISTINCT pi.id) as total_items,
      COUNT(DISTINCT pi.manufacturer) as total_manufacturers,
      COUNT(DISTINCT pi.batch_number) as total_batches,
      COUNT(pc.id) as total_cycles,
      COUNT(te.id) as total_events,
      AVG(pc.condition_score) as avg_condition_score,
      SUM(CASE WHEN pi.status = 'active' THEN 1 ELSE 0 END) as active_items,
      SUM(CASE WHEN pi.status = 'retired' THEN 1 ELSE 0 END) as retired_items
    FROM packaging_items pi
    LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    LEFT JOIN traceability_events te ON pi.id = te.packaging_item_id
    WHERE pi.created_at >= date('now', '-' || ? || ' days')
  `;
  
  db.get(statsSql, [period], (err, stats) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Get material breakdown
    const materialSql = `
      SELECT 
        mt.name,
        mt.category,
        mt.recyclable,
        mt.biodegradable,
        COUNT(pi.id) as item_count,
        COUNT(pc.id) as cycle_count
      FROM material_types mt
      LEFT JOIN packaging_items pi ON mt.id = pi.material_type_id 
        AND pi.created_at >= date('now', '-' || ? || ' days')
      LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
      GROUP BY mt.id, mt.name, mt.category, mt.recyclable, mt.biodegradable
      HAVING item_count > 0
      ORDER BY item_count DESC
    `;
    
    db.all(materialSql, [period], (err, materials) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Get daily activity trend
      const trendSql = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as daily_items
        FROM packaging_items
        WHERE created_at >= date('now', '-' || ? || ' days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `;
      
      db.all(trendSql, [period], (err, trends) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Calculate KPIs
        const kpis = {
          total_items: stats.total_items || 0,
          reuse_rate: stats.total_items > 0 ? 
            ((stats.total_cycles || 0) / stats.total_items * 100).toFixed(2) + '%' : '0%',
          avg_condition_score: parseFloat(stats.avg_condition_score || 0).toFixed(2),
          active_items_percentage: stats.total_items > 0 ? 
            ((stats.active_items || 0) / stats.total_items * 100).toFixed(2) + '%' : '0%',
          traceability_coverage: stats.total_items > 0 ? 
            ((stats.total_events || 0) > 0 ? '100%' : '0%') : '0%',
          sustainability_score: calculateSustainabilityScore(materials)
        };
        
        res.json({
          success: true,
          data: {
            period_days: period,
            kpis: kpis,
            statistics: stats,
            material_breakdown: materials,
            activity_trend: trends
          }
        });
      });
    });
  });
});

// Environmental impact analytics
router.get('/environmental-impact', (req, res) => {
  const { period = 30 } = req.query;
  
  const impactSql = `
    SELECT 
      mt.name as material_name,
      mt.category,
      mt.recyclable,
      mt.biodegradable,
      COUNT(DISTINCT pi.id) as total_items,
      COUNT(pc.id) as total_cycles,
      SUM(pi.weight) as total_weight,
      AVG(pi.weight) as avg_weight_per_item
    FROM material_types mt
    JOIN packaging_items pi ON mt.id = pi.material_type_id
    LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    WHERE pi.created_at >= date('now', '-' || ? || ' days')
    GROUP BY mt.id, mt.name, mt.category, mt.recyclable, mt.biodegradable
    ORDER BY total_cycles DESC
  `;
  
  db.all(impactSql, [period], (err, materials) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Calculate environmental metrics
    const environmentalMetrics = materials.map(material => {
      const waste_prevented = (material.total_cycles || 0) * (material.avg_weight_per_item || 0.1);
      const co2_saved = (material.total_cycles || 0) * 0.5; // Estimated kg CO2 per cycle
      const recyclability_impact = material.recyclable ? 'High' : 'Low';
      const biodegradability_impact = material.biodegradable ? 'High' : 'Low';
      
      return {
        material_name: material.material_name,
        category: material.category,
        total_items: material.total_items,
        total_reuse_cycles: material.total_cycles || 0,
        waste_prevented_kg: waste_prevented.toFixed(2),
        co2_saved_kg: co2_saved.toFixed(2),
        recyclability_impact,
        biodegradability_impact,
        sustainability_rating: calculateMaterialSustainabilityRating(material)
      };
    });
    
    // Calculate totals
    const totals = environmentalMetrics.reduce((acc, material) => {
      acc.total_waste_prevented += parseFloat(material.waste_prevented_kg);
      acc.total_co2_saved += parseFloat(material.co2_saved_kg);
      acc.total_cycles += material.total_reuse_cycles;
      return acc;
    }, {
      total_waste_prevented: 0,
      total_co2_saved: 0,
      total_cycles: 0
    });
    
    res.json({
      success: true,
      data: {
        period_days: period,
        environmental_summary: {
          total_waste_prevented_kg: totals.total_waste_prevented.toFixed(2),
          total_co2_saved_kg: totals.total_co2_saved.toFixed(2),
          total_reuse_cycles: totals.total_cycles,
          estimated_trees_saved: (totals.total_co2_saved / 22).toFixed(1), // Rough estimate
          circular_economy_score: calculateCircularEconomyImpact(environmentalMetrics)
        },
        material_impact: environmentalMetrics
      }
    });
  });
});

// Circular packaging analytics
router.get('/circular-packaging', (req, res) => {
  const { material_type_id } = req.query;
  
  let sql = `
    SELECT 
      pi.id,
      pi.product_name,
      pi.manufacturer,
      mt.name as material_name,
      mt.category,
      pc.cycle_number,
      pc.start_date,
      pc.end_date,
      pc.reuse_type,
      pc.condition_score,
      JULIANDAY(pc.end_date) - JULIANDAY(pc.start_date) as cycle_duration_days
    FROM packaging_items pi
    JOIN material_types mt ON pi.material_type_id = mt.id
    JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (material_type_id) {
    sql += ' AND mt.id = ?';
    params.push(material_type_id);
  }
  
  sql += ' ORDER BY pi.id, pc.cycle_number';
  
  db.all(sql, params, (err, cycles) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Group by packaging item
    const itemCycles = cycles.reduce((acc, cycle) => {
      if (!acc[cycle.id]) {
        acc[cycle.id] = {
          item_info: {
            id: cycle.id,
            product_name: cycle.product_name,
            manufacturer: cycle.manufacturer,
            material_name: cycle.material_name,
            category: cycle.category
          },
          cycles: []
        };
      }
      acc[cycle.id].cycles.push(cycle);
      return acc;
    }, {});
    
    // Analyze circular performance
    const analysis = Object.values(itemCycles).map(item => {
      const cycles = item.cycles;
      const maxCycle = Math.max(...cycles.map(c => c.cycle_number));
      const avgCondition = cycles.reduce((sum, c) => sum + (c.condition_score || 0), 0) / cycles.length;
      const avgDuration = cycles.filter(c => c.cycle_duration_days)
        .reduce((sum, c) => sum + c.cycle_duration_days, 0) / cycles.filter(c => c.cycle_duration_days).length;
      
      const performance = {
        ...item.item_info,
        total_cycles: cycles.length,
        max_cycle_number: maxCycle,
        avg_condition_score: avgCondition.toFixed(2),
        avg_cycle_duration_days: avgDuration ? avgDuration.toFixed(1) : 'N/A',
        condition_trend: analyzeConditionTrend(cycles),
        circularity_score: calculateItemCircularityScore(cycles),
        reuse_types: [...new Set(cycles.map(c => c.reuse_type))]
      };
      
      return performance;
    });
    
    // Calculate overall circular packaging metrics
    const overallMetrics = {
      total_items_analyzed: analysis.length,
      avg_cycles_per_item: analysis.length > 0 ? 
        (analysis.reduce((sum, item) => sum + item.total_cycles, 0) / analysis.length).toFixed(2) : '0',
      best_performing_item: analysis.reduce((best, current) => 
        current.circularity_score > (best?.circularity_score || 0) ? current : best, null),
      condition_distribution: {
        excellent: analysis.filter(item => parseFloat(item.avg_condition_score) >= 8).length,
        good: analysis.filter(item => parseFloat(item.avg_condition_score) >= 6 && parseFloat(item.avg_condition_score) < 8).length,
        fair: analysis.filter(item => parseFloat(item.avg_condition_score) >= 4 && parseFloat(item.avg_condition_score) < 6).length,
        poor: analysis.filter(item => parseFloat(item.avg_condition_score) < 4).length
      }
    };
    
    res.json({
      success: true,
      data: {
        overall_metrics: overallMetrics,
        item_analysis: analysis
      }
    });
  });
});

// Predictive analytics for packaging lifecycle
router.get('/predictive/lifecycle', (req, res) => {
  const { packaging_item_id } = req.query;
  
  if (!packaging_item_id) {
    return res.status(400).json({ error: 'Packaging item ID is required' });
  }
  
  // Get item history
  const historySql = `
    SELECT 
      pi.*,
      mt.name as material_name,
      mt.category,
      pc.cycle_number,
      pc.condition_score,
      pc.start_date,
      pc.end_date,
      JULIANDAY(pc.end_date) - JULIANDAY(pc.start_date) as cycle_duration
    FROM packaging_items pi
    JOIN material_types mt ON pi.material_type_id = mt.id
    LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    WHERE pi.id = ?
    ORDER BY pc.cycle_number
  `;
  
  db.all(historySql, [packaging_item_id], (err, history) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    if (history.length === 0) {
      return res.status(404).json({ error: 'Packaging item not found' });
    }
    
    const item = history[0];
    const cycles = history.filter(h => h.cycle_number !== null);
    
    // Predictive analysis
    const predictions = {
      item_info: {
        id: item.id,
        product_name: item.product_name,
        material_name: item.material_name,
        category: item.category,
        current_status: item.status
      },
      lifecycle_analysis: {
        current_cycles: cycles.length,
        avg_condition_degradation: calculateConditionDegradation(cycles),
        estimated_remaining_cycles: estimateRemainingCycles(cycles),
        predicted_retirement_date: predictRetirementDate(cycles),
        condition_forecast: generateConditionForecast(cycles)
      },
      recommendations: generateLifecycleRecommendations(item, cycles),
      risk_assessment: assessLifecycleRisks(cycles)
    };
    
    res.json({
      success: true,
      data: predictions
    });
  });
});

// Helper functions
function calculateSustainabilityScore(materials) {
  if (!materials || materials.length === 0) return 0;
  
  const scores = materials.map(material => {
    let score = 0;
    if (material.recyclable) score += 30;
    if (material.biodegradable) score += 25;
    if (material.cycle_count > 0) score += 20;
    if (material.category === 'Biodegradable') score += 15;
    if (material.category === 'Paper') score += 10;
    return Math.min(score, 100);
  });
  
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}

function calculateMaterialSustainabilityRating(material) {
  let score = 0;
  if (material.recyclable) score += 3;
  if (material.biodegradable) score += 3;
  if ((material.total_cycles || 0) > 0) score += 2;
  if (material.category === 'Biodegradable') score += 2;
  
  if (score >= 8) return 'Excellent';
  if (score >= 6) return 'Good';
  if (score >= 4) return 'Fair';
  return 'Poor';
}

function calculateCircularEconomyImpact(metrics) {
  const totalCycles = metrics.reduce((sum, m) => sum + m.total_reuse_cycles, 0);
  const excellentRating = metrics.filter(m => m.sustainability_rating === 'Excellent').length;
  const goodRating = metrics.filter(m => m.sustainability_rating === 'Good').length;
  
  const cycleScore = Math.min(totalCycles / 100 * 50, 50);
  const qualityScore = (excellentRating * 3 + goodRating * 2) / metrics.length * 50;
  
  return Math.round(cycleScore + qualityScore);
}

function analyzeConditionTrend(cycles) {
  if (cycles.length < 2) return 'insufficient_data';
  
  const conditions = cycles.map(c => c.condition_score).filter(c => c !== null);
  if (conditions.length < 2) return 'insufficient_data';
  
  const first = conditions[0];
  const last = conditions[conditions.length - 1];
  const difference = last - first;
  
  if (Math.abs(difference) < 0.5) return 'stable';
  return difference > 0 ? 'improving' : 'degrading';
}

function calculateItemCircularityScore(cycles) {
  if (cycles.length === 0) return 0;
  
  const cycleScore = Math.min(cycles.length * 10, 40);
  const avgCondition = cycles.reduce((sum, c) => sum + (c.condition_score || 0), 0) / cycles.length;
  const conditionScore = (avgCondition / 10) * 40;
  const completionRate = cycles.filter(c => c.end_date).length / cycles.length;
  const completionScore = completionRate * 20;
  
  return Math.round(cycleScore + conditionScore + completionScore);
}

function calculateConditionDegradation(cycles) {
  if (cycles.length < 2) return 0;
  
  const conditions = cycles.map(c => c.condition_score).filter(c => c !== null);
  if (conditions.length < 2) return 0;
  
  return ((conditions[0] - conditions[conditions.length - 1]) / cycles.length).toFixed(2);
}

function estimateRemainingCycles(cycles) {
  if (cycles.length === 0) return 'unknown';
  
  const avgCondition = cycles.reduce((sum, c) => sum + (c.condition_score || 0), 0) / cycles.length;
  const degradationRate = calculateConditionDegradation(cycles);
  
  if (degradationRate <= 0) return '10+';
  
  const remaining = Math.floor((avgCondition - 2) / degradationRate); // Assuming minimum usable condition is 2
  return Math.max(0, remaining);
}

function predictRetirementDate(cycles) {
  const remainingCycles = estimateRemainingCycles(cycles);
  if (remainingCycles === 'unknown' || remainingCycles === '10+') return 'undetermined';
  
  const avgCycleDuration = cycles.filter(c => c.cycle_duration)
    .reduce((sum, c) => sum + c.cycle_duration, 0) / cycles.filter(c => c.cycle_duration).length;
  
  if (!avgCycleDuration) return 'undetermined';
  
  const daysUntilRetirement = remainingCycles * avgCycleDuration;
  const retirementDate = new Date();
  retirementDate.setDate(retirementDate.getDate() + daysUntilRetirement);
  
  return retirementDate.toISOString().split('T')[0];
}

function generateConditionForecast(cycles) {
  if (cycles.length < 2) return [];
  
  const degradationRate = parseFloat(calculateConditionDegradation(cycles));
  const lastCondition = cycles[cycles.length - 1]?.condition_score || 5;
  
  const forecast = [];
  for (let i = 1; i <= 5; i++) {
    const predictedCondition = Math.max(0, lastCondition - (degradationRate * i));
    forecast.push({
      cycle: cycles.length + i,
      predicted_condition: predictedCondition.toFixed(2),
      confidence: Math.max(0.9 - (i * 0.1), 0.5).toFixed(2)
    });
  }
  
  return forecast;
}

function generateLifecycleRecommendations(item, cycles) {
  const recommendations = [];
  
  if (cycles.length === 0) {
    recommendations.push({
      type: 'initiation',
      priority: 'high',
      message: 'Start tracking reuse cycles to maximize circular value'
    });
    return recommendations;
  }
  
  const avgCondition = cycles.reduce((sum, c) => sum + (c.condition_score || 0), 0) / cycles.length;
  const degradationRate = parseFloat(calculateConditionDegradation(cycles));
  
  if (avgCondition < 4) {
    recommendations.push({
      type: 'maintenance',
      priority: 'high',
      message: 'Consider refurbishment or quality improvement measures'
    });
  }
  
  if (degradationRate > 1) {
    recommendations.push({
      type: 'optimization',
      priority: 'medium',
      message: 'High degradation rate detected - review handling procedures'
    });
  }
  
  if (cycles.length > 5 && avgCondition > 7) {
    recommendations.push({
      type: 'performance',
      priority: 'low',
      message: 'Excellent circular performance - consider as best practice example'
    });
  }
  
  return recommendations;
}

function assessLifecycleRisks(cycles) {
  const risks = [];
  
  if (cycles.length === 0) {
    risks.push({
      risk_type: 'underutilization',
      severity: 'medium',
      description: 'No reuse cycles recorded - potential waste of circular value'
    });
  }
  
  const avgCondition = cycles.reduce((sum, c) => sum + (c.condition_score || 0), 0) / cycles.length;
  
  if (avgCondition < 3) {
    risks.push({
      risk_type: 'quality_degradation',
      severity: 'high',
      description: 'Low condition scores indicate potential quality issues'
    });
  }
  
  const incompleteCycles = cycles.filter(c => !c.end_date).length;
  if (incompleteCycles > 0) {
    risks.push({
      risk_type: 'tracking_gaps',
      severity: 'medium',
      description: `${incompleteCycles} incomplete cycle(s) - potential traceability issues`
    });
  }
  
  return risks;
}

module.exports = router;