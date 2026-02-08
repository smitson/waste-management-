const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');

const materialRoutes = require('./routes/materials');
const traceabilityRoutes = require('./routes/traceability');
const packagingRoutes = require('./routes/packaging');
const reportsRoutes = require('./routes/reports');
const analyticsRoutes = require('./routes/analytics');
const organizationRoutes = require('./routes/organizations');
const complianceAlertRoutes = require('./routes/compliance-alerts');
const bulkImportRoutes = require('./routes/bulk-import');
const { initializeScheduler } = require('./services/scheduler');
const { optionalAuth, tenantIsolation } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use('/static', express.static(path.join(__dirname, '../frontend')));

// --- Public Routes (no auth required) ---
app.use('/api/org', organizationRoutes);

// --- Protected Routes (auth optional for backward compat, tenant-isolated) ---
app.use('/api/materials', optionalAuth, tenantIsolation, materialRoutes);
app.use('/api/traceability', optionalAuth, tenantIsolation, traceabilityRoutes);
app.use('/api/packaging', optionalAuth, tenantIsolation, packagingRoutes);
app.use('/api/reports', optionalAuth, tenantIsolation, reportsRoutes);
app.use('/api/analytics', optionalAuth, tenantIsolation, analyticsRoutes);

// --- New Feature Routes (auth required) ---
app.use('/api/compliance', complianceAlertRoutes);
app.use('/api/import', bulkImportRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    message: 'UK Waste Management & Compliance System is running',
    features: [
      'Multi-tenant organization management',
      'Role-based access control (Admin, Auditor, Operator, Read-only)',
      'API key authentication',
      'Automated compliance alerts & scheduling',
      'EPR report generation',
      'Compliance calendar & deadlines',
      'CSV bulk import with validation',
      'Webhook integrations',
      'Circular economy tracking'
    ]
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);

  // Handle multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
  }
  if (err.message === 'Only CSV files are allowed') {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`UK Waste Management & Compliance System v2.0 running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

  // Initialize compliance scheduler
  setTimeout(() => {
    initializeScheduler();
  }, 2000);
});

module.exports = app;
