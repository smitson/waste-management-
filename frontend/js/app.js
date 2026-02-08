// Modern JavaScript for UK Waste Management & Compliance System v2.0
import { renderBarChart } from './chart.js';

class WasteManagementApp {
    constructor() {
        this.baseURL = window.location.origin;
        this.currentSection = 'dashboard';
        this.collections = [];
        this.locations = [];
        this.analytics = {};
        this.token = localStorage.getItem('wm_token');
        this.user = JSON.parse(localStorage.getItem('wm_user') || 'null');

        this.init();
    }

    async init() {
        if (this.token && this.user) {
            this.showMainApp();
            this.bindEvents();
            await this.loadOrgDashboard();
            this.initPackagingComparison();
            this.initPackagingReportDownload();
        } else {
            this.showAuthPanel();
        }
    }

    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
        return headers;
    }

    showAuthPanel() {
        document.getElementById('auth-panel').style.display = 'flex';
        document.getElementById('main-app').style.display = 'none';
    }

    showMainApp() {
        document.getElementById('auth-panel').style.display = 'none';
        document.getElementById('main-app').style.display = 'block';
        if (this.user) {
            document.getElementById('user-org-name').textContent = this.user.org_name || '';
            document.getElementById('user-display-name').textContent =
                `${this.user.first_name || ''} ${this.user.last_name || ''}`.trim() || this.user.email;
            document.getElementById('user-role').textContent = this.user.role;
        }
    }

    async login(email, password) {
        const res = await fetch(`${this.baseURL}/api/org/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');

        this.token = data.data.token;
        this.user = data.data.user;
        localStorage.setItem('wm_token', this.token);
        localStorage.setItem('wm_user', JSON.stringify(this.user));

        this.showMainApp();
        this.bindEvents();
        await this.loadOrgDashboard();
        this.initPackagingComparison();
        this.initPackagingReportDownload();
    }

    async register(orgData) {
        const res = await fetch(`${this.baseURL}/api/org/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orgData)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');

        this.token = data.data.token;
        this.user = data.data.user;
        this.user.org_name = data.data.organization.name;
        localStorage.setItem('wm_token', this.token);
        localStorage.setItem('wm_user', JSON.stringify(this.user));

        this.showMainApp();
        this.bindEvents();
        await this.loadOrgDashboard();
        this.initPackagingComparison();
        this.initPackagingReportDownload();
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('wm_token');
        localStorage.removeItem('wm_user');
        this.showAuthPanel();
    }

    // --- Organisation Dashboard ---
    async loadOrgDashboard() {
        try {
            const res = await fetch(`${this.baseURL}/api/org/dashboard`, { headers: this.getHeaders() });
            if (!res.ok) {
                if (res.status === 401) { this.logout(); return; }
                throw new Error('Failed to load dashboard');
            }
            const data = await res.json();
            const d = data.data;

            document.getElementById('total-collections').textContent = d.packaging_stats?.total_items || 0;
            document.getElementById('pending-collections').textContent = d.packaging_stats?.active_items || 0;
            document.getElementById('completed-collections').textContent = d.packaging_stats?.total_cycles || 0;
            document.getElementById('total-locations').textContent = d.unread_alerts || 0;

            // Upcoming deadlines
            const deadlinesDiv = document.getElementById('upcoming-deadlines');
            if (d.upcoming_deadlines && d.upcoming_deadlines.length > 0) {
                deadlinesDiv.innerHTML = d.upcoming_deadlines.map(dl =>
                    `<div class="deadline-item">
                        <strong>${dl.title}</strong>
                        <span class="deadline-date">${dl.deadline_date}</span>
                        <span class="badge badge--${dl.regulation_type.toLowerCase()}">${dl.regulation_type}</span>
                    </div>`
                ).join('');
            } else {
                deadlinesDiv.innerHTML = '<p>No upcoming deadlines</p>';
            }

            // Compliance summary
            const compDiv = document.getElementById('compliance-summary');
            if (d.compliance_breakdown && d.compliance_breakdown.length > 0) {
                compDiv.innerHTML = d.compliance_breakdown.map(c =>
                    `<div class="compliance-stat">
                        <span class="status-badge status-badge--${c.compliance_status}">${c.compliance_status}</span>
                        <strong>${c.count}</strong>
                    </div>`
                ).join('');
            } else {
                compDiv.innerHTML = '<p>No compliance records yet</p>';
            }

            // Alert banner
            if (d.unread_alerts > 0) {
                document.getElementById('alert-banner').innerHTML =
                    `<div class="notification notification--warning">
                        You have ${d.unread_alerts} unread compliance alert(s).
                        <a href="#" onclick="showSection('compliance'); return false;">View alerts</a>
                    </div>`;
            }
        } catch (err) {
            console.error('Dashboard error:', err);
        }
    }

    // --- Compliance Features ---
    async runComplianceCheck() {
        try {
            const res = await fetch(`${this.baseURL}/api/compliance/check`, {
                method: 'POST',
                headers: this.getHeaders()
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            this.showSuccess(`Compliance check complete: ${data.data.alerts_generated} alerts generated`);
            await this.loadAlerts();
        } catch (err) {
            this.showError(err.message);
        }
    }

    async loadAlerts() {
        try {
            const res = await fetch(`${this.baseURL}/api/compliance/alerts?is_resolved=false`, { headers: this.getHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const container = document.getElementById('alerts-list');
            if (data.data.length === 0) {
                container.innerHTML = '<p>No active alerts. All clear!</p>';
                return;
            }

            container.innerHTML = data.data.map(alert => `
                <div class="alert-item alert-item--${alert.severity}">
                    <div class="alert-item__header">
                        <span class="badge badge--${alert.severity}">${alert.severity.toUpperCase()}</span>
                        <strong>${alert.title}</strong>
                        <span class="badge">${alert.regulation_type || ''}</span>
                    </div>
                    <p>${alert.message || ''}</p>
                    <div class="alert-item__actions">
                        <button class="btn btn--sm btn--secondary" onclick="app.resolveAlert(${alert.id})">Resolve</button>
                        <span class="text-muted">${new Date(alert.created_at).toLocaleDateString()}</span>
                    </div>
                </div>
            `).join('');
        } catch (err) {
            console.error('Load alerts error:', err);
        }
    }

    async resolveAlert(alertId) {
        try {
            await fetch(`${this.baseURL}/api/compliance/alerts/${alertId}/resolve`, {
                method: 'PUT',
                headers: this.getHeaders()
            });
            await this.loadAlerts();
            this.showSuccess('Alert resolved');
        } catch (err) {
            this.showError(err.message);
        }
    }

    async loadCalendar() {
        try {
            const res = await fetch(`${this.baseURL}/api/compliance/calendar`, { headers: this.getHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const container = document.getElementById('calendar-content');
            const cal = data.data;

            let html = `<div class="calendar-summary">
                <span class="badge badge--critical">Overdue: ${cal.summary.overdue}</span>
                <span class="badge badge--medium">Due Soon: ${cal.summary.due_soon}</span>
                <span class="badge badge--low">Upcoming: ${cal.summary.upcoming}</span>
                <span class="badge badge--completed">Completed: ${cal.summary.completed}</span>
            </div>`;

            const renderDeadlines = (deadlines, title) => {
                if (deadlines.length === 0) return '';
                return `<h4>${title}</h4>` + deadlines.map(d => `
                    <div class="deadline-row deadline-row--${d.status_computed || d.status}">
                        <div>
                            <strong>${d.title}</strong>
                            <span class="text-muted">${d.description || ''}</span>
                        </div>
                        <div>
                            <span class="badge badge--${(d.regulation_type || '').toLowerCase()}">${d.regulation_type}</span>
                            <span>${d.deadline_date}</span>
                            ${d.days_until_deadline !== undefined ? `<span>(${d.days_until_deadline}d)</span>` : ''}
                            ${d.status !== 'completed' ? `<button class="btn btn--sm btn--primary" onclick="app.completeDeadline(${d.id})">Complete</button>` : ''}
                        </div>
                    </div>
                `).join('');
            };

            html += renderDeadlines(cal.deadlines.overdue, 'Overdue');
            html += renderDeadlines(cal.deadlines.due_soon, 'Due Soon');
            html += renderDeadlines(cal.deadlines.upcoming, 'Upcoming');
            html += renderDeadlines(cal.deadlines.completed, 'Completed');

            container.innerHTML = html;
        } catch (err) {
            console.error('Load calendar error:', err);
        }
    }

    async completeDeadline(deadlineId) {
        await fetch(`${this.baseURL}/api/compliance/calendar/${deadlineId}/complete`, {
            method: 'PUT',
            headers: this.getHeaders()
        });
        await this.loadCalendar();
        this.showSuccess('Deadline marked complete');
    }

    async loadEPRReport() {
        try {
            const res = await fetch(`${this.baseURL}/api/compliance/epr-report`, { headers: this.getHeaders() });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const report = data.data;
            const container = document.getElementById('epr-report-content');

            container.innerHTML = `
                <div class="epr-report">
                    <div class="report-header">
                        <h3>EPR Compliance Report - ${report.organization.name}</h3>
                        <p>Period: ${report.period.year} ${report.period.quarter !== 'annual' ? 'Q' + report.period.quarter : 'Annual'}</p>
                        <p>Generated: ${new Date(report.generated_at).toLocaleString()}</p>
                    </div>
                    <div class="dashboard-grid">
                        <div class="card"><h4>Total Items</h4><div class="metric">${report.executive_summary.total_packaging_items}</div></div>
                        <div class="card"><h4>Total Weight</h4><div class="metric">${report.executive_summary.total_weight_kg} kg</div></div>
                        <div class="card"><h4>EPR Liability</h4><div class="metric">&pound;${report.executive_summary.estimated_epr_liability_gbp}</div></div>
                        <div class="card"><h4>PPT Liability</h4><div class="metric">&pound;${report.executive_summary.estimated_ppt_liability_gbp}</div></div>
                    </div>
                    <h4>Material Breakdown</h4>
                    <table class="comparison-table">
                        <thead><tr>
                            <th>Material</th><th>Category</th><th>Items</th><th>Weight (kg)</th>
                            <th>EPR (GBP)</th><th>PPT (GBP)</th><th>Reuse Cycles</th>
                        </tr></thead>
                        <tbody>
                            ${report.material_breakdown.map(m => `<tr>
                                <td>${m.material_name}</td><td>${m.category}</td><td>${m.total_items}</td>
                                <td>${m.total_weight_kg}</td><td>&pound;${m.epr_cost_gbp}</td>
                                <td>&pound;${m.ppt_cost_gbp}</td><td>${m.total_reuse_cycles}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                    <div class="report-notes">
                        <h4>Regulatory Notes</h4>
                        <ul>${report.regulatory_notes.map(n => `<li>${n}</li>`).join('')}</ul>
                    </div>
                </div>
            `;

            showComplianceTab('epr-report');
        } catch (err) {
            this.showError(err.message);
        }
    }

    async downloadEPRCSV() {
        try {
            const res = await fetch(`${this.baseURL}/api/compliance/epr-report?format=csv`, { headers: this.getHeaders() });
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'epr_report.csv';
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { window.URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
        } catch (err) {
            this.showError(err.message);
        }
    }

    // --- Bulk Import ---
    async handleBulkImport(file) {
        const formData = new FormData();
        formData.append('file', file);

        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        try {
            const res = await fetch(`${this.baseURL}/api/import/packaging`, {
                method: 'POST', headers, body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const container = document.getElementById('import-results');
            container.innerHTML = `
                <div class="card">
                    <h3>Import Results</h3>
                    <div class="dashboard-grid">
                        <div class="card"><h4>Total Rows</h4><div class="metric">${data.data.total_rows}</div></div>
                        <div class="card"><h4>Imported</h4><div class="metric" style="color: #10b981">${data.data.successfully_imported}</div></div>
                        <div class="card"><h4>Errors</h4><div class="metric" style="color: #ef4444">${data.data.errors}</div></div>
                    </div>
                    ${data.data.error_details.length > 0 ? `
                        <h4>Error Details</h4>
                        <table class="comparison-table">
                            <thead><tr><th>Row</th><th>Errors</th></tr></thead>
                            <tbody>${data.data.error_details.map(e =>
                                `<tr><td>${e.row}</td><td>${e.errors.join('; ')}</td></tr>`
                            ).join('')}</tbody>
                        </table>
                    ` : ''}
                </div>
            `;
            this.showSuccess(data.data.message);
            await this.loadImportHistory();
        } catch (err) {
            this.showError(err.message);
        }
    }

    async handleValidateCSV(file) {
        const formData = new FormData();
        formData.append('file', file);

        const headers = {};
        if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

        try {
            const res = await fetch(`${this.baseURL}/api/import/validate`, {
                method: 'POST', headers, body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            const container = document.getElementById('import-results');
            container.innerHTML = `
                <div class="card">
                    <h3>Validation Results</h3>
                    <div class="dashboard-grid">
                        <div class="card"><h4>Total Rows</h4><div class="metric">${data.data.total_rows}</div></div>
                        <div class="card"><h4>Valid</h4><div class="metric" style="color: #10b981">${data.data.valid_rows}</div></div>
                        <div class="card"><h4>Invalid</h4><div class="metric" style="color: #ef4444">${data.data.invalid_rows}</div></div>
                    </div>
                    ${data.data.errors.length > 0 ? `
                        <h4>Errors Found</h4>
                        <table class="comparison-table">
                            <thead><tr><th>Row</th><th>Errors</th></tr></thead>
                            <tbody>${data.data.errors.map(e =>
                                `<tr><td>${e.row}</td><td>${e.errors.join('; ')}</td></tr>`
                            ).join('')}</tbody>
                        </table>
                    ` : '<p>All rows valid! Ready to import.</p>'}
                </div>
            `;
        } catch (err) {
            this.showError(err.message);
        }
    }

    async loadImportHistory() {
        try {
            const res = await fetch(`${this.baseURL}/api/import/jobs`, { headers: this.getHeaders() });
            const data = await res.json();
            if (!res.ok) return;

            const container = document.getElementById('import-history');
            if (data.data.length === 0) {
                container.innerHTML = '<p>No import history</p>';
                return;
            }
            container.innerHTML = `
                <table class="comparison-table">
                    <thead><tr><th>File</th><th>Status</th><th>Rows</th><th>Success</th><th>Errors</th><th>Date</th></tr></thead>
                    <tbody>${data.data.map(j => `
                        <tr>
                            <td>${j.filename}</td>
                            <td><span class="badge badge--${j.status === 'completed' ? 'completed' : 'medium'}">${j.status}</span></td>
                            <td>${j.total_rows}</td><td>${j.success_count}</td><td>${j.error_count}</td>
                            <td>${new Date(j.created_at).toLocaleDateString()}</td>
                        </tr>
                    `).join('')}</tbody>
                </table>
            `;
        } catch (err) {
            console.error('Load import history error:', err);
        }
    }

    // --- Settings: Users ---
    async loadUsers() {
        try {
            const res = await fetch(`${this.baseURL}/api/org/users`, { headers: this.getHeaders() });
            const data = await res.json();
            if (!res.ok) { document.getElementById('users-list').innerHTML = `<p>${data.error}</p>`; return; }

            document.getElementById('users-list').innerHTML = `
                <table class="comparison-table">
                    <thead><tr><th>Email</th><th>Name</th><th>Role</th><th>Status</th><th>Last Login</th><th>Actions</th></tr></thead>
                    <tbody>${data.data.map(u => `
                        <tr>
                            <td>${u.email}</td><td>${u.first_name || ''} ${u.last_name || ''}</td>
                            <td><span class="role-badge">${u.role}</span></td>
                            <td>${u.is_active ? 'Active' : 'Inactive'}</td>
                            <td>${u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
                            <td>${u.id !== this.user.id ? `<button class="btn btn--sm btn--danger" onclick="app.deleteUser('${u.id}')">Remove</button>` : ''}</td>
                        </tr>
                    `).join('')}</tbody>
                </table>
            `;
        } catch (err) { console.error('Load users error:', err); }
    }

    async addUser(email, password, firstName, lastName, role) {
        const res = await fetch(`${this.baseURL}/api/org/users`, {
            method: 'POST', headers: this.getHeaders(),
            body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName, role })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        this.showSuccess('User added');
        await this.loadUsers();
    }

    async deleteUser(userId) {
        if (!confirm('Remove this user?')) return;
        await fetch(`${this.baseURL}/api/org/users/${userId}`, { method: 'DELETE', headers: this.getHeaders() });
        await this.loadUsers();
    }

    // --- Settings: API Keys ---
    async loadApiKeys() {
        try {
            const res = await fetch(`${this.baseURL}/api/org/api-keys`, { headers: this.getHeaders() });
            const data = await res.json();
            if (!res.ok) { document.getElementById('api-keys-list').innerHTML = `<p>${data.error}</p>`; return; }

            document.getElementById('api-keys-list').innerHTML = `
                <table class="comparison-table">
                    <thead><tr><th>Name</th><th>Prefix</th><th>Permissions</th><th>Status</th><th>Last Used</th><th>Actions</th></tr></thead>
                    <tbody>${data.data.map(k => `
                        <tr>
                            <td>${k.name}</td><td><code>${k.key_prefix}...</code></td>
                            <td>${k.permissions.join(', ')}</td><td>${k.is_active ? 'Active' : 'Revoked'}</td>
                            <td>${k.last_used ? new Date(k.last_used).toLocaleDateString() : 'Never'}</td>
                            <td>${k.is_active ? `<button class="btn btn--sm btn--danger" onclick="app.revokeApiKey('${k.id}')">Revoke</button>` : ''}</td>
                        </tr>
                    `).join('')}</tbody>
                </table>
            `;
        } catch (err) { console.error('Load API keys error:', err); }
    }

    async createApiKey(name, permissions) {
        const res = await fetch(`${this.baseURL}/api/org/api-keys`, {
            method: 'POST', headers: this.getHeaders(),
            body: JSON.stringify({ name, permissions })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        alert(`API Key created!\n\nKey: ${data.data.key}\n\n${data.data.warning}`);
        await this.loadApiKeys();
    }

    async revokeApiKey(keyId) {
        if (!confirm('Revoke this API key?')) return;
        await fetch(`${this.baseURL}/api/org/api-keys/${keyId}`, { method: 'DELETE', headers: this.getHeaders() });
        await this.loadApiKeys();
    }

    // --- Settings: Webhooks ---
    async loadWebhooks() {
        try {
            const res = await fetch(`${this.baseURL}/api/import/webhooks`, { headers: this.getHeaders() });
            const data = await res.json();
            if (!res.ok) { document.getElementById('webhooks-list').innerHTML = `<p>${data.error}</p>`; return; }

            document.getElementById('webhooks-list').innerHTML = `
                <table class="comparison-table">
                    <thead><tr><th>Name</th><th>URL</th><th>Events</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>${data.data.map(w => `
                        <tr>
                            <td>${w.name}</td><td><code>${w.url}</code></td>
                            <td>${w.events.join(', ')}</td><td>${w.is_active ? 'Active' : 'Inactive'}</td>
                            <td>
                                <button class="btn btn--sm btn--secondary" onclick="app.toggleWebhook('${w.id}')">${w.is_active ? 'Disable' : 'Enable'}</button>
                                <button class="btn btn--sm btn--danger" onclick="app.deleteWebhook('${w.id}')">Delete</button>
                            </td>
                        </tr>
                    `).join('')}</tbody>
                </table>
            `;
        } catch (err) { console.error('Load webhooks error:', err); }
    }

    async addWebhook(name, url, secret) {
        const res = await fetch(`${this.baseURL}/api/import/webhooks`, {
            method: 'POST', headers: this.getHeaders(),
            body: JSON.stringify({ name, url, secret })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        this.showSuccess('Webhook created');
        await this.loadWebhooks();
    }

    async toggleWebhook(id) {
        await fetch(`${this.baseURL}/api/import/webhooks/${id}/toggle`, { method: 'PUT', headers: this.getHeaders() });
        await this.loadWebhooks();
    }

    async deleteWebhook(id) {
        if (!confirm('Delete this webhook?')) return;
        await fetch(`${this.baseURL}/api/import/webhooks/${id}`, { method: 'DELETE', headers: this.getHeaders() });
        await this.loadWebhooks();
    }

    // --- Settings: Org Info ---
    async loadOrgInfo() {
        try {
            const res = await fetch(`${this.baseURL}/api/org/me`, { headers: this.getHeaders() });
            const data = await res.json();
            if (!res.ok) return;

            const org = data.data;
            document.getElementById('org-details').innerHTML = `
                <div class="org-info">
                    <div class="dashboard-grid">
                        <div class="card"><h4>Organisation</h4><p>${org.name}</p></div>
                        <div class="card"><h4>Plan</h4><p>${org.subscription_tier}</p></div>
                        <div class="card"><h4>Users</h4><p>${org.usage.users} / ${org.usage.max_users}</p></div>
                        <div class="card"><h4>Items</h4><p>${org.usage.items} / ${org.usage.max_items}</p></div>
                    </div>
                    <table class="comparison-table" style="margin-top: 1rem;">
                        <tr><th>Industry</th><td>${org.industry || '-'}</td></tr>
                        <tr><th>Company Number</th><td>${org.company_number || '-'}</td></tr>
                        <tr><th>Address</th><td>${org.address || '-'}</td></tr>
                        <tr><th>Contact Email</th><td>${org.contact_email || '-'}</td></tr>
                        <tr><th>Contact Phone</th><td>${org.contact_phone || '-'}</td></tr>
                        <tr><th>Created</th><td>${new Date(org.created_at).toLocaleDateString()}</td></tr>
                    </table>
                </div>
            `;
        } catch (err) { console.error('Load org info error:', err); }
    }

    // --- Existing features ---
    initPackagingReportDownload() {
        const btn = document.getElementById('download-packaging-report');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            const idsInput = document.getElementById('packaging-ids').value.trim();
            if (!idsInput) { this.showError('Enter packaging IDs to download a report.'); return; }
            const ids = idsInput.split(',').map(s => s.trim()).filter(Boolean);
            if (ids.length === 0) { this.showError('Enter at least one packaging ID.'); return; }
            btn.disabled = true;
            btn.textContent = 'Downloading...';
            try {
                const response = await fetch(`${this.baseURL}/api/reports/packaging-detail`, {
                    method: 'POST', headers: this.getHeaders(),
                    body: JSON.stringify({ packagingIds: ids, format: 'csv' })
                });
                if (!response.ok) throw new Error('Failed to download report');
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'packaging_detail_report.csv';
                document.body.appendChild(a); a.click();
                setTimeout(() => { window.URL.revokeObjectURL(url); document.body.removeChild(a); }, 100);
            } catch (err) { this.showError(err.message); }
            finally { btn.disabled = false; btn.textContent = 'Download Report (CSV)'; }
        });
    }

    initPackagingComparison() {
        const form = document.getElementById('compare-packaging-form');
        if (!form) return;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idsInput = document.getElementById('packaging-ids').value.trim();
            if (!idsInput) return;
            const ids = idsInput.split(',').map(s => s.trim()).filter(Boolean);
            if (ids.length < 2) { this.showError('Please enter at least 2 packaging IDs.'); return; }
            await this.comparePackaging(ids);
        });
    }

    async comparePackaging(ids) {
        const resultsDiv = document.getElementById('packaging-comparison-results');
        const chartCanvas = document.getElementById('packaging-comparison-chart');
        resultsDiv.innerHTML = 'Comparing...';
        if (window._packagingChart) window._packagingChart.destroy();
        try {
            const response = await fetch(`${this.baseURL}/api/packaging/compare`, {
                method: 'POST', headers: this.getHeaders(),
                body: JSON.stringify({ packagingIds: ids })
            });
            const data = await response.json();
            if (!data.success) throw new Error(data.error || 'Comparison failed');
            const { comparison, summary } = data.data;
            resultsDiv.innerHTML = this.renderPackagingComparisonTable(comparison, summary);
            const labels = comparison.map(i => i.product_name || i.id);
            window._packagingChart = renderBarChart(
                chartCanvas.getContext('2d'), labels,
                [
                    { label: 'Cost (GBP)', data: comparison.map(i => i.cost_gbp), backgroundColor: '#2563eb' },
                    { label: 'CO2 (kg)', data: comparison.map(i => i.carbon_emissions_kg), backgroundColor: '#10b981' },
                    { label: 'EPR (GBP)', data: comparison.map(i => i.epr_cost_gbp), backgroundColor: '#f59e0b' },
                    { label: 'PPT (GBP)', data: comparison.map(i => i.ppt_cost_gbp), backgroundColor: '#ef4444' }
                ],
                { plugins: { title: { display: true, text: 'Packaging Comparison' } } }
            );
        } catch (err) {
            resultsDiv.innerHTML = `<div class="notification notification--error">${err.message}</div>`;
        }
    }

    renderPackagingComparisonTable(comparison, summary) {
        if (!comparison || comparison.length === 0) return '<p>No data to compare.</p>';
        let html = `<table class="comparison-table"><thead><tr>
            <th>Product</th><th>Material</th><th>Weight (kg)</th><th>Cost (GBP)</th><th>EPR (GBP)</th><th>PPT (GBP)</th><th>CO2 (kg)</th>
        </tr></thead><tbody>`;
        for (const item of comparison) {
            html += `<tr><td>${item.product_name || item.id}</td><td>${item.material}</td><td>${item.weight_kg}</td>
                <td>${item.cost_gbp}</td><td>${item.epr_cost_gbp}</td><td>${item.ppt_cost_gbp}</td><td>${item.carbon_emissions_kg}</td></tr>`;
        }
        html += `</tbody></table>`;
        if (summary) {
            html += `<div class="comparison-summary">
                <strong>Total Cost:</strong> GBP${summary.total_cost_gbp.toFixed(2)} |
                <strong>Total EPR:</strong> GBP${summary.total_epr_gbp.toFixed(2)} |
                <strong>Total PPT:</strong> GBP${summary.total_ppt_gbp.toFixed(2)} |
                <strong>Total CO2:</strong> ${summary.total_carbon_kg.toFixed(2)} kg
            </div>`;
        }
        return html;
    }

    bindEvents() {
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.textContent.toLowerCase().replace(/\s+/g, '-');
                this.showSection(section);
            });
        });
    }

    showSection(sectionName) {
        document.querySelectorAll('.section').forEach(s => s.classList.remove('section--active'));
        const target = document.getElementById(sectionName);
        if (target) { target.classList.add('section--active'); this.currentSection = sectionName; }
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.textContent.toLowerCase().replace(/\s+/g, '-') === sectionName) btn.classList.add('active');
        });
        this.loadSectionData(sectionName);
    }

    async loadSectionData(sectionName) {
        switch (sectionName) {
            case 'dashboard': await this.loadOrgDashboard(); break;
            case 'compliance': await this.loadAlerts(); await this.loadCalendar(); break;
            case 'bulk-import': await this.loadImportHistory(); break;
            case 'settings':
                await this.loadOrgInfo(); await this.loadUsers();
                await this.loadApiKeys(); await this.loadWebhooks();
                break;
            case 'collections': await this.loadCollections(); this.renderCollections(); break;
            case 'locations': await this.loadLocations(); this.renderLocations(); break;
            case 'analytics': await this.loadAnalytics(); this.renderAnalytics(); break;
        }
    }

    async loadCollections() {
        try { const r = await fetch(`${this.baseURL}/api/collections`, { headers: this.getHeaders() }); this.collections = await r.json(); }
        catch { this.collections = []; }
    }
    async loadLocations() {
        try { const r = await fetch(`${this.baseURL}/api/locations`, { headers: this.getHeaders() }); this.locations = await r.json(); }
        catch { this.locations = []; }
    }
    async loadAnalytics() {
        try { const r = await fetch(`${this.baseURL}/api/analytics`, { headers: this.getHeaders() }); this.analytics = await r.json(); }
        catch { this.analytics = {}; }
    }

    renderCollections() {
        const container = document.getElementById('collections-list');
        if (!this.collections || !Array.isArray(this.collections) || this.collections.length === 0) {
            container.innerHTML = '<div class="card"><p>No collections found.</p></div>'; return;
        }
        container.innerHTML = this.collections.map(c => `
            <div class="collection-item">
                <div class="collection-item__header">
                    <div><div class="collection-item__title">${c.location}</div>
                        <span class="status-badge status-badge--${c.status}">${c.status}</span></div>
                    <div>
                        <button class="btn btn--warning btn--sm" onclick="app.updateCollectionStatus(${c.id}, '${c.status === 'pending' ? 'completed' : 'pending'}')">${c.status === 'pending' ? 'Complete' : 'Pending'}</button>
                        <button class="btn btn--danger btn--sm" onclick="app.deleteCollection(${c.id})">Delete</button>
                    </div>
                </div>
                <div class="collection-item__details">
                    <div class="detail-item"><div class="detail-item__label">Type</div><div class="detail-item__value">${c.waste_type}</div></div>
                    <div class="detail-item"><div class="detail-item__label">Qty</div><div class="detail-item__value">${c.quantity} ${c.unit}</div></div>
                    <div class="detail-item"><div class="detail-item__label">Date</div><div class="detail-item__value">${new Date(c.collected_date).toLocaleDateString()}</div></div>
                </div>
            </div>`).join('');
    }

    renderLocations() {
        const container = document.getElementById('locations-list');
        if (!this.locations || !Array.isArray(this.locations) || this.locations.length === 0) {
            container.innerHTML = '<div class="card"><p>No locations found.</p></div>'; return;
        }
        container.innerHTML = this.locations.map(l => `
            <div class="location-item">
                <div class="location-item__header">
                    <div class="location-item__title">${l.name}</div>
                    <button class="btn btn--danger btn--sm" onclick="app.deleteLocation(${l.id})">Delete</button>
                </div>
                <div class="location-item__details">
                    <div class="detail-item"><div class="detail-item__label">Address</div><div class="detail-item__value">${l.address}</div></div>
                    <div class="detail-item"><div class="detail-item__label">Zone</div><div class="detail-item__value">${l.zone}</div></div>
                    <div class="detail-item"><div class="detail-item__label">Coords</div><div class="detail-item__value">${l.latitude}, ${l.longitude}</div></div>
                </div>
            </div>`).join('');
    }

    renderAnalytics() {
        const container = document.getElementById('waste-by-type');
        const wasteByType = this.analytics.waste_by_type || {};
        if (Object.keys(wasteByType).length === 0) { container.innerHTML = '<p>No waste data.</p>'; return; }
        const max = Math.max(...Object.values(wasteByType));
        container.innerHTML = Object.entries(wasteByType).map(([type, qty]) =>
            `<div class="waste-type-item"><div><strong>${type.charAt(0).toUpperCase() + type.slice(1)}</strong><div class="waste-type-bar" style="width: ${(qty / max) * 100}%"></div></div><span>${qty} units</span></div>`
        ).join('');
    }

    showAddCollectionForm() { document.getElementById('add-collection-form').style.display = 'block'; }
    hideAddCollectionForm() { document.getElementById('add-collection-form').style.display = 'none'; }
    showAddLocationForm() { document.getElementById('add-location-form').style.display = 'block'; }
    hideAddLocationForm() { document.getElementById('add-location-form').style.display = 'none'; }

    async addCollection(event) {
        event.preventDefault();
        try {
            const r = await fetch(`${this.baseURL}/api/collections`, {
                method: 'POST', headers: this.getHeaders(),
                body: JSON.stringify({
                    location: document.getElementById('location').value,
                    waste_type: document.getElementById('waste-type').value,
                    quantity: parseFloat(document.getElementById('quantity').value),
                    unit: document.getElementById('unit').value,
                    collected_date: new Date().toISOString(), status: 'pending'
                })
            });
            if (r.ok) { await this.loadCollections(); this.renderCollections(); this.hideAddCollectionForm(); this.showSuccess('Collection added!'); }
        } catch { this.showError('Failed to add collection'); }
    }

    async addLocation(event) {
        event.preventDefault();
        try {
            const r = await fetch(`${this.baseURL}/api/locations`, {
                method: 'POST', headers: this.getHeaders(),
                body: JSON.stringify({
                    name: document.getElementById('location-name').value,
                    address: document.getElementById('location-address').value,
                    latitude: parseFloat(document.getElementById('latitude').value),
                    longitude: parseFloat(document.getElementById('longitude').value),
                    zone: document.getElementById('zone').value
                })
            });
            if (r.ok) { await this.loadLocations(); this.renderLocations(); this.hideAddLocationForm(); this.showSuccess('Location added!'); }
        } catch { this.showError('Failed to add location'); }
    }

    async updateCollectionStatus(id, newStatus) {
        try {
            const c = this.collections.find(c => c.id === id);
            if (!c) return;
            const r = await fetch(`${this.baseURL}/api/collections/${id}`, {
                method: 'PUT', headers: this.getHeaders(), body: JSON.stringify({ ...c, status: newStatus })
            });
            if (r.ok) { await this.loadCollections(); this.renderCollections(); this.showSuccess('Status updated!'); }
        } catch { this.showError('Failed to update status'); }
    }

    async deleteCollection(id) {
        if (!confirm('Delete this collection?')) return;
        try {
            const r = await fetch(`${this.baseURL}/api/collections/${id}`, { method: 'DELETE', headers: this.getHeaders() });
            if (r.ok) { await this.loadCollections(); this.renderCollections(); this.showSuccess('Deleted!'); }
        } catch { this.showError('Failed to delete'); }
    }

    async deleteLocation(id) {
        if (!confirm('Delete this location?')) return;
        try {
            const r = await fetch(`${this.baseURL}/api/locations/${id}`, { method: 'DELETE', headers: this.getHeaders() });
            if (r.ok) { await this.loadLocations(); this.renderLocations(); this.showSuccess('Deleted!'); }
        } catch { this.showError('Failed to delete'); }
    }

    showSuccess(msg) { this.showNotification(msg, 'success'); }
    showError(msg) { this.showNotification(msg, 'error'); }
    showNotification(message, type) {
        const el = document.createElement('div');
        el.className = `notification notification--${type}`;
        el.textContent = message;
        el.style.cssText = `position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;color:white;font-weight:600;z-index:1000;animation:slideIn 0.3s ease;background-color:${type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#ef4444'};`;
        document.body.appendChild(el);
        setTimeout(() => { el.style.animation = 'slideOut 0.3s ease'; setTimeout(() => document.body.removeChild(el), 300); }, 3000);
    }
}

// Global functions for HTML onclick handlers
function showSection(s) { app.showSection(s); }
function showAddCollectionForm() { app.showAddCollectionForm(); }
function hideAddCollectionForm() { app.hideAddCollectionForm(); }
function showAddLocationForm() { app.showAddLocationForm(); }
function hideAddLocationForm() { app.hideAddLocationForm(); }
function addCollection(e) { app.addCollection(e); }
function addLocation(e) { app.addLocation(e); }

// Auth
function showRegisterForm() { document.getElementById('login-form').style.display = 'none'; document.getElementById('register-form').style.display = 'block'; }
function showLoginForm() { document.getElementById('register-form').style.display = 'none'; document.getElementById('login-form').style.display = 'block'; }
async function handleLogin(e) { e.preventDefault(); try { await app.login(document.getElementById('login-email').value, document.getElementById('login-password').value); } catch (err) { app.showError(err.message); } }
async function handleRegister(e) {
    e.preventDefault();
    try {
        await app.register({
            org_name: document.getElementById('reg-org-name').value,
            industry: document.getElementById('reg-industry').value,
            admin_email: document.getElementById('reg-email').value,
            admin_password: document.getElementById('reg-password').value,
            admin_first_name: document.getElementById('reg-first-name').value,
            admin_last_name: document.getElementById('reg-last-name').value
        });
    } catch (err) { app.showError(err.message); }
}
function handleLogout() { app.logout(); }

// Compliance
function runComplianceCheck() { app.runComplianceCheck(); }
function loadEPRReport() { app.loadEPRReport(); }
function downloadEPRCSV() { app.downloadEPRCSV(); }
function showComplianceTab(tab) {
    document.querySelectorAll('#compliance .tab-content').forEach(t => t.style.display = 'none');
    document.getElementById(`compliance-${tab}-tab`).style.display = 'block';
    document.querySelectorAll('#compliance .tab-btn').forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
}
function showAddDeadlineForm() { document.getElementById('add-deadline-form').style.display = 'block'; }
async function addDeadline(e) {
    e.preventDefault();
    const res = await fetch(`${app.baseURL}/api/compliance/calendar`, {
        method: 'POST', headers: app.getHeaders(),
        body: JSON.stringify({ title: document.getElementById('deadline-title').value, deadline_date: document.getElementById('deadline-date').value, regulation_type: document.getElementById('deadline-regulation').value, description: document.getElementById('deadline-description').value })
    });
    if (res.ok) { document.getElementById('add-deadline-form').style.display = 'none'; await app.loadCalendar(); app.showSuccess('Deadline added'); }
}

// Bulk import
async function handleBulkImport(e) { e.preventDefault(); const f = document.getElementById('csv-file').files[0]; if (f) await app.handleBulkImport(f); }
async function handleValidateCSV() { const f = document.getElementById('csv-file').files[0]; if (!f) { app.showError('Select a CSV file'); return; } await app.handleValidateCSV(f); }

// Settings
function showSettingsTab(tab) {
    document.querySelectorAll('#settings .tab-content').forEach(t => t.style.display = 'none');
    document.getElementById(`settings-${tab}-tab`).style.display = 'block';
    document.querySelectorAll('#settings .tab-btn').forEach(b => b.classList.remove('active'));
    if (event && event.target) event.target.classList.add('active');
}
function showAddUserForm() { document.getElementById('add-user-form').style.display = 'block'; }
async function addUser(e) {
    e.preventDefault();
    try {
        await app.addUser(document.getElementById('new-user-email').value, document.getElementById('new-user-password').value, document.getElementById('new-user-first').value, document.getElementById('new-user-last').value, document.getElementById('new-user-role').value);
        document.getElementById('add-user-form').style.display = 'none';
    } catch (err) { app.showError(err.message); }
}
function showAddApiKeyForm() { document.getElementById('add-api-key-form').style.display = 'block'; }
async function createApiKey(e) {
    e.preventDefault();
    const perms = Array.from(document.getElementById('api-key-permissions').selectedOptions).map(o => o.value);
    try { await app.createApiKey(document.getElementById('api-key-name').value, perms); document.getElementById('add-api-key-form').style.display = 'none'; }
    catch (err) { app.showError(err.message); }
}
function showAddWebhookForm() { document.getElementById('add-webhook-form').style.display = 'block'; }
async function addWebhook(e) {
    e.preventDefault();
    try { await app.addWebhook(document.getElementById('webhook-name').value, document.getElementById('webhook-url').value, document.getElementById('webhook-secret').value); document.getElementById('add-webhook-form').style.display = 'none'; }
    catch (err) { app.showError(err.message); }
}

// Init
document.addEventListener('DOMContentLoaded', () => { window.app = new WasteManagementApp(); });

// CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(style);
