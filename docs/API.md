# API Documentation

## Overview
The Waste Management System API provides RESTful endpoints for managing waste collections, locations, and analytics.

## Base URL
- Development: `http://localhost:8000`
- Production: `https://your-domain.com`

## Authentication
Currently, the API does not require authentication. In production, implement JWT or OAuth2.

## Rate Limiting
No rate limiting is currently implemented. Consider adding rate limiting for production.

## Error Handling

### Error Response Format
```json
{
  "detail": "Error message description"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Endpoints

### Collections

#### GET /api/collections
Retrieve all waste collections.

**Response:**
```json
[
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
Create a new waste collection.

**Request Body:**
```json
{
  "location": "Downtown Area",
  "waste_type": "plastic",
  "quantity": 25.5,
  "unit": "kg",
  "collected_date": "2024-01-15T10:30:00",
  "status": "pending"
}
```

**Validation Rules:**
- `location`: Required string
- `waste_type`: Required, must be one of: organic, plastic, paper, metal, glass, electronic
- `quantity`: Required positive number
- `unit`: Required, must be one of: kg, tons, liters
- `collected_date`: Required ISO datetime string
- `status`: Optional, defaults to "pending"

#### GET /api/collections/{id}
Retrieve a specific waste collection by ID.

#### PUT /api/collections/{id}
Update an existing waste collection.

#### DELETE /api/collections/{id}
Delete a waste collection.

### Locations

#### GET /api/locations
Retrieve all locations.

#### POST /api/locations
Create a new location.

**Request Body:**
```json
{
  "name": "Downtown Collection Point",
  "address": "123 Main St, City",
  "latitude": 40.7128,
  "longitude": -74.0060,
  "zone": "Zone A"
}
```

**Validation Rules:**
- `name`: Required string
- `address`: Required string
- `latitude`: Required number between -90 and 90
- `longitude`: Required number between -180 and 180
- `zone`: Required string

### Analytics

#### GET /api/analytics
Get comprehensive analytics data.

**Response:**
```json
{
  "total_collections": 150,
  "pending_collections": 25,
  "completed_collections": 125,
  "waste_by_type": {
    "plastic": 450.5,
    "organic": 320.0,
    "paper": 180.2,
    "metal": 95.8,
    "glass": 67.3,
    "electronic": 23.1
  }
}
```

### Health Check

#### GET /health
Check if the API is running properly.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00"
}
```

## Interactive Documentation

When running the application, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`