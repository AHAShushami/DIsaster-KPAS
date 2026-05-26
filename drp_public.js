const URL_DRP = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTWpgFSm-I06bmNuadgkPmAFM9sC85fkw9QF-3vtpykk-NRa061DVYRBPv9tW2NjDfjtXCq6xCCKysY/pub?output=csv';
let publicDRPData = [];
let activeAlerts = null;
let map;
let markersGroup;

// Fetch live DRP data
Papa.parse(URL_DRP, {
    download: true,
    header: true,
    skipEmptyLines: true,
    complete: function(results) {
        publicDRPData = results.data.map(d => ({
            tempat: d.TEMPAT || '',
            daerah: d.DAERAH || '',
            mukim: d.MUKIM || '',
            riskCategory: d.RISK_CATEGORY || '',
            risk: d.RISK || '',
            riskClass: d.RISK_CLASS ? d.RISK_CLASS.trim().toUpperCase() : 'UNKNOWN',
            lat: parseFloat(d.LATITUDE) || null,
            lng: parseFloat(d.LONGITUDE) || null
        })).filter(d => d.tempat !== '');
        
        console.log("Loaded Public DRP Data:", publicDRPData.length, "risk areas");
        
        // Fetch alerts
        fetch('active_alerts.json')
            .then(res => {
                if (!res.ok) throw new Error("HTTP error " + res.status);
                return res.json();
            })
            .then(alerts => {
                activeAlerts = alerts;
                console.log("Loaded Active Alerts:", activeAlerts);
                initDashboard();
            })
            .catch(err => {
                console.log("No active alerts found or error fetching:", err);
                initDashboard();
            });
    }
});

function initDashboard() {
    // Hide loader, show content
    document.getElementById('loading').style.display = 'none';
    document.getElementById('dashboard-content').style.display = 'block';

    // Set Last Updated Time
    const now = new Date();
    document.getElementById('lastUpdated').innerText = now.toLocaleString('en-MY', { 
        dateStyle: 'medium', 
        timeStyle: 'short' 
    });

    populateFilters();
    updateScorecards();
    renderAlertsBanner();
    initMap();
    renderTable();
}

function renderAlertsBanner() {
    if (!activeAlerts) return;
    
    const banner = document.getElementById('alerts-banner');
    const list = document.getElementById('alerts-list');
    list.innerHTML = '';
    
    let hasAlerts = false;
    
    if (activeAlerts.met_warnings && activeAlerts.met_warnings.length > 0) {
        activeAlerts.met_warnings.forEach(w => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${w.title}</strong>: ${w.text} <br><span style="font-size: 0.8rem; color: #7f1d1d;">(Sah dari: ${new Date(w.valid_from).toLocaleString()} hingga ${new Date(w.valid_to).toLocaleString()})</span>`;
            list.appendChild(li);
            hasAlerts = true;
        });
    }
    
    if (activeAlerts.flood_warnings && activeAlerts.flood_warnings.length > 0) {
        activeAlerts.flood_warnings.forEach(w => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>Amaran Banjir:</strong> ${w.title} - ${w.text}`;
            list.appendChild(li);
            hasAlerts = true;
        });
    }
    
    if (hasAlerts) {
        banner.style.display = 'block';
    }
}

function updateScorecards() {
    const total = publicDRPData.length;
    const high = publicDRPData.filter(d => d.riskClass === 'HIGH').length;
    const medium = publicDRPData.filter(d => d.riskClass === 'MEDIUM').length;
    const low = publicDRPData.filter(d => d.riskClass === 'LOW').length;

    document.getElementById('score-total').innerText = total;
    document.getElementById('score-high').innerText = high;
    document.getElementById('score-medium').innerText = medium;
    document.getElementById('score-low').innerText = low;
}

function populateFilters() {
    const districtFilter = document.getElementById('districtFilter');
    const categoryFilter = document.getElementById('categoryFilter');

    const districts = [...new Set(publicDRPData.map(d => d.daerah))].filter(Boolean).sort();
    districts.forEach(dist => {
        const option = document.createElement('option');
        option.value = dist;
        option.text = dist;
        districtFilter.appendChild(option);
    });

    const categories = [...new Set(publicDRPData.map(d => d.riskCategory))].filter(Boolean).sort();
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.text = cat;
        categoryFilter.appendChild(option);
    });
}

function initMap() {
    // Default center for Kedah
    map = L.map('map').setView([6.1184, 100.3685], 8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18,
    }).addTo(map);
    markersGroup = L.layerGroup().addTo(map);
}

function renderTable() {
    const tbody = document.getElementById('drpTableBody');
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    const distFilter = document.getElementById('districtFilter').value;
    const catFilter = document.getElementById('categoryFilter').value;
    const classFilter = document.getElementById('classFilter').value;

    tbody.innerHTML = '';

    const filteredData = publicDRPData.filter(drp => {
        const matchesSearch = drp.tempat.toLowerCase().includes(searchInput) || drp.mukim.toLowerCase().includes(searchInput) || drp.risk.toLowerCase().includes(searchInput);
        const matchesDist = distFilter === 'All' || drp.daerah === distFilter;
        const matchesCat = catFilter === 'All' || drp.riskCategory === catFilter;
        const matchesClass = classFilter === 'All' || drp.riskClass === classFilter;
        
        return matchesSearch && matchesDist && matchesCat && matchesClass;
    });

    if (markersGroup) {
        markersGroup.clearLayers();
    }

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 3rem; color: var(--text-muted);">Tiada data dijumpai untuk carian ini.</td></tr>';
        return;
    }

    filteredData.forEach(drp => {
        const tr = document.createElement('tr');
        
        // Risk Class Badge
        let classBadge = '';
        if (drp.riskClass === 'HIGH') {
            classBadge = `<span class="badge badge-high">🚨 HIGH RISK</span>`;
        } else if (drp.riskClass === 'MEDIUM') {
            classBadge = `<span class="badge badge-medium">⚠️ MEDIUM RISK</span>`;
        } else {
            classBadge = `<span class="badge badge-low">✅ LOW RISK</span>`;
        }

        const coords = (drp.lat && drp.lng) ? `<a href="https://www.google.com/maps/search/?api=1&query=${drp.lat},${drp.lng}" class="map-btn" target="_blank">🗺️ Buka Peta</a>` : '<span style="color: var(--text-muted); font-size: 0.85rem;">Koordinat Tiada</span>';

        tr.innerHTML = `
            <td>
                <div class="facility-name">${drp.tempat}</div>
                <div class="district-name">📍 Daerah: ${drp.daerah} | Mukim: ${drp.mukim}</div>
            </td>
            <td>
                <div style="font-weight: 600;">${drp.riskCategory}</div>
                <div style="font-size: 0.85rem; color: var(--text-muted);">${drp.risk}</div>
            </td>
            <td>${classBadge}</td>
            <td>${coords}</td>
        `;
        tbody.appendChild(tr);

        // Add to Map
        if (drp.lat && drp.lng) {
            let markerColor = '#ef4444'; // default red for HIGH
            if (drp.riskClass === 'MEDIUM') markerColor = '#f59e0b';
            else if (drp.riskClass === 'LOW') markerColor = '#10b981';

            const marker = L.circleMarker([drp.lat, drp.lng], {
                color: markerColor,
                fillColor: markerColor,
                fillOpacity: 0.8,
                radius: 8,
                weight: 2
            });
            
            const popupContent = `
                <div style="font-family: 'Inter', sans-serif;">
                    <h4 style="margin: 0 0 5px 0; color: var(--primary);">${drp.tempat}</h4>
                    <p style="margin: 0; font-size: 0.85rem;"><strong>Daerah:</strong> ${drp.daerah}</p>
                    <p style="margin: 0; font-size: 0.85rem;"><strong>Kategori Risiko:</strong> ${drp.riskCategory}</p>
                    <p style="margin: 0; font-size: 0.85rem;"><strong>Jenis:</strong> ${drp.risk}</p>
                    <p style="margin: 5px 0 0 0; font-size: 0.85rem;">${classBadge}</p>
                </div>
            `;
            marker.bindPopup(popupContent);
            markersGroup.addLayer(marker);
        }
    });

    // Fit map bounds to markers if any exist
    if (markersGroup && markersGroup.getLayers().length > 0) {
        const group = new L.featureGroup(markersGroup.getLayers());
        map.fitBounds(group.getBounds(), { padding: [30, 30] });
    }

    renderSummaryTable(filteredData);
}

function renderSummaryTable(data) {
    const tbody = document.getElementById('summaryTableBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted);">Tiada data ringkasan.</td></tr>';
        return;
    }

    // Group by Daerah -> Mukim -> Risk Category
    const summary = {};
    
    data.forEach(d => {
        const key = `${d.daerah}|${d.mukim}|${d.riskCategory}`;
        if (!summary[key]) {
            summary[key] = {
                daerah: d.daerah,
                mukim: d.mukim,
                category: d.riskCategory,
                count: 0
            };
        }
        summary[key].count += 1;
    });

    // Convert to array and sort
    const summaryArray = Object.values(summary).sort((a, b) => {
        if (a.daerah !== b.daerah) return a.daerah.localeCompare(b.daerah);
        if (a.mukim !== b.mukim) return a.mukim.localeCompare(b.mukim);
        return a.category.localeCompare(b.category);
    });

    summaryArray.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight: 600;">${item.daerah}</td>
            <td>${item.mukim}</td>
            <td>${item.category}</td>
            <td style="text-align: center; font-weight: bold; font-size: 1.1rem; color: var(--primary);">${item.count}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Event Listeners
document.getElementById('searchInput').addEventListener('input', renderTable);
document.getElementById('districtFilter').addEventListener('change', renderTable);
document.getElementById('categoryFilter').addEventListener('change', renderTable);
document.getElementById('classFilter').addEventListener('change', renderTable);
