/**
 * ADMIN CONTROLLER - MAPEL EXPRESS
 */

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if(sidebar && overlay) { sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); }
};

const viewTitles = {
    'radar': 'God Eye Radar', 'dispatch': 'Manajemen Dispatcher', 'ekspedisi': 'Titik Ekspedisi Map', 'broadcast': 'Broadcast Global', 'pricing': 'Konfigurasi Tarif', 'promo': 'Banner Promosi', 'driver': 'Data Internal Driver'
};

window.switchMenu = function(menuId) {
    if(window.innerWidth < 768) {
        const sb = document.getElementById('sidebar');
        if(sb && !sb.classList.contains('-translate-x-full')) window.toggleSidebar(); 
    }

    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${menuId}`);
    if(activeNav) activeNav.classList.add('active');

    document.getElementById('header-title').innerText = viewTitles[menuId] || 'Admin Panel';

    const views = ['view-radar', 'view-dispatch', 'view-ekspedisi', 'view-broadcast', 'view-pricing', 'view-promo', 'view-driver'];
    views.forEach(v => { const el = document.getElementById(v); if(el) el.classList.add('hidden'); });
    
    const targetView = document.getElementById(`view-${menuId}`);
    if(targetView) {
        if(menuId === 'ekspedisi') targetView.classList.replace('hidden', 'flex');
        else targetView.classList.remove('hidden');
    }

    if (menuId === 'radar') { setTimeout(() => adminMap.invalidateSize(), 300); updateRadarStats(); }
    if (menuId === 'dispatch') { renderSemuaOrders(); renderDriverList(); }
    if (menuId === 'ekspedisi') { setTimeout(() => eksMap.invalidateSize(), 300); renderTableEkspedisi(); }
    if (menuId === 'driver') renderTableDriverAdmin();
};

window.tutupModal = (id) => { document.getElementById(id).classList.replace('flex', 'hidden'); };

const socket = window.socketBridge || { on: function(){}, emit: function(){} };

let masterOrders = JSON.parse(localStorage.getItem('mapel_admin_master_orders')) || [];
let masterDrivers = JSON.parse(localStorage.getItem('mapel_admin_master_drivers')) || [];
let adminEkspedisiList = JSON.parse(localStorage.getItem('mapel_ekspedisi')) || [];
let activeDriversOnline = {}; 

function saveDB(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function getWaktu() {
    const d = new Date(); const m = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}, ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

const OFFICE = { lat: -6.977414, lng: 107.555359 };
const basecampIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] });

const adminMap = L.map('admin-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(adminMap);
L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(adminMap).bindPopup("<b>Markas MapelExpress</b>");

const eksMap = L.map('eks-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(eksMap);
