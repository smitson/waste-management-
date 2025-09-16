from fastapi import FastAPI, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from datetime import datetime
import os

app = FastAPI(
    title="Waste Management System",
    description="A modern waste management system with tracking and analytics",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# Pydantic models
class WasteCollection(BaseModel):
    id: Optional[int] = None
    location: str
    waste_type: str
    quantity: float
    unit: str
    collected_date: datetime
    status: str = "pending"

class Location(BaseModel):
    id: Optional[int] = None
    name: str
    address: str
    latitude: float
    longitude: float
    zone: str

# In-memory storage (replace with database in production)
waste_collections = []
locations = []
collection_id_counter = 1
location_id_counter = 1

@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Serve the main frontend page"""
    try:
        with open("frontend/index.html", "r") as f:
            html_content = f.read()
        return HTMLResponse(content=html_content)
    except FileNotFoundError:
        return HTMLResponse(content="<h1>Waste Management System</h1><p>Frontend not found. Please ensure frontend files are in place.</p>")

@app.get("/api/collections", response_model=List[WasteCollection])
async def get_collections():
    """Get all waste collections"""
    return waste_collections

@app.post("/api/collections", response_model=WasteCollection)
async def create_collection(collection: WasteCollection):
    """Create a new waste collection record"""
    global collection_id_counter
    collection.id = collection_id_counter
    collection_id_counter += 1
    waste_collections.append(collection)
    return collection

@app.get("/api/collections/{collection_id}", response_model=WasteCollection)
async def get_collection(collection_id: int):
    """Get a specific waste collection by ID"""
    for collection in waste_collections:
        if collection.id == collection_id:
            return collection
    raise HTTPException(status_code=404, detail="Collection not found")

@app.put("/api/collections/{collection_id}", response_model=WasteCollection)
async def update_collection(collection_id: int, updated_collection: WasteCollection):
    """Update a waste collection"""
    for i, collection in enumerate(waste_collections):
        if collection.id == collection_id:
            updated_collection.id = collection_id
            waste_collections[i] = updated_collection
            return updated_collection
    raise HTTPException(status_code=404, detail="Collection not found")

@app.delete("/api/collections/{collection_id}")
async def delete_collection(collection_id: int):
    """Delete a waste collection"""
    for i, collection in enumerate(waste_collections):
        if collection.id == collection_id:
            del waste_collections[i]
            return {"message": "Collection deleted successfully"}
    raise HTTPException(status_code=404, detail="Collection not found")

@app.get("/api/locations", response_model=List[Location])
async def get_locations():
    """Get all locations"""
    return locations

@app.post("/api/locations", response_model=Location)
async def create_location(location: Location):
    """Create a new location"""
    global location_id_counter
    location.id = location_id_counter
    location_id_counter += 1
    locations.append(location)
    return location

@app.get("/api/analytics")
async def get_analytics():
    """Get waste collection analytics"""
    total_collections = len(waste_collections)
    pending_collections = len([c for c in waste_collections if c.status == "pending"])
    completed_collections = len([c for c in waste_collections if c.status == "completed"])
    
    waste_by_type = {}
    for collection in waste_collections:
        if collection.waste_type in waste_by_type:
            waste_by_type[collection.waste_type] += collection.quantity
        else:
            waste_by_type[collection.waste_type] = collection.quantity
    
    return {
        "total_collections": total_collections,
        "pending_collections": pending_collections,
        "completed_collections": completed_collections,
        "waste_by_type": waste_by_type
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now()}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)