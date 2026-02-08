const cron = require('node-cron');
const db = require('../config/database');
const { runComplianceCheck } = require('../routes/compliance-alerts');

let scheduledJobs = {};

// Initialize scheduled compliance checks for all active organizations
function initializeScheduler() {
  console.log('Initializing compliance scheduler...');

  // Run deadline checks daily at 9am
  scheduledJobs['global_deadline_check'] = cron.schedule('0 9 * * *', () => {
    console.log('Running daily deadline compliance checks...');
    runAllOrganizationChecks();
  });

  // Load organization-specific schedules
  db.all(
    `SELECT cs.*, o.name as org_name FROM compliance_schedules cs
     JOIN organizations o ON cs.organization_id = o.id
     WHERE cs.is_active = 1 AND o.is_active = 1`,
    [],
    (err, schedules) => {
      if (err) {
        console.error('Error loading schedules:', err.message);
        return;
      }

      schedules.forEach(schedule => {
        if (cron.validate(schedule.cron_expression)) {
          const jobKey = `org_${schedule.organization_id}_${schedule.id}`;
          scheduledJobs[jobKey] = cron.schedule(schedule.cron_expression, () => {
            console.log(`Running scheduled check: ${schedule.schedule_name} for ${schedule.org_name}`);
            runComplianceCheck(schedule.organization_id, (err, results) => {
              if (err) {
                console.error(`Schedule error for ${schedule.org_name}:`, err.message);
              } else {
                console.log(`Check completed for ${schedule.org_name}: ${results.alerts_generated} alerts`);
              }
              // Update last_run
              db.run(
                'UPDATE compliance_schedules SET last_run = CURRENT_TIMESTAMP WHERE id = ?',
                [schedule.id]
              );
            });
          });
          console.log(`Scheduled: ${schedule.schedule_name} (${schedule.cron_expression}) for ${schedule.org_name}`);
        }
      });

      console.log(`Scheduler initialized with ${Object.keys(scheduledJobs).length} jobs`);
    }
  );
}

function runAllOrganizationChecks() {
  db.all('SELECT id, name FROM organizations WHERE is_active = 1', [], (err, orgs) => {
    if (err) {
      console.error('Error fetching organizations:', err.message);
      return;
    }

    orgs.forEach(org => {
      runComplianceCheck(org.id, (err, results) => {
        if (err) {
          console.error(`Check error for ${org.name}:`, err.message);
        } else if (results.alerts_generated > 0) {
          console.log(`[${org.name}] Generated ${results.alerts_generated} compliance alerts`);
          // Trigger webhooks for this org
          triggerWebhooks(org.id, 'compliance.check', results);
        }
      });
    });
  });
}

function triggerWebhooks(orgId, eventType, payload) {
  db.all(
    `SELECT * FROM webhooks WHERE organization_id = ? AND is_active = 1`,
    [orgId],
    (err, webhooks) => {
      if (err) return;

      webhooks.forEach(webhook => {
        const events = JSON.parse(webhook.events || '["all"]');
        if (!events.includes('all') && !events.includes(eventType)) return;

        // Fire and forget webhook call
        const webhookPayload = JSON.stringify({
          event: eventType,
          timestamp: new Date().toISOString(),
          organization_id: orgId,
          data: payload
        });

        // Use native http/https to avoid adding axios dependency
        const url = new URL(webhook.url);
        const httpModule = url.protocol === 'https:' ? require('https') : require('http');

        const req = httpModule.request(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Event': eventType,
            ...(webhook.secret ? { 'X-Webhook-Secret': webhook.secret } : {})
          },
          timeout: 10000
        }, (res) => {
          db.run('UPDATE webhooks SET last_triggered = CURRENT_TIMESTAMP WHERE id = ?', [webhook.id]);
          if (res.statusCode >= 400) {
            db.run('UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?', [webhook.id]);
          } else {
            db.run('UPDATE webhooks SET failure_count = 0 WHERE id = ?', [webhook.id]);
          }
        });

        req.on('error', () => {
          db.run('UPDATE webhooks SET failure_count = failure_count + 1 WHERE id = ?', [webhook.id]);
        });

        req.write(webhookPayload);
        req.end();
      });
    }
  );
}

function stopScheduler() {
  Object.values(scheduledJobs).forEach(job => job.stop());
  scheduledJobs = {};
  console.log('Scheduler stopped');
}

module.exports = { initializeScheduler, stopScheduler, triggerWebhooks };
