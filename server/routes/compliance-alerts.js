const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { authenticate, requireRole } = require('../middleware/auth');

// Get all alerts for organization
router.get('/alerts', authenticate, (req, res) => {
  const { severity, is_resolved, limit = 50, offset = 0 } = req.query;
  const orgId = req.user.organizationId;

  let sql = `SELECT * FROM compliance_alerts WHERE organization_id = ?`;
  const params = [orgId];

  if (severity) {
    sql += ' AND severity = ?';
    params.push(severity);
  }
  if (is_resolved !== undefined) {
    sql += ' AND is_resolved = ?';
    params.push(is_resolved === 'true' ? 1 : 0);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  db.all(sql, params, (err, alerts) => {
    if (err) return res.status(500).json({ error: err.message });

    db.get(
      'SELECT COUNT(*) as total FROM compliance_alerts WHERE organization_id = ?',
      [orgId],
      (err, count) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, data: alerts, total: count.total });
      }
    );
  });
});

// Mark alert as read
router.put('/alerts/:alertId/read', authenticate, (req, res) => {
  db.run(
    'UPDATE compliance_alerts SET is_read = 1 WHERE id = ? AND organization_id = ?',
    [req.params.alertId, req.user.organizationId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Alert not found' });
      res.json({ success: true, message: 'Alert marked as read' });
    }
  );
});

// Resolve alert
router.put('/alerts/:alertId/resolve', authenticate, requireRole('admin', 'auditor', 'operator'), (req, res) => {
  db.run(
    `UPDATE compliance_alerts SET is_resolved = 1, resolved_at = CURRENT_TIMESTAMP, resolved_by = ?
     WHERE id = ? AND organization_id = ?`,
    [req.user.id, req.params.alertId, req.user.organizationId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Alert not found' });
      res.json({ success: true, message: 'Alert resolved' });
    }
  );
});

// Mark all alerts as read
router.put('/alerts/read-all', authenticate, (req, res) => {
  db.run(
    'UPDATE compliance_alerts SET is_read = 1 WHERE organization_id = ? AND is_read = 0',
    [req.user.organizationId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, message: `${this.changes} alerts marked as read` });
    }
  );
});

// --- Compliance Deadlines / Calendar ---

// Get compliance calendar
router.get('/calendar', authenticate, (req, res) => {
  const { year, month, status } = req.query;
  const orgId = req.user.organizationId;

  let sql = `SELECT * FROM compliance_deadlines WHERE organization_id = ?`;
  const params = [orgId];

  if (year) {
    sql += ` AND strftime('%Y', deadline_date) = ?`;
    params.push(year);
  }
  if (month) {
    sql += ` AND strftime('%m', deadline_date) = ?`;
    params.push(month.padStart(2, '0'));
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }

  sql += ' ORDER BY deadline_date ASC';

  db.all(sql, params, (err, deadlines) => {
    if (err) return res.status(500).json({ error: err.message });

    // Categorize
    const now = new Date();
    const categorized = {
      overdue: [],
      due_soon: [],
      upcoming: [],
      completed: []
    };

    deadlines.forEach(d => {
      if (d.status === 'completed') {
        categorized.completed.push(d);
      } else {
        const deadlineDate = new Date(d.deadline_date);
        const daysUntil = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));

        d.days_until_deadline = daysUntil;

        if (daysUntil < 0) {
          d.status_computed = 'overdue';
          categorized.overdue.push(d);
        } else if (daysUntil <= d.reminder_days) {
          d.status_computed = 'due_soon';
          categorized.due_soon.push(d);
        } else {
          d.status_computed = 'upcoming';
          categorized.upcoming.push(d);
        }
      }
    });

    res.json({
      success: true,
      data: {
        summary: {
          total: deadlines.length,
          overdue: categorized.overdue.length,
          due_soon: categorized.due_soon.length,
          upcoming: categorized.upcoming.length,
          completed: categorized.completed.length
        },
        deadlines: categorized
      }
    });
  });
});

// Add compliance deadline
router.post('/calendar', authenticate, requireRole('admin', 'auditor'), (req, res) => {
  const { title, description, regulation_type, deadline_date, reminder_days } = req.body;

  if (!title || !deadline_date) {
    return res.status(400).json({ error: 'Title and deadline date are required' });
  }

  db.run(
    `INSERT INTO compliance_deadlines (organization_id, title, description, regulation_type, deadline_date, reminder_days)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [req.user.organizationId, title, description, regulation_type, deadline_date, reminder_days || 14],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        success: true,
        data: { id: this.lastID, title, deadline_date, regulation_type }
      });
    }
  );
});

// Mark deadline complete
router.put('/calendar/:deadlineId/complete', authenticate, requireRole('admin', 'auditor', 'operator'), (req, res) => {
  db.run(
    `UPDATE compliance_deadlines SET status = 'completed', completed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND organization_id = ?`,
    [req.params.deadlineId, req.user.organizationId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Deadline not found' });
      res.json({ success: true, message: 'Deadline marked as completed' });
    }
  );
});

// Delete deadline
router.delete('/calendar/:deadlineId', authenticate, requireRole('admin'), (req, res) => {
  db.run(
    'DELETE FROM compliance_deadlines WHERE id = ? AND organization_id = ?',
    [req.params.deadlineId, req.user.organizationId],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Deadline not found' });
      res.json({ success: true, message: 'Deadline deleted' });
    }
  );
});

// --- Compliance Check Trigger ---

// Run compliance check for organization (manual trigger)
router.post('/check', authenticate, requireRole('admin', 'auditor'), (req, res) => {
  const orgId = req.user.organizationId;

  runComplianceCheck(orgId, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, data: results });
  });
});

// --- Compliance Schedules ---

// Get schedules
router.get('/schedules', authenticate, requireRole('admin'), (req, res) => {
  db.all(
    'SELECT * FROM compliance_schedules WHERE organization_id = ? ORDER BY created_at DESC',
    [req.user.organizationId],
    (err, schedules) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, data: schedules });
    }
  );
});

// Create schedule
router.post('/schedules', authenticate, requireRole('admin'), (req, res) => {
  const { schedule_name, schedule_type, cron_expression, config } = req.body;

  if (!schedule_name || !schedule_type) {
    return res.status(400).json({ error: 'Schedule name and type are required' });
  }

  const validTypes = ['daily_check', 'weekly_check', 'monthly_report', 'deadline_reminder'];
  if (!validTypes.includes(schedule_type)) {
    return res.status(400).json({ error: `Invalid type. Must be: ${validTypes.join(', ')}` });
  }

  // Default cron expressions
  const defaultCrons = {
    daily_check: '0 9 * * *',
    weekly_check: '0 9 * * 1',
    monthly_report: '0 9 1 * *',
    deadline_reminder: '0 9 * * *'
  };

  db.run(
    `INSERT INTO compliance_schedules (organization_id, schedule_name, schedule_type, cron_expression, config)
     VALUES (?, ?, ?, ?, ?)`,
    [req.user.organizationId, schedule_name, schedule_type, cron_expression || defaultCrons[schedule_type], JSON.stringify(config || {})],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({
        success: true,
        data: { id: this.lastID, schedule_name, schedule_type }
      });
    }
  );
});

// Toggle schedule active/inactive
router.put('/schedules/:scheduleId/toggle', authenticate, requireRole('admin'), (req, res) => {
  db.get(
    'SELECT is_active FROM compliance_schedules WHERE id = ? AND organization_id = ?',
    [req.params.scheduleId, req.user.organizationId],
    (err, schedule) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!schedule) return res.status(404).json({ error: 'Schedule not found' });

      db.run(
        'UPDATE compliance_schedules SET is_active = ? WHERE id = ?',
        [schedule.is_active ? 0 : 1, req.params.scheduleId],
        function(err) {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ success: true, message: `Schedule ${schedule.is_active ? 'disabled' : 'enabled'}` });
        }
      );
    }
  );
});

// --- EPR Report Generation ---

// Generate EPR report (JSON format - structured for PDF rendering on client)
router.get('/epr-report', authenticate, requireRole('admin', 'auditor'), (req, res) => {
  const { year, quarter } = req.query;
  const orgId = req.user.organizationId;
  const reportYear = year || new Date().getFullYear();

  let dateFilter = `strftime('%Y', pi.created_at) = '${reportYear}'`;
  if (quarter) {
    const quarters = { 1: ['01', '03'], 2: ['04', '06'], 3: ['07', '09'], 4: ['10', '12'] };
    const q = quarters[quarter];
    if (q) {
      dateFilter += ` AND strftime('%m', pi.created_at) BETWEEN '${q[0]}' AND '${q[1]}'`;
    }
  }

  const sql = `
    SELECT
      mt.name as material_name,
      mt.category,
      mt.uk_waste_code,
      mt.recyclable,
      mt.biodegradable,
      COUNT(DISTINCT pi.id) as total_items,
      SUM(pi.weight) as total_weight_kg,
      COUNT(pc.id) as total_reuse_cycles,
      SUM(CASE WHEN ucr.compliance_status = 'compliant' THEN 1 ELSE 0 END) as compliant_count,
      SUM(CASE WHEN ucr.compliance_status = 'non_compliant' THEN 1 ELSE 0 END) as non_compliant_count,
      SUM(CASE WHEN ucr.compliance_status = 'pending' THEN 1 ELSE 0 END) as pending_count
    FROM packaging_items pi
    JOIN material_types mt ON pi.material_type_id = mt.id
    LEFT JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
    LEFT JOIN uk_compliance_records ucr ON pi.id = ucr.packaging_item_id
    WHERE pi.organization_id = ? AND ${dateFilter}
    GROUP BY mt.id, mt.name, mt.category
    ORDER BY total_weight_kg DESC
  `;

  db.all(sql, [orgId], (err, materials) => {
    if (err) return res.status(500).json({ error: err.message });

    // Get org info
    db.get('SELECT * FROM organizations WHERE id = ?', [orgId], (err, org) => {
      if (err) return res.status(500).json({ error: err.message });

      const EPR_RATE = 0.15;
      const PPT_RATE = 0.2217; // Current UK rate per kg
      const PPT_THRESHOLD = 0.30; // 30% recycled content threshold

      const totals = materials.reduce((acc, m) => {
        const weight = m.total_weight_kg || 0;
        acc.total_weight += weight;
        acc.total_items += m.total_items;
        acc.total_cycles += m.total_reuse_cycles;
        acc.epr_liability += weight * EPR_RATE;
        // PPT applies to plastic with <30% recycled content
        if (m.category === 'Plastic') {
          acc.ppt_liable_weight += weight;
          acc.ppt_liability += weight * PPT_RATE;
        }
        return acc;
      }, { total_weight: 0, total_items: 0, total_cycles: 0, epr_liability: 0, ppt_liable_weight: 0, ppt_liability: 0 });

      const report = {
        report_type: 'EPR_Compliance_Report',
        generated_at: new Date().toISOString(),
        period: { year: reportYear, quarter: quarter || 'annual' },
        organization: {
          name: org.name,
          company_number: org.company_number,
          address: org.address
        },
        executive_summary: {
          total_packaging_items: totals.total_items,
          total_weight_kg: parseFloat(totals.total_weight.toFixed(2)),
          total_reuse_cycles: totals.total_cycles,
          estimated_epr_liability_gbp: parseFloat(totals.epr_liability.toFixed(2)),
          estimated_ppt_liability_gbp: parseFloat(totals.ppt_liability.toFixed(2)),
          ppt_liable_weight_kg: parseFloat(totals.ppt_liable_weight.toFixed(2)),
          combined_regulatory_cost_gbp: parseFloat((totals.epr_liability + totals.ppt_liability).toFixed(2))
        },
        material_breakdown: materials.map(m => ({
          ...m,
          total_weight_kg: parseFloat((m.total_weight_kg || 0).toFixed(2)),
          epr_cost_gbp: parseFloat(((m.total_weight_kg || 0) * EPR_RATE).toFixed(2)),
          ppt_cost_gbp: m.category === 'Plastic' ? parseFloat(((m.total_weight_kg || 0) * PPT_RATE).toFixed(2)) : 0
        })),
        regulatory_notes: [
          'EPR rates are estimates based on current DEFRA published rates',
          `Plastic Packaging Tax rate: £${PPT_RATE}/kg for packaging with less than ${PPT_THRESHOLD * 100}% recycled content`,
          'This report should be reviewed by a compliance officer before submission',
          'Figures based on packaging items registered in the system for the specified period'
        ]
      };

      // Support CSV export
      if (req.query.format === 'csv') {
        const csv = [
          'Material,Category,UK Waste Code,Items,Weight (kg),Reuse Cycles,EPR Cost (GBP),PPT Cost (GBP),Compliant,Non-Compliant,Pending',
          ...report.material_breakdown.map(m => [
            m.material_name, m.category, m.uk_waste_code, m.total_items,
            m.total_weight_kg, m.total_reuse_cycles, m.epr_cost_gbp, m.ppt_cost_gbp,
            m.compliant_count || 0, m.non_compliant_count || 0, m.pending_count || 0
          ].join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=epr_report_${reportYear}_Q${quarter || 'all'}.csv`);
        return res.send(csv);
      }

      res.json({ success: true, data: report });
    });
  });
});

// Compliance check engine
function runComplianceCheck(orgId, callback) {
  const alerts = [];

  // Check 1: Items without compliance records
  db.all(
    `SELECT pi.id, pi.product_name, pi.manufacturer
     FROM packaging_items pi
     LEFT JOIN uk_compliance_records ucr ON pi.id = ucr.packaging_item_id
     WHERE pi.organization_id = ? AND pi.status = 'active' AND ucr.id IS NULL`,
    [orgId],
    (err, uncheckedItems) => {
      if (err) return callback(err);

      if (uncheckedItems.length > 0) {
        alerts.push({
          alert_type: 'missing_compliance',
          severity: 'high',
          title: `${uncheckedItems.length} packaging items without compliance records`,
          message: `Items: ${uncheckedItems.slice(0, 5).map(i => i.product_name).join(', ')}${uncheckedItems.length > 5 ? '...' : ''}`,
          regulation_type: 'EPR'
        });
      }

      // Check 2: Non-compliant items
      db.all(
        `SELECT COUNT(*) as count FROM uk_compliance_records
         WHERE organization_id = ? AND compliance_status = 'non_compliant'`,
        [orgId],
        (err, result) => {
          if (err) return callback(err);

          if (result[0].count > 0) {
            alerts.push({
              alert_type: 'non_compliance',
              severity: 'critical',
              title: `${result[0].count} non-compliant items require attention`,
              message: 'Review non-compliant packaging items and take corrective action',
              regulation_type: 'EPR'
            });
          }

          // Check 3: Upcoming deadlines
          db.all(
            `SELECT * FROM compliance_deadlines
             WHERE organization_id = ? AND status = 'upcoming'
             AND deadline_date BETWEEN date('now') AND date('now', '+' || reminder_days || ' days')`,
            [orgId],
            (err, upcomingDeadlines) => {
              if (err) return callback(err);

              upcomingDeadlines.forEach(d => {
                alerts.push({
                  alert_type: 'deadline_approaching',
                  severity: 'medium',
                  title: `Deadline approaching: ${d.title}`,
                  message: `Due on ${d.deadline_date}. ${d.description || ''}`,
                  regulation_type: d.regulation_type
                });
              });

              // Check 4: Overdue deadlines
              db.all(
                `SELECT * FROM compliance_deadlines
                 WHERE organization_id = ? AND status = 'upcoming' AND deadline_date < date('now')`,
                [orgId],
                (err, overdueDeadlines) => {
                  if (err) return callback(err);

                  overdueDeadlines.forEach(d => {
                    alerts.push({
                      alert_type: 'deadline_overdue',
                      severity: 'critical',
                      title: `OVERDUE: ${d.title}`,
                      message: `Was due on ${d.deadline_date}. Immediate action required.`,
                      regulation_type: d.regulation_type
                    });
                  });

                  // Check 5: Low condition packaging still in use
                  db.all(
                    `SELECT pi.product_name, pc.condition_score
                     FROM packaging_items pi
                     JOIN packaging_cycles pc ON pi.id = pc.packaging_item_id
                     WHERE pi.organization_id = ? AND pi.status = 'active'
                     AND pc.condition_score <= 3 AND pc.end_date IS NULL`,
                    [orgId],
                    (err, lowCondition) => {
                      if (err) return callback(err);

                      if (lowCondition.length > 0) {
                        alerts.push({
                          alert_type: 'quality_risk',
                          severity: 'medium',
                          title: `${lowCondition.length} items with low condition scores still in use`,
                          message: 'These items may not meet quality standards for reuse',
                          regulation_type: 'QualityControl'
                        });
                      }

                      // Insert all alerts
                      let inserted = 0;
                      if (alerts.length === 0) {
                        return callback(null, {
                          check_completed: new Date().toISOString(),
                          alerts_generated: 0,
                          message: 'All compliance checks passed'
                        });
                      }

                      alerts.forEach(alert => {
                        db.run(
                          `INSERT INTO compliance_alerts (organization_id, alert_type, severity, title, message, regulation_type)
                           VALUES (?, ?, ?, ?, ?, ?)`,
                          [orgId, alert.alert_type, alert.severity, alert.title, alert.message, alert.regulation_type],
                          () => {
                            inserted++;
                            if (inserted === alerts.length) {
                              callback(null, {
                                check_completed: new Date().toISOString(),
                                alerts_generated: alerts.length,
                                alerts
                              });
                            }
                          }
                        );
                      });
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
}

// Export for use in scheduler
module.exports = router;
module.exports.runComplianceCheck = runComplianceCheck;
