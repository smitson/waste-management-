# 🗂️ Modern Waste Management System

A comprehensive, cloud-ready waste management system built with modern web technologies. This system provides tracking, analytics, and management capabilities for waste collection operations.

## 🚀 Tech Stack

### Frontend
- **HTML5** with semantic markup
- **Modern CSS** with CSS Grid, Flexbox, and CSS Variables
- **Vanilla JavaScript** (ES6+) with async/await
- **Responsive Design** - Mobile-first approach
- **Progressive Web App** ready

### Backend
- **Python 3.11+** with FastAPI framework
- **Async/await** support for high performance
- **Pydantic** for data validation
- **SQLAlchemy** for database ORM (ready for PostgreSQL)
- **RESTful API** design

### Cloud & DevOps
- **Docker** containerization
- **Docker Compose** for multi-service deployment
- **Nginx** reverse proxy with optimization
- **PostgreSQL** database
- **Cloud platform** ready (AWS, GCP, Azure)

### Testing
- **Pytest** for Python backend testing
- **AsyncIO** testing support
- **HTTPX** for API testing
- **Comprehensive test coverage**

## 📋 Features

- **Dashboard** - Real-time analytics and metrics
- **Waste Collection Management** - Create, update, track collections
- **Location Management** - Manage collection locations with GPS coordinates
- **Analytics** - Waste type distribution and collection statistics
- **Responsive UI** - Works on desktop, tablet, and mobile
- **RESTful API** - Full CRUD operations
- **Real-time Updates** - Dynamic UI updates without page refresh

## 🛠️ Installation & Setup

### Prerequisites
- Python 3.11+
- [uv](https://github.com/astral-sh/uv) (fast Python package manager)
- Docker and Docker Compose (for containerized deployment)
- PostgreSQL (for production database)

### Local Development (with uv)


1. **Clone the repository**

  ```bash
  git clone <repository-url>
  cd waste-management-
  ```


2. **Install uv (if not already installed)**

  ```bash
  pip install uv
  # or
  python -m pip install uv
  ```


3. **Create and activate a virtual environment with uv**

  ```bash
  uv venv .venv
  uv venv --activate
  # On Windows PowerShell:
  .venv\Scripts\Activate.ps1
  ```


4. **Install dependencies**

  ```bash
  uv pip install -r requirements.txt
  ```


5. **Set up environment variables**

  ```bash
  cp .env.example .env
  # Edit .env with your configuration
  ```


6. **Run the application**

  ```bash
  uv pip install -r requirements.txt  # Ensure all deps are installed
  .venv\Scripts\python -m uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
  ```


6. **Access the application**

  - Frontend: http://localhost:8000
  - API Documentation: http://localhost:8000/docs
  - Health Check: http://localhost:8000/health

### Docker Deployment


1. **Build and run with Docker Compose**

  ```bash
  docker-compose up --build
  ```


2. **Access the application**

  - Application: http://localhost
  - Database: localhost:5432

## 🧪 Testing

### Run Backend Tests (with uv)
```bash
uv pip install pytest
uv pip install -r requirements.txt  # Ensure all deps are installed
pytest backend/tests/ -v

# With coverage
pytest backend/tests/ --cov=backend --cov-report=html
```
## ⚡ Using uv for Python

This project uses [uv](https://github.com/astral-sh/uv) for Python dependency management and virtual environments. `uv` is a fast, modern Python package manager and venv tool.

- Use `uv pip` instead of `pip` for all package management commands.
- Use `uv venv` to create and manage virtual environments.
- For more, see the [uv documentation](https://github.com/astral-sh/uv#usage).


### Test Coverage
The test suite includes:
- API endpoint testing
- Data validation testing
- CRUD operations testing
- Error handling testing
- Health check testing

## 📚 API Documentation

### Collections Endpoints

#### GET /api/collections
Get all waste collections
```json
Response: [
  {
    "id": 1,
    "location": "Downtown Area",
    "waste_type": "plastic",
    "quantity": 25.5,
    "unit": "kg",
    "collected_date": "2024-01-15T10:30:00",
    "status": "pending"
  }
]
```

#### POST /api/collections
Create a new waste collection
```json
Request: {
  "location": "Downtown Area",
  "waste_type": "plastic",
  "quantity": 25.5,
  "unit": "kg",
  "collected_date": "2024-01-15T10:30:00",
  "status": "pending"
}
```

#### PUT /api/collections/{id}
Update a waste collection

#### DELETE /api/collections/{id}
Delete a waste collection

### Locations Endpoints

#### GET /api/locations
Get all locations

#### POST /api/locations
Create a new location
```json
Request: {
  "name": "Downtown Collection Point",
  "address": "123 Main St, City",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "zone": "Zone A"
}
```

### Analytics Endpoints

#### GET /api/analytics
Get waste collection analytics
```json
Response: {
  "total_collections": 150,
  "pending_collections": 25,
  "completed_collections": 125,
  "waste_by_type": {
    "plastic": 450.5,
    "organic": 320.0,
    "paper": 180.2
  }
}
```

## 🏗️ Architecture

### Project Structure
```
waste-management-/
├── backend/
│   ├── app/
│   │   └── main.py          # FastAPI application
│   └── tests/
│       ├── __init__.py
│       └── test_api.py      # API tests
├── frontend/
│   ├── css/
│   │   └── styles.css       # Modern CSS with variables
│   ├── js/
│   │   └── app.js          # Vanilla JavaScript app
│   └── index.html          # Main HTML page
├── deployment/
│   └── nginx.conf          # Nginx configuration
├── docs/
├── docker-compose.yml      # Multi-service deployment
├── Dockerfile             # Container definition
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
├── .gitignore
└── README.md
```

### Data Models

#### WasteCollection
- `id`: Unique identifier
- `location`: Collection location name
- `waste_type`: Type of waste (organic, plastic, paper, metal, glass, electronic)
- `quantity`: Amount collected
- `unit`: Unit of measurement (kg, tons, liters)
- `collected_date`: Date and time of collection
- `status`: Collection status (pending, completed)

#### Location
- `id`: Unique identifier
- `name`: Location name
- `address`: Full address
- `latitude`: GPS latitude coordinate
- `longitude`: GPS longitude coordinate
- `zone`: Administrative zone

## 🌐 Cloud Deployment

### AWS Deployment
1. Use AWS ECS with the provided Dockerfile
2. Set up RDS PostgreSQL instance
3. Configure Application Load Balancer
4. Use AWS Secrets Manager for environment variables

### Google Cloud Deployment
1. Deploy to Google Cloud Run
2. Use Cloud SQL for PostgreSQL
3. Configure Cloud Load Balancing
4. Use Secret Manager for configuration

### Azure Deployment
1. Deploy to Azure Container Instances
2. Use Azure Database for PostgreSQL
3. Configure Azure Application Gateway
4. Use Azure Key Vault for secrets

## 🔮 Future Migration to Rust

The current Python backend is designed with a clear API structure that can be easily migrated to Rust:

### Migration Strategy
1. **Phase 1**: Rewrite API endpoints in Rust using Actix-web or Axum
2. **Phase 2**: Migrate data models using Diesel ORM
3. **Phase 3**: Implement performance optimizations
4. **Phase 4**: Full deployment and monitoring

### Benefits of Rust Migration
- **Performance**: Significantly faster execution
- **Memory Safety**: Zero-cost abstractions without garbage collection
- **Concurrency**: Excellent async/await support
- **Type Safety**: Compile-time error prevention
=======
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

2. Create a feature branch (`git checkout -b feature/new-feature`)
3. Make your changes
4. Add tests for new functionality
5. Run tests (`pytest backend/tests/`)
6. Commit your changes (`git commit -am 'Add new feature'`)
7. Push to the branch (`git push origin feature/new-feature`)
8. Create a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, please create an issue in the GitHub repository or contact the development team.

---

Built with ❤️ using modern web technologies
