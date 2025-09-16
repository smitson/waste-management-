const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Generate comprehensive waste management report
router.get('/comprehensive', (req, res) => {
  const { start_date, end_date, format = 'json' } = req.query;
  
  const dateFilter = start_date && end_date ? 
    `WHERE pi.created_at BETWEEN '${start_date}' AND '${end_date}'` : 
    `WHERE pi.created_at >= date('now', '-30 days')`;
  
  // Main report query
  const reportSql = `
    SELECT 
      mt.name as material_name,
      mt.category,
      mt.recyclable,
      mt.biodegradable,
      mt.uk_waste_code,
      COUNT(DISTINCT pi.id) as total_items,
      COUNT(pc.id) as total_reuse_cycles,
      AVG(pc.condition_score) as avg_condition_score,
      SUM(CASE WHEN pi.status = 'active' THEN 1 ELSE 0 END) as active_items,
      SUM(CASE WHEN pi.status = 'retired' THEN 1 ELSE 0 END) as retired_items,
      AVG(pi.weight) as avg_weight,
      COUNT(DISTINCT pi.manufacturer) as unique_manufacturers,
      COUNT(DISTINCT pi.batch_number) as unique_batches
    FROM material_types mt
    LEFT JOIN packaging_items pi ON mt.id = pi.material_type_id ${dateFilter.replace('WHERE', 'AND')}
    LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    GROUP BY mt.id, mt.name, mt.category, mt.recyclable, mt.biodegradable, mt.uk_waste_code
    ORDER BY total_items DESC
  `;
  
  db.all(reportSql, [], (err, materialData) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Get compliance statistics
    const complianceSql = `
      SELECT 
        regulation_type,
        compliance_status,
        COUNT(*) as count
      FROM uk_compliance_records ucr
      JOIN packaging_items pi ON ucr.packaging_item_id = pi.id
      ${dateFilter}
      GROUP BY regulation_type, compliance_status
    `;
    
    db.all(complianceSql, [], (err, complianceData) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Get traceability statistics
      const traceabilitySql = `
        SELECT 
          event_type,
          COUNT(*) as event_count,
          COUNT(DISTINCT packaging_item_id) as items_affected
        FROM traceability_events te
        JOIN packaging_items pi ON te.packaging_item_id = pi.id
        ${dateFilter}
        GROUP BY event_type
        ORDER BY event_count DESC
      `;
      
      db.all(traceabilitySql, [], (err, traceabilityData) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        
        // Calculate totals and KPIs
        const totals = materialData.reduce((acc, material) => {
          acc.total_items += material.total_items || 0;
          acc.total_cycles += material.total_reuse_cycles || 0;
          acc.recyclable_items += material.recyclable ? (material.total_items || 0) : 0;
          acc.biodegradable_items += material.biodegradable ? (material.total_items || 0) : 0;
          acc.active_items += material.active_items || 0;
          acc.retired_items += material.retired_items || 0;
          return acc;
        }, {
          total_items: 0,
          total_cycles: 0,
          recyclable_items: 0,
          biodegradable_items: 0,
          active_items: 0,
          retired_items: 0
        });
        
        const report = {
          report_metadata: {
            generated_at: new Date().toISOString(),
            period: {
              start_date: start_date || 'last_30_days',
              end_date: end_date || 'today'
            },
            report_type: 'comprehensive_waste_management'
          },
          executive_summary: {
            total_packaging_items: totals.total_items,
            total_reuse_cycles: totals.total_cycles,
            active_items: totals.active_items,
            retired_items: totals.retired_items,
            recyclability_rate: totals.total_items > 0 ? 
              (totals.recyclable_items / totals.total_items * 100).toFixed(2) + '%' : '0%',
            biodegradability_rate: totals.total_items > 0 ? 
              (totals.biodegradable_items / totals.total_items * 100).toFixed(2) + '%' : '0%',
            reuse_efficiency: totals.total_items > 0 ? 
              (totals.total_cycles / totals.total_items).toFixed(2) + ' cycles/item' : '0 cycles/item'
          },
          material_analysis: materialData,
          compliance_status: complianceData,
          traceability_events: traceabilityData,
          sustainability_metrics: {
            estimated_waste_diverted: totals.total_cycles * 0.1, // kg
            estimated_co2_saved: totals.total_cycles * 0.5, // kg CO2
            circular_economy_score: calculateCircularEconomyScore(materialData)
          }
        };
        
        if (format === 'csv') {
          // Convert to CSV format
          const csv = convertReportToCSV(report);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', 'attachment; filename=waste_management_report.csv');
          res.send(csv);
        } else {
          res.json({
            success: true,
            data: report
          });
        }
      });
    });
  });
});

// UK compliance report
router.get('/compliance', (req, res) => {
  const { regulation_type } = req.query;
  
  let sql = `
    SELECT 
      ucr.*,
      pi.product_name,
      pi.manufacturer,
      pi.batch_number,
      mt.name as material_name,
      mt.uk_waste_code
    FROM uk_compliance_records ucr
    JOIN packaging_items pi ON ucr.packaging_item_id = pi.id
    JOIN material_types mt ON pi.material_type_id = mt.id
    WHERE 1=1
  `;
  
  const params = [];
  
  if (regulation_type) {
    sql += ' AND ucr.regulation_type = ?';
    params.push(regulation_type);
  }
  
  sql += ' ORDER BY ucr.assessment_date DESC';
  
  db.all(sql, params, (err, records) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Calculate compliance statistics
    const stats = {
      total_assessments: records.length,
      compliance_breakdown: records.reduce((acc, record) => {
        acc[record.compliance_status] = (acc[record.compliance_status] || 0) + 1;
        return acc;
      }, {}),
      regulation_breakdown: records.reduce((acc, record) => {
        acc[record.regulation_type] = (acc[record.regulation_type] || 0) + 1;
        return acc;
      }, {}),
      material_compliance: records.reduce((acc, record) => {
        const key = record.material_name;
        if (!acc[key]) {
          acc[key] = { compliant: 0, non_compliant: 0, pending: 0 };
        }
        if (record.compliance_status === 'compliant') acc[key].compliant++;
        else if (record.compliance_status === 'non_compliant') acc[key].non_compliant++;
        else acc[key].pending++;
        return acc;
      }, {})
    };
    
    res.json({
      success: true,
      data: {
        compliance_statistics: stats,
        detailed_records: records
      }
    });
  });
});

// Performance metrics report
router.get('/performance', (req, res) => {
  const { metric_type, period = 30 } = req.query;
  
  let sql = `
    SELECT 
      pm.*,
      DATE(pm.created_at) as report_date
    FROM performance_metrics pm
    WHERE pm.created_at >= date('now', '-' || ? || ' days')
  `;
  
  const params = [period];
  
  if (metric_type) {
    sql += ' AND pm.metric_type = ?';
    params.push(metric_type);
  }
  
  sql += ' ORDER BY pm.created_at DESC';
  
  db.all(sql, params, (err, metrics) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    // Calculate additional performance data
    const performanceSql = `
      SELECT 
        COUNT(DISTINCT pi.id) as total_items,
        COUNT(pc.id) as total_cycles,
        AVG(pc.condition_score) as avg_condition,
        COUNT(DISTINCT te.packaging_item_id) as items_with_events,
        COUNT(te.id) as total_events
      FROM packaging_items pi
      LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
      LEFT JOIN traceability_events te ON pi.id = te.packaging_item_id
      WHERE pi.created_at >= date('now', '-' || ? || ' days')
    `;
    
    db.get(performanceSql, [period], (err, performance) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      
      // Group metrics by type and calculate trends
      const metricsByType = metrics.reduce((acc, metric) => {
        if (!acc[metric.metric_type]) {
          acc[metric.metric_type] = [];
        }
        acc[metric.metric_type].push(metric);
        return acc;
      }, {});
      
      const trends = Object.keys(metricsByType).map(type => {
        const typeMetrics = metricsByType[type];
        const values = typeMetrics.map(m => m.metric_value);
        const trend = values.length > 1 ? 
          (values[0] - values[values.length - 1]) > 0 ? 'improving' : 'declining' : 'stable';
        
        return {
          metric_type: type,
          current_value: values[0] || 0,
          trend: trend,
          data_points: typeMetrics.length,
          avg_value: values.reduce((sum, val) => sum + val, 0) / values.length
        };
      });
      
      const performanceReport = {
        period_days: period,
        current_performance: performance,
        kpis: {
          reuse_rate: performance.total_items > 0 ? 
            (performance.total_cycles / performance.total_items * 100).toFixed(2) + '%' : '0%',
          traceability_coverage: performance.total_items > 0 ? 
            (performance.items_with_events / performance.total_items * 100).toFixed(2) + '%' : '0%',
          avg_condition_score: parseFloat(performance.avg_condition || 0).toFixed(2),
          events_per_item: performance.total_items > 0 ? 
            (performance.total_events / performance.total_items).toFixed(2) : '0'
        },
        metric_trends: trends,
        detailed_metrics: metrics
      };
      
      res.json({
        success: true,
        data: performanceReport
      });
    });
  });
});

// Custom report builder
router.post('/custom', (req, res) => {
  const { 
    report_name,
    date_range,
    material_types,
    metrics,
    grouping,
    filters 
  } = req.body;
  
  if (!report_name || !metrics || !Array.isArray(metrics)) {
    return res.status(400).json({ 
      error: 'Report name and metrics array are required' 
    });
  }
  
  // Build dynamic query based on requested metrics
  let baseQuery = `
    SELECT 
      pi.id,
      pi.product_name,
      pi.manufacturer,
      pi.batch_number,
      pi.status,
      pi.created_at,
      mt.name as material_name,
      mt.category as material_category
  `;
  
  let joins = `
    FROM packaging_items pi
    JOIN material_types mt ON pi.material_type_id = mt.id
  `;
  
  let conditions = ['1=1'];
  let params = [];
  
  // Add metric-specific fields and joins
  if (metrics.includes('reuse_cycles')) {
    baseQuery += `, COUNT(pc.id) as reuse_cycles, AVG(pc.condition_score) as avg_condition`;
    joins += ` LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id`;
  }
  
  if (metrics.includes('traceability_events')) {
    baseQuery += `, COUNT(te.id) as total_events`;
    joins += ` LEFT JOIN traceability_events te ON pi.id = te.packaging_item_id`;
  }
  
  if (metrics.includes('compliance')) {
    baseQuery += `, ucr.compliance_status, ucr.regulation_type`;
    joins += ` LEFT JOIN uk_compliance_records ucr ON pi.id = ucr.packaging_item_id`;
  }
  
  // Apply filters
  if (date_range && date_range.start && date_range.end) {
    conditions.push('pi.created_at BETWEEN ? AND ?');
    params.push(date_range.start, date_range.end);
  }
  
  if (material_types && Array.isArray(material_types) && material_types.length > 0) {
    const placeholders = material_types.map(() => '?').join(',');
    conditions.push(`mt.id IN (${placeholders})`);
    params.push(...material_types);
  }
  
  if (filters) {
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== '') {
        conditions.push(`pi.${key} = ?`);
        params.push(filters[key]);
      }
    });
  }
  
  // Build complete query
  let fullQuery = baseQuery + joins + ' WHERE ' + conditions.join(' AND ');
  
  if (grouping) {
    fullQuery += ` GROUP BY ${grouping}`;
  } else if (metrics.includes('reuse_cycles') || metrics.includes('traceability_events')) {
    fullQuery += ' GROUP BY pi.id';
  }
  
  fullQuery += ' ORDER BY pi.created_at DESC LIMIT 1000';
  
  db.all(fullQuery, params, (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const customReport = {
      report_metadata: {
        name: report_name,
        generated_at: new Date().toISOString(),
        metrics_included: metrics,
        total_records: results.length,
        filters_applied: filters || {},
        date_range: date_range || 'all_time'
      },
      data: results,
      summary: generateCustomReportSummary(results, metrics)
    };
    
    res.json({
      success: true,
      data: customReport
    });
  });
});

// Helper functions
function calculateCircularEconomyScore(materialData) {
  if (!materialData || materialData.length === 0) return 0;
  
  const totalItems = materialData.reduce((sum, m) => sum + (m.total_items || 0), 0);
  const totalCycles = materialData.reduce((sum, m) => sum + (m.total_reuse_cycles || 0), 0);
  const recyclableItems = materialData.reduce((sum, m) => 
    sum + (m.recyclable ? (m.total_items || 0) : 0), 0);
  
  if (totalItems === 0) return 0;
  
  const reuseScore = Math.min((totalCycles / totalItems) * 40, 40);
  const recyclabilityScore = (recyclableItems / totalItems) * 30;
  const diversityScore = Math.min(materialData.length * 2, 30);
  
  return Math.round(reuseScore + recyclabilityScore + diversityScore);
}

function convertReportToCSV(report) {
  const csvRows = [];
  
  // Add header
  csvRows.push('Material,Category,Total Items,Reuse Cycles,Recyclable,Biodegradable,UK Waste Code');
  
  // Add data rows
  report.material_analysis.forEach(material => {
    csvRows.push([
      material.material_name,
      material.category,
      material.total_items || 0,
      material.total_reuse_cycles || 0,
      material.recyclable ? 'Yes' : 'No',
      material.biodegradable ? 'Yes' : 'No',
      material.uk_waste_code || ''
    ].join(','));
  });
  
  return csvRows.join('\n');
}

function generateCustomReportSummary(results, metrics) {
  const summary = {};
  
  if (metrics.includes('reuse_cycles')) {
    const totalCycles = results.reduce((sum, r) => sum + (r.reuse_cycles || 0), 0);
    summary.total_reuse_cycles = totalCycles;
    summary.avg_cycles_per_item = results.length > 0 ? 
      (totalCycles / results.length).toFixed(2) : '0';
  }
  
  if (metrics.includes('traceability_events')) {
    const totalEvents = results.reduce((sum, r) => sum + (r.total_events || 0), 0);
    summary.total_traceability_events = totalEvents;
    summary.avg_events_per_item = results.length > 0 ? 
      (totalEvents / results.length).toFixed(2) : '0';
  }
  
  summary.total_items = results.length;
  summary.unique_materials = new Set(results.map(r => r.material_name)).size;
  summary.unique_manufacturers = new Set(results.map(r => r.manufacturer)).size;
  
  return summary;
}

module.exports = router;