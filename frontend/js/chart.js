// Chart rendering utility for Waste Management System
// Uses Chart.js (add <script src="https://cdn.jsdelivr.net/npm/chart.js"></script> in index.html)

export function renderBarChart(ctx, labels, datasets, options = {}) {
    return new window.Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets
        },
        options: Object.assign({
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: false }
            }
        }, options)
    });
}

export function renderLineChart(ctx, labels, datasets, options = {}) {
    return new window.Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets
        },
        options: Object.assign({
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: false }
            }
        }, options)
    });
}
