/**
 * DYNAMIC MAP ENGINE (Leaflet + OSRM)
 * Khusus SPA tanpa framework
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
        this.markers = []; 
        
        const kurirIcon = L.icon({
            iconUrl: './assets/icons/kurir.png',
            iconSize: [46, 46], 
            iconAnchor: [23, 23], 
            popupAnchor: [0, -20]
        });

        this.driverMarker = L.marker([startLat, startLng], { 
            icon: kurirIcon,
            rotationAngle: 0,
            rotationOrigin: 'center center' 
        }).addTo(this.map);
        
        this.driverMarker.bindPopup("<b>🛵 Kurir MapelExpress</b><br>Standby");
    }

    updateDriverPosition(newLat, newLng) {
        const oldPos = this.driverMarker.getLatLng();
        if (oldPos.lat === newLat && oldPos.lng === newLng) return;

        const sudut = this.hitungSudutBelok(oldPos.lat, oldPos.lng, newLat, newLng);
        if (typeof this.driverMarker.setRotationAngle === 'function') {
            this.driverMarker.setRotationAngle(sudut);
        }

        const iconElement = this.driverMarker._icon;
        if (iconElement) {
            iconElement.style.transition = 'transform 1s linear';
        }

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
        let iconAnchor = [20, 40];
        let popupAnchor = [0, -40];

        if (type === 'basecamp') {
            iconHtml = `<div class="w-10 h-10 bg-blue-800 rounded-full flex items-center justify-center border-2 border-white shadow-lg text-xl">🏢</div>`;
        } else if (type === 'ekspedisi') {
            iconHtml = `<div class="w-8 h-8 bg-white rounded-full flex items-center justify-center border-2 border-red-500 shadow-md text-sm">📦</div>`;
        } else if (type === 'gps') {
            iconHtml = `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_0_5px_rgba(59,130,246,0.3)] box-content"></div>`;
            iconSize = [20, 20];
            iconAnchor = [10, 10];
            popupAnchor = [0, -15];
        } 
        else if (type === 'jemput' || type === 'tujuan_personal') {
            const hexColor = type === 'jemput' ? '#2563EB' : '#DC2626';
            iconHtml = `
            <div style="width: 40px; height: 50px; display: flex; flex-direction: column; align-items: center; filter: drop-shadow(0px 4px 4px rgba(0,0,0,0.3));">
                <div style="width: 40px; height: 40px; background-color: ${hexColor}; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 20px; z-index: 10;">📍</div>
                <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 12px solid ${hexColor}; margin-top: -2px; z-index: 5;"></div>
            </div>`;
            iconSize = [40, 50];
            iconAnchor = [20, 50]; 
            popupAnchor = [0, -50];
        } else {
            iconHtml = `<div class="w-8 h-8 bg-white rounded-full flex items-center justify-center border-2 border-gray-400 shadow-md text-sm">📍</div>`;
        }
        
        return L.divIcon({ className: 'custom-div-icon bg-transparent border-0', html: iconHtml, iconSize: iconSize, iconAnchor: iconAnchor, popupAnchor: popupAnchor });
    }

    addMarker(lat, lng, type, popupContent, customLogoUrl = null) {
        let theIcon;

        if (customLogoUrl) {
            const iconHtml = `<div class="w-10 h-10 bg-white rounded-full flex items-center justify-center border border-gray-200 shadow-[0_4px_10px_rgba(0,0,0,0.15)] overflow-hidden p-1.5"><img src="${customLogoUrl}" class="w-full h-full object-contain"></div>`;
            theIcon = L.divIcon({ className: 'bg-transparent border-0', html: iconHtml, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] });
        } else {
            theIcon = this.createCustomIcon(type);
        }

        const marker = L.marker([lat, lng], { icon: theIcon }).addTo(this.map);
        if (popupContent) marker.bindPopup(popupContent);
        this.markers.push(marker);
        return marker;
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
            console.error('Routing Error:', e);
            alert('Gagal membuat garis jalur dari server peta. Silakan coba lagi atau geser titik jemput/tujuan sedikit.');
        });
    }
}
