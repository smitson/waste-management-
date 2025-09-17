// Modern JavaScript for Waste Management System
class WasteManagementApp {
    constructor() {
        this.baseURL = window.location.origin;
        this.currentSection = 'dashboard';
        this.collections = [];
        this.locations = [];
        this.analytics = {};
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadData();
        this.updateDashboard();
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.textContent.toLowerCase();
                this.showSection(section);
            });
        });
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('section--active');
        });
        
        // Show target section
        const targetSection = document.getElementById(sectionName);
        if (targetSection) {
            targetSection.classList.add('section--active');
            this.currentSection = sectionName;
        }
        
        // Update nav buttons
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.toLowerCase() === sectionName) {
                btn.classList.add('active');
            }
        });

        // Load section-specific data
        this.loadSectionData(sectionName);
    }

    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'collections':
                await this.loadCollections();
                this.renderCollections();
                break;
            case 'locations':
                await this.loadLocations();
                this.renderLocations();
                break;
            case 'analytics':
                await this.loadAnalytics();
                this.renderAnalytics();
                break;
            case 'dashboard':
                await this.loadData();
                this.updateDashboard();
                break;
        }
    }

    async loadData() {
        try {
            await Promise.all([
                this.loadCollections(),
                this.loadLocations(),
                this.loadAnalytics()
            ]);
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data');
        }
    }

    async loadCollections() {
        try {
            const response = await fetch(`${this.baseURL}/api/collections`);
            this.collections = await response.json();
        } catch (error) {
            console.error('Error loading collections:', error);
            this.collections = [];
        }
    }

    async loadLocations() {
        try {
            const response = await fetch(`${this.baseURL}/api/locations`);
            this.locations = await response.json();
        } catch (error) {
            console.error('Error loading locations:', error);
            this.locations = [];
        }
    }

    async loadAnalytics() {
        try {
            const response = await fetch(`${this.baseURL}/api/analytics`);
            this.analytics = await response.json();
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.analytics = {};
        }
    }

    updateDashboard() {
        const totalCollections = this.analytics.total_collections || 0;
        const pendingCollections = this.analytics.pending_collections || 0;
        const completedCollections = this.analytics.completed_collections || 0;
        const totalLocations = this.locations.length || 0;

        document.getElementById('total-collections').textContent = totalCollections;
        document.getElementById('pending-collections').textContent = pendingCollections;
        document.getElementById('completed-collections').textContent = completedCollections;
        document.getElementById('total-locations').textContent = totalLocations;
    }

    renderCollections() {
        const container = document.getElementById('collections-list');
        
        if (this.collections.length === 0) {
            container.innerHTML = '<div class="card"><p>No collections found. Add your first collection!</p></div>';
            return;
        }

        container.innerHTML = this.collections.map(collection => `
            <div class="collection-item">
                <div class="collection-item__header">
                    <div>
                        <div class="collection-item__title">${collection.location}</div>
                        <span class="status-badge status-badge--${collection.status}">${collection.status}</span>
                    </div>
                    <div>
                        <button class="btn btn--warning btn--sm" onclick="app.updateCollectionStatus(${collection.id}, '${collection.status === 'pending' ? 'completed' : 'pending'}')">
                            ${collection.status === 'pending' ? 'Mark Complete' : 'Mark Pending'}
                        </button>
                        <button class="btn btn--danger btn--sm" onclick="app.deleteCollection(${collection.id})">Delete</button>
                    </div>
                </div>
                <div class="collection-item__details">
                    <div class="detail-item">
                        <div class="detail-item__label">Waste Type</div>
                        <div class="detail-item__value">${collection.waste_type}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item__label">Quantity</div>
                        <div class="detail-item__value">${collection.quantity} ${collection.unit}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item__label">Date</div>
                        <div class="detail-item__value">${new Date(collection.collected_date).toLocaleDateString()}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderLocations() {
        const container = document.getElementById('locations-list');
        
        if (this.locations.length === 0) {
            container.innerHTML = '<div class="card"><p>No locations found. Add your first location!</p></div>';
            return;
        }

        container.innerHTML = this.locations.map(location => `
            <div class="location-item">
                <div class="location-item__header">
                    <div class="location-item__title">${location.name}</div>
                    <button class="btn btn--danger btn--sm" onclick="app.deleteLocation(${location.id})">Delete</button>
                </div>
                <div class="location-item__details">
                    <div class="detail-item">
                        <div class="detail-item__label">Address</div>
                        <div class="detail-item__value">${location.address}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item__label">Zone</div>
                        <div class="detail-item__value">${location.zone}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-item__label">Coordinates</div>
                        <div class="detail-item__value">${location.latitude}, ${location.longitude}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderAnalytics() {
        const wasteByTypeContainer = document.getElementById('waste-by-type');
        const wasteByType = this.analytics.waste_by_type || {};
        
        if (Object.keys(wasteByType).length === 0) {
            wasteByTypeContainer.innerHTML = '<p>No waste data available.</p>';
            return;
        }

        const maxQuantity = Math.max(...Object.values(wasteByType));
        
        wasteByTypeContainer.innerHTML = Object.entries(wasteByType).map(([type, quantity]) => {
            const percentage = (quantity / maxQuantity) * 100;
            return `
                <div class="waste-type-item">
                    <div>
                        <strong>${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                        <div class="waste-type-bar" style="width: ${percentage}%"></div>
                    </div>
                    <span>${quantity} units</span>
                </div>
            `;
        }).join('');
    }

    showAddCollectionForm() {
        document.getElementById('add-collection-form').style.display = 'block';
    }

    hideAddCollectionForm() {
        document.getElementById('add-collection-form').style.display = 'none';
        this.resetCollectionForm();
    }

    showAddLocationForm() {
        document.getElementById('add-location-form').style.display = 'block';
    }

    hideAddLocationForm() {
        document.getElementById('add-location-form').style.display = 'none';
        this.resetLocationForm();
    }

    resetCollectionForm() {
        document.getElementById('location').value = '';
        document.getElementById('waste-type').value = '';
        document.getElementById('quantity').value = '';
        document.getElementById('unit').value = '';
    }

    resetLocationForm() {
        document.getElementById('location-name').value = '';
        document.getElementById('location-address').value = '';
        document.getElementById('latitude').value = '';
        document.getElementById('longitude').value = '';
        document.getElementById('zone').value = '';
    }

    async addCollection(event) {
        event.preventDefault();
        
        const collectionData = {
            location: document.getElementById('location').value,
            waste_type: document.getElementById('waste-type').value,
            quantity: parseFloat(document.getElementById('quantity').value),
            unit: document.getElementById('unit').value,
            collected_date: new Date().toISOString(),
            status: 'pending'
        };

        try {
            const response = await fetch(`${this.baseURL}/api/collections`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(collectionData)
            });

            if (response.ok) {
                await this.loadCollections();
                this.renderCollections();
                this.hideAddCollectionForm();
                this.showSuccess('Collection added successfully!');
                await this.loadAnalytics();
                this.updateDashboard();
            } else {
                throw new Error('Failed to add collection');
            }
        } catch (error) {
            console.error('Error adding collection:', error);
            this.showError('Failed to add collection');
        }
    }

    async addLocation(event) {
        event.preventDefault();
        
        const locationData = {
            name: document.getElementById('location-name').value,
            address: document.getElementById('location-address').value,
            latitude: parseFloat(document.getElementById('latitude').value),
            longitude: parseFloat(document.getElementById('longitude').value),
            zone: document.getElementById('zone').value
        };

        try {
            const response = await fetch(`${this.baseURL}/api/locations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(locationData)
            });

            if (response.ok) {
                await this.loadLocations();
                this.renderLocations();
                this.hideAddLocationForm();
                this.showSuccess('Location added successfully!');
                this.updateDashboard();
            } else {
                throw new Error('Failed to add location');
            }
        } catch (error) {
            console.error('Error adding location:', error);
            this.showError('Failed to add location');
        }
    }

    async updateCollectionStatus(id, newStatus) {
        try {
            const collection = this.collections.find(c => c.id === id);
            if (!collection) return;

            const updatedCollection = { ...collection, status: newStatus };
            
            const response = await fetch(`${this.baseURL}/api/collections/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(updatedCollection)
            });

            if (response.ok) {
                await this.loadCollections();
                this.renderCollections();
                await this.loadAnalytics();
                this.updateDashboard();
                this.showSuccess('Collection status updated!');
            } else {
                throw new Error('Failed to update collection status');
            }
        } catch (error) {
            console.error('Error updating collection status:', error);
            this.showError('Failed to update collection status');
        }
    }

    async deleteCollection(id) {
        if (!confirm('Are you sure you want to delete this collection?')) {
            return;
        }

        try {
            const response = await fetch(`${this.baseURL}/api/collections/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadCollections();
                this.renderCollections();
                await this.loadAnalytics();
                this.updateDashboard();
                this.showSuccess('Collection deleted successfully!');
            } else {
                throw new Error('Failed to delete collection');
            }
        } catch (error) {
            console.error('Error deleting collection:', error);
            this.showError('Failed to delete collection');
        }
    }

    async deleteLocation(id) {
        if (!confirm('Are you sure you want to delete this location?')) {
            return;
        }

        try {
            const response = await fetch(`${this.baseURL}/api/locations/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                await this.loadLocations();
                this.renderLocations();
                this.updateDashboard();
                this.showSuccess('Location deleted successfully!');
            } else {
                throw new Error('Failed to delete location');
            }
        } catch (error) {
            console.error('Error deleting location:', error);
            this.showError('Failed to delete location');
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.textContent = message;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            background-color: ${type === 'success' ? '#10b981' : '#ef4444'};
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }
}

// Global functions for HTML onclick handlers
function showSection(sectionName) {
    app.showSection(sectionName);
}

function showAddCollectionForm() {
    app.showAddCollectionForm();
}

function hideAddCollectionForm() {
    app.hideAddCollectionForm();
}

function showAddLocationForm() {
    app.showAddLocationForm();
}

function hideAddLocationForm() {
    app.hideAddLocationForm();
}

function addCollection(event) {
    app.addCollection(event);
}

function addLocation(event) {
    app.addLocation(event);
}

// Initialize the app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new WasteManagementApp();
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);