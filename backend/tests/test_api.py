import pytest
import pytest_asyncio
from httpx import AsyncClient
from backend.app.main import app

@pytest.fixture(autouse=True)
def reset_state():
    # Reset the application state for each test
    from backend.app import main
    main.waste_collections.clear()
    main.locations.clear()
    main.collection_id_counter = 1
    main.location_id_counter = 1

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.mark.asyncio
async def test_read_root(client):
    """Test the root endpoint returns HTML"""
    response = await client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers.get("content-type", "")

@pytest.mark.asyncio
async def test_health_check(client):
    """Test health check endpoint"""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data

@pytest.mark.asyncio
async def test_get_collections_empty(client):
    """Test getting collections when none exist"""
    response = await client.get("/api/collections")
    assert response.status_code == 200
    assert response.json() == []

@pytest.mark.asyncio
async def test_create_collection(client):
    """Test creating a new waste collection"""
    collection_data = {
        "location": "Test Location",
        "waste_type": "plastic",
        "quantity": 10.5,
        "unit": "kg",
        "collected_date": "2024-01-01T10:00:00",
        "status": "pending"
    }
    
    response = await client.post("/api/collections", json=collection_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == 1
    assert data["location"] == "Test Location"
    assert data["waste_type"] == "plastic"
    assert data["quantity"] == 10.5
    assert data["unit"] == "kg"
    assert data["status"] == "pending"

@pytest.mark.asyncio
async def test_get_collection(client):
    """Test getting a specific collection"""
    # First create a collection
    collection_data = {
        "location": "Test Location",
        "waste_type": "plastic",
        "quantity": 10.5,
        "unit": "kg",
        "collected_date": "2024-01-01T10:00:00",
        "status": "pending"
    }
    
    create_response = await client.post("/api/collections", json=collection_data)
    collection_id = create_response.json()["id"]
    
    # Then get it
    response = await client.get(f"/api/collections/{collection_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == collection_id
    assert data["location"] == "Test Location"

@pytest.mark.asyncio
async def test_get_nonexistent_collection(client):
    """Test getting a collection that doesn't exist"""
    response = await client.get("/api/collections/999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Collection not found"

@pytest.mark.asyncio
async def test_update_collection(client):
    """Test updating a collection"""
    # Create a collection first
    collection_data = {
        "location": "Test Location",
        "waste_type": "plastic",
        "quantity": 10.5,
        "unit": "kg",
        "collected_date": "2024-01-01T10:00:00",
        "status": "pending"
    }
    
    create_response = await client.post("/api/collections", json=collection_data)
    collection_id = create_response.json()["id"]
    
    # Update the collection
    updated_data = {
        "location": "Updated Location",
        "waste_type": "organic",
        "quantity": 15.0,
        "unit": "kg",
        "collected_date": "2024-01-01T10:00:00",
        "status": "completed"
    }
    
    response = await client.put(f"/api/collections/{collection_id}", json=updated_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["location"] == "Updated Location"
    assert data["waste_type"] == "organic"
    assert data["quantity"] == 15.0
    assert data["status"] == "completed"

@pytest.mark.asyncio
async def test_delete_collection(client):
    """Test deleting a collection"""
    # Create a collection first
    collection_data = {
        "location": "Test Location",
        "waste_type": "plastic",
        "quantity": 10.5,
        "unit": "kg",
        "collected_date": "2024-01-01T10:00:00",
        "status": "pending"
    }
    
    create_response = await client.post("/api/collections", json=collection_data)
    collection_id = create_response.json()["id"]
    
    # Delete the collection
    response = await client.delete(f"/api/collections/{collection_id}")
    assert response.status_code == 200
    assert response.json()["message"] == "Collection deleted successfully"
    
    # Verify it's gone
    get_response = await client.get(f"/api/collections/{collection_id}")
    assert get_response.status_code == 404

@pytest.mark.asyncio
async def test_create_location(client):
    """Test creating a new location"""
    location_data = {
        "name": "Test Location",
        "address": "123 Test St",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "zone": "Zone A"
    }
    
    response = await client.post("/api/locations", json=location_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == 1
    assert data["name"] == "Test Location"
    assert data["address"] == "123 Test St"
    assert data["latitude"] == 40.7128
    assert data["longitude"] == -74.0060
    assert data["zone"] == "Zone A"

@pytest.mark.asyncio
async def test_get_locations(client):
    """Test getting all locations"""
    # Create a location first
    location_data = {
        "name": "Test Location",
        "address": "123 Test St",
        "latitude": 40.7128,
        "longitude": -74.0060,
        "zone": "Zone A"
    }
    
    await client.post("/api/locations", json=location_data)
    
    response = await client.get("/api/locations")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Test Location"

@pytest.mark.asyncio
async def test_get_analytics(client):
    """Test getting analytics data"""
    # Create some test data first
    collection_data = {
        "location": "Test Location",
        "waste_type": "plastic",
        "quantity": 10.5,
        "unit": "kg",
        "collected_date": "2024-01-01T10:00:00",
        "status": "pending"
    }
    
    await client.post("/api/collections", json=collection_data)
    
    response = await client.get("/api/analytics")
    assert response.status_code == 200
    
    data = response.json()
    assert data["total_collections"] == 1
    assert data["pending_collections"] == 1
    assert data["completed_collections"] == 0
    assert "waste_by_type" in data
    assert data["waste_by_type"]["plastic"] == 10.5