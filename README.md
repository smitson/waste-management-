# UK Waste Management Compliance System

A comprehensive waste management system designed to help companies conform to UK waste management regulations with advanced traceability, circular economy features, and compliance reporting.

## 🎯 Features

### Core Functionality
- **Material Type Management** - Compare and analyze different packaging materials
- **End-to-End Traceability** - Complete tracking from production to disposal/reuse
- **Circular Packaging System** - Monitor and manage reuse cycles
- **UK Compliance Monitoring** - Track compliance with UK waste management regulations
- **Advanced Analytics** - Insight tools for sustainability and performance optimization
- **Configurable Reporting** - Customizable reports for various stakeholders

### Key Benefits
- ✅ Complete batch-level traceability
- ✅ Single-use vs reuse analysis
- ✅ Real-time packaging fleet monitoring
- ✅ Automated compliance checking
- ✅ Environmental impact assessment
- ✅ Predictive lifecycle analytics

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ 
- SQLite3

### Installation
```bash
# Clone the repository
git clone https://github.com/smitson/waste-management-.git
cd waste-management-

# Install dependencies
npm run install-all

# Start the development server
npm run dev
```

### Production Deployment
```bash
# Install dependencies
npm install

# Build the client
npm run build

# Start production server
npm start
```

## 📊 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Health Check
```bash
GET /health
```

### Materials API
```bash
# Get all material types
GET /materials

# Get material by ID
GET /materials/:id

# Compare materials (Insight Tools)
POST /materials/compare
{
  "materialIds": [1, 2, 3]
}

# Get lifecycle data
GET /materials/:id/lifecycle
```

### Packaging API
```bash
# Create packaging item
POST /packaging
{
  "material_type_id": 1,
  "manufacturer": "Company Ltd",
  "product_name": "Bottle 500ml",
  "batch_number": "BATCH001",
  "weight": 0.5
}

# Start reuse cycle
POST /packaging/:id/cycles
{
  "reuse_type": "cleaning_refill",
  "condition_score": 8,
  "notes": "Good condition"
}

# Get circular performance
GET /packaging/:id/performance

# Single-use vs reuse analysis
GET /packaging/analysis/single-use-vs-reuse
```

### Traceability API
```bash
# Add traceability event
POST /traceability/:packageId/events
{
  "event_type": "transport",
  "location": "Warehouse A",
  "operator": "John Doe",
  "details": "Moved to distribution center"
}

# Get complete traceability chain
GET /traceability/:packageId/chain

# Batch tracking
GET /traceability/batch/:batchNumber

# Fleet movements
GET /traceability/fleet/movements
```

### Analytics API
```bash
# Dashboard KPIs
GET /analytics/dashboard?period=30

# Environmental impact
GET /analytics/environmental-impact

# Circular packaging analysis
GET /analytics/circular-packaging

# Predictive lifecycle analysis
GET /analytics/predictive/lifecycle?packaging_item_id=uuid
```

### Reports API
```bash
# Comprehensive report
GET /reports/comprehensive?format=json

# UK compliance report
GET /reports/compliance

# Performance metrics
GET /reports/performance

# Custom report builder
POST /reports/custom
{
  "report_name": "Monthly Sustainability Report",
  "metrics": ["reuse_cycles", "compliance"],
  "date_range": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  }
}
```

## 🏗️ System Architecture

### Backend
- **Express.js** - REST API server
- **SQLite** - Lightweight database for development
- **Node.js** - Runtime environment

### Database Schema
- `material_types` - Different packaging materials and properties
- `packaging_items` - Individual packaging instances
- `traceability_events` - Movement and lifecycle events
- `packaging_cycles` - Reuse cycle tracking
- `uk_compliance_records` - Compliance assessments
- `performance_metrics` - System performance data

## 📈 Key Performance Indicators

### Sustainability Metrics
- **Reuse Rate**: Percentage of items that enter circular cycles
- **Condition Score**: Average quality across reuse cycles
- **Waste Prevented**: Total weight diverted from disposal
- **CO2 Saved**: Estimated carbon footprint reduction

### Compliance Metrics
- **Compliance Rate**: Percentage meeting UK regulations
- **Assessment Coverage**: Items with compliance assessments
- **Regulation Breakdown**: Status by regulation type

### Operational Metrics
- **Traceability Coverage**: Items with complete tracking
- **Fleet Activity**: Movement and location analytics
- **Batch Performance**: Quality and efficiency by batch

## 🔄 Circular Economy Features

### Reuse Cycle Management
- Track multiple reuse cycles per item
- Monitor condition degradation over time
- Optimize reuse strategies based on performance data

### Lifecycle Prediction
- Estimate remaining useful cycles
- Predict optimal retirement timing
- Recommend maintenance interventions

### Single-use vs Reuse Analysis
- Compare environmental impact
- Calculate cost-benefit ratios
- Identify optimization opportunities

## 🇬🇧 UK Compliance Features

### Supported Regulations
- Packaging and Packaging Waste Regulations
- Environmental Protection Act requirements
- Waste Framework Directive compliance
- Extended Producer Responsibility (EPR)

### Compliance Tracking
- Automated assessment workflows
- Regulatory reporting templates
- Audit trail maintenance
- Non-compliance alerting

## 📊 Reporting Capabilities

### Standard Reports
- **Comprehensive Waste Management Report**
- **UK Compliance Status Report**
- **Environmental Impact Assessment**
- **Circular Packaging Performance Report**

### Custom Report Builder
- Flexible metric selection
- Date range filtering
- Material type grouping
- Export formats (JSON, CSV)

## 🛠️ Development

### Project Structure
```
├── server/
│   ├── config/         # Database configuration
│   ├── routes/         # API route handlers
│   ├── models/         # Data models
│   ├── middleware/     # Custom middleware
│   └── index.js        # Server entry point
├── database/           # SQLite database files
├── client/            # Frontend application (future)
└── docs/              # Documentation
```

### Running Tests
```bash
npm test
```

### Environment Variables
```bash
NODE_ENV=development
PORT=5000
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the API documentation
- Review the troubleshooting guide

---

*Built for UK waste management compliance and circular economy optimization.*