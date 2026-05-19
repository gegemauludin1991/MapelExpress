/**
 * MAIN APP CONTROLLER - SISI KURIR / DRIVER
 */

const OFFICE = { lat: -6.977414, lng: 107.555359 };
const myMap = typeof DynamicMap !== 'undefined' ? new DynamicMap('map', OFFICE.lat, OFFICE.lng, 15) : null;

if (myMap) {
    const officeIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] });
    L.marker([OFFICE.lat, OFFICE.lng], { icon: officeIcon }).addTo(myMap.map)
        .bindPopup("<div class='font-bold text-center text-blue-800 text-xs'>Pusat Operasional<br>MapelExpress</div>");
}

// MENGGUNAKAN SUPABASE SOCKET BRIDGE
const socket = window.socketBridge || { on: function(){}, emit: function(){} };

let driverStats = JSON.parse(localStorage.getItem('mapel_driver_stats')) || { saldo: 0, totalOrder: 0 };
let driverProfile = JSON.parse(localStorage.getItem('mapel_driver_profile')) || {
    id: "MAPEL-" + Math.floor(1000 + Math.random() * 9000), name: "Driver Mapel", role: "Kurir Reguler", wa: "08123456789", photo: "/assets/icons/kurir.png" 
};
let notifications = JSON.parse(localStorage.getItem('mapel_driver_notif')) || [];

function renderDashboard() {
    const dashName = document.getElementById('dash-name');
    const dashId = document.getElementById('dash-id');
    const dashPhoto = document.getElementById('dash-photo');
    if(dashName) dashName.innerText = driverProfile.name;
    if(dashId) dashId.innerText = `ID: ${driverProfile.id}`;
    if(dashPhoto) dashPhoto.src = driverProfile.photo;
    
    const elSaldo = document.querySelector('.text-3xl.font-black.text-gray-900');
    if(elSaldo) elSaldo.innerText = `Rp ${driverStats.saldo.toLocaleString('id-ID')}`;
}

// FIX UI TABS NAVBAR DRIVER (Biar Nggak Freeze)
document.addEventListener('DOMContentLoaded', () => {
    const tabs = { dashboard: document.getElementById('view-dashboard'), map: document.getElementById('view-map'), notif: document.getElementById('view-notif'), settings: document.getElementById('view-settings') };
    const navBtns = { dashboard: document.getElementById('nav-dashboard'), map: document.getElementById('nav-map'), notif: document.getElementById('nav-notif'), settings: document.getElementById('nav-settings') };

    window.switchTab = function(target) {
        Object.keys(tabs).forEach(k => { 
            if(tabs[k]) { tabs[k].classList.add('hidden', 'opacity-0'); }
            if(navBtns[k]) { navBtns[k].classList.remove('text-blue-600'); navBtns[k].classList.add('text-gray-400'); }
        });
        
        if(tabs[target]) { 
            tabs[target].classList.remove('hidden'); 
            setTimeout(() => tabs[target].classList.remove('opacity-0'), 50); 
        }
        if(navBtns[target]) { 
            navBtns[target].classList.remove('text-gray-400'); 
            navBtns[target].classList.add('text-blue-600'); 
        }
        if (target === 'map' && myMap) setTimeout(() => myMap.map.invalidateSize(), 300);
    };

    if(navBtns.dashboard) navBtns.dashboard.onclick = () => window.switchTab('dashboard');
    if(navBtns.map) navBtns.map.onclick = () => window.switchTab('map');
    if(navBtns.notif) navBtns.notif.onclick = () => window.switchTab('notif');
    if(navBtns.settings) navBtns.settings.onclick = () => window.switchTab('settings');
    
    renderDashboard(); 
});
