/**
 * DYNAMIC MAP ENGINE (Leaflet + OSRM)
 * Khusus SPA tanpa framework (PRODUCTION READY)
 * Fix: Akurasi Titik Tumpu (Icon Anchor) 100% Presisi
 */
class DynamicMap {
    constructor(containerId, startLat, startLng, zoomLevel = 14) {
        this.map = L.map(containerId, { zoomControl: false }).setView([startLat, startLng], zoomLevel);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap'
        }).addTo(this.map);

        this.routingControl = null;
        this.simulationTimer = null;
        this.markers = []; // Penampung marker biar hp gak lag
        
        const kurirIcon = L.icon({
            iconUrl: '/assets/icons/kurir.png',
            iconSize: [46, 46], 
            iconAnchor: [23, 23], // Titik tumpu persis di tengah gambar
            popupAnchor: [0, -20]
        });

        this.driverMarker = L.marker([startLat, startLng], { 
            icon: kurirIcon,
            rotationAngle: 0,
            rotationOrigin: 'center center' 
        }).addTo(this.map);
        
        this.driverMarker.bindPopup("<b>🚚 Kurir MapelExpress</b><br>Standby");
    }

    updateDriverPosition(newLat, newLng) {
        const oldPos = this.driverMarker.getLatLng();
        if (oldPos.lat === newLat && oldPos.lng === newLng) return;

        const sudut = this.hitungSudutBelok(oldPos.lat, oldPos.lng, newLat, newLng);
        if (typeof this.driverMarker.setRotationAngle === 'function') {
            this.driverMarker.setRotationAngle(sudut);
        }

        const iconElement = this.driverMarker._icon;
        if (iconElement) iconElement.style.transition = 'transform 1s linear';

        this.driverMarker.setLatLng([newLat, newLng]);
    }

    hitungSudutBelok(lat1, lng1, lat2, lng2) {
        const phi1 = lat1 * Math.PI / 180;
        const phi2 = lat2 * Math.PI / 180;
        const deltaLambda = (lng2 - lng1) * Math.PI / 180;
        const y = Math.sin(deltaLambda) * Math.cos(phi2);
        const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
        let theta = Math.atan2(y, x);
        return (theta * 180 / Math.PI + 360) % 360;
    }

    createCustomIcon(type) {
        let iconHtml = '';
        let iconSize = [40, 40];
        let iconAnchor = [20, 20]; // Default Anchor Center
        let popupAnchor = [0, -20];

        // FIX ANCHOR: Pakai Style Inline biar gak kena efek CSS Tailwind yang bikin melar
        if (type === 'basecamp') {
            iconHtml = `<div style="width: 40px; height: 40px;" class="bg-blue-800 rounded-full flex items-center justify-center border-2 border-white shadow-lg text-xl">🏢</div>`;
        } else if (type === 'ekspedisi') {
            iconHtml = `<div style="width: 32px; height: 32px;" class="bg-white rounded-full flex items-center justify-center border-2 border-red-500 shadow-md text-sm">📦</div>`;
            iconSize = [32, 32];
            iconAnchor = [16, 16]; 
            popupAnchor = [0, -16];
        } else if (type === 'gps') {
            iconHtml = `<div style="width: 16px; height: 16px;" class="bg-blue-500 rounded-full border-2 border-white shadow-md box-content"></div>`;
            iconSize = [16, 16];
            iconAnchor = [8, 8]; 
            popupAnchor = [0, -8];
        } 
        else if (type === 'jemput' || type === 'tujuan_personal') {
            const hexColor = type === 'jemput' ? '#2563EB' : '#DC2626';
            // PERBAIKAN MUTLAK: Pakai SVG yang sama persis kayak crosshair di HTML lu
            iconHtml = `
            <svg width="40" height="50" viewBox="0 0 40 50" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.3));">
                <path d="M20 0C8.954 0 0 8.954 0 20C0 35 20 50 20 50C20 50 40 35 40 20C40 8.954 31.046 0 20 0Z" fill="${hexColor}" stroke="white" stroke-width="2"/>
                <path d="M20 9L11 13.5V23.5L20 28L29 23.5V13.5L20 9Z" fill="white"/>
                <path d="M11 13.5L20 18L29 13.5" stroke="${hexColor}" stroke-width="1.5" stroke-linejoin="round"/>
                <path d="M20 18V28" stroke="${hexColor}" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>`;
            iconSize = [40, 50];
            iconAnchor = [20, 50]; // TITIK TUMPU MUTLAK: Di Ujung Bawah Jarum (X: 20, Y: 50)
            popupAnchor = [0, -50];
        } else {
            iconHtml = `<div style="width: 32px; height: 32px;" class="bg-white rounded-full flex items-center justify-center border-2 border-gray-400 shadow-md text-sm">🛒</div>`;
            iconSize = [32, 32];
            iconAnchor = [16, 16];
            popupAnchor = [0, -16];
        }
        
        return L.divIcon({ className: 'custom-div-icon bg-transparent border-0', html: iconHtml, iconSize: iconSize, iconAnchor: iconAnchor, popupAnchor: popupAnchor });
    }

    addMarker(lat, lng, type, popupContent, customLogoUrl = null) {
        let theIcon;

        if (customLogoUrl) {
            // FIX ANCHOR: Memastikan logo custom juga punya ukuran kaku (40x40px)
            const iconHtml = `<div style="width: 40px; height: 40px;" class="bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-md overflow-hidden p-1"><img src="${customLogoUrl}" class="w-full h-full object-contain"></div>`;
            theIcon = L.divIcon({ className: 'bg-transparent border-0', html: iconHtml, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] });
        } else {
            theIcon = this.createCustomIcon(type);
        }

        const marker = L.marker([lat, lng], { icon: theIcon }).addTo(this.map);
        if (popupContent) marker.bindPopup(popupContent);
        
        this.markers.push(marker);
        return marker;
    }

    clearMarkers() {
        this.markers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = []; 
    }

    drawRoute(waypointsArray, callbackSummary) {
        if (this.routingControl) this.map.removeControl(this.routingControl);
        if (this.simulationTimer) clearInterval(this.simulationTimer);

        const routeWaypoints = waypointsArray.map(wp => L.latLng(wp.lat, wp.lng));

        this.routingControl = L.Routing.control({
            waypoints: routeWaypoints,
            router: L.Routing.osrmv1({ 
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: 'driving'
            }),
            lineOptions: { 
                styles: [{color: '#1D3557', opacity: 0.15, weight: 9}, {color: 'white', opacity: 0.8, weight: 6}, {color: '#E63946', opacity: 1, weight: 4}],
                missingRouteStyles: [{color: '#1D3557', opacity: 0.15, weight: 9}, {color: 'white', opacity: 0.8, weight: 6}, {color: '#E63946', opacity: 1, weight: 4}],
                extendToWaypoints: true 
            },
            createMarker: function() { return null; }, 
            addWaypoints: false, 
            fitSelectedRoutes: false, 
            show: false 
        }).addTo(this.map);

        this.routingControl.on('routesfound', (e) => {
            const summary = e.routes[0].summary;
            const data = { jarakKm: (summary.totalDistance / 1000).toFixed(1), waktuMenit: Math.round(summary.totalTime / 60) };
            if (callbackSummary) callbackSummary(data);
        });

        this.routingControl.on('routingerror', function(e) {
            console.error('OSRM Routing Error:', e);
            if (callbackSummary) {
                console.warn("Menggunakan estimasi jarak default karena server penuh.");
                callbackSummary({ jarakKm: "5.0", waktuMenit: 15, isFallback: true }); 
            }
        });
    }
}
