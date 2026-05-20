/**
 * ADMIN CONTROLLER - MAPEL EXPRESS
 * Fix: Bug Dropdown, Modal Lonceng, Toggle Bottom Sheet & Simpan Ekspedisi DB
 */

const socket = window.socketBridge || { on: function(){}, emit: function(){} };

// ===============================================
// UI HANDLERS (Missing Functions Fixed!)
// ===============================================
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if(sidebar && overlay) { sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); }
};

window.toggleDropdown = function(id) {
    const el = document.getElementById(id);
    if(el) el.classList.toggle('hidden');
};

// Fungsi Toggle Panel Statistik & List Ekspedisi
window.togglePanel = function(id) {
    const el = document.getElementById(id);
    if(el) {
        if(el.classList.contains('active')) {
            el.classList.remove('active');
        } else {
            // Tutup semua panel dropdown lain dulu
            document.querySelectorAll('.dropdown-panel').forEach(p => p.classList.remove('active'));
            el.classList.add('active');
        }
    }
};

// Fungsi Buka Modal Lonceng Notif (Feedback)
window.bukaNotifAdmin = function() {
    const modal = document.getElementById('modal-notif-admin');
    const dot = document.getElementById('admin-notif-dot');
    if(modal) modal.classList.replace('hidden', 'flex');
    if(dot) dot.classList.add('hidden'); // Hilangin titik merah setelah dibaca
};

// Fungsi Naik/Turun Bottom Sheet Ekspedisi
window.toggleSheetEks = function() {
    const sheet = document.getElementById('sheet-ekspedisi');
    if(sheet) {
        if(sheet.classList.contains('translate-y-[calc(100%-70px)]')) {
            sheet.classList.remove('translate-y-[calc(100%-70px)]');
            sheet.classList.add('translate-y-0');
        } else {
            sheet.classList.remove('translate-y-0');
            sheet.classList.add('translate-y-[calc(100%-70px)]');
        }
    }
};

window.tutupModal = (id) => { 
    const md = document.getElementById(id);
    if(md) md.classList.replace('flex', 'hidden'); 
};

// Tutup dropdown kalau admin klik area kosong
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('dropdown-menu-radar');
    if(dropdown && !dropdown.classList.contains('hidden')) {
        const isClickInside = dropdown.contains(event.target) || event.target.closest('button[onclick*="toggleDropdown"]');
        if (!isClickInside) dropdown.classList.add('hidden');
    }
});

const viewTitles = {
    'radar': 'God Eye Radar', 
    'dispatch': 'Manajemen Dispatcher', 
    'ekspedisi': 'Titik Ekspedisi Map', 
    'broadcast': 'Broadcast Global', 
    'pricing': 'Konfigurasi Tarif', 
    'radius': 'Atur Radius Geofencing', 
    'promo': 'Banner Promosi', 
    'driver': 'Data Internal Driver'
};

window.switchMenu = function(menuId) {
    if(window.innerWidth < 768) {
        const sb = document.getElementById('sidebar');
        if(sb && !sb.classList.contains('-translate-x-full')) window.toggleSidebar(); 
    }

    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
    const activeNav = document.getElementById(`nav-${menuId}`);
    if(activeNav) activeNav.classList.add('active');

    const hTitle = document.getElementById('header-title');
    if(hTitle) hTitle.innerText = viewTitles[menuId] || 'Admin Panel';

    const views = ['view-radar', 'view-dispatch', 'view-ekspedisi', 'view-broadcast', 'view-pricing', 'view-radius', 'view-promo', 'view-driver'];
    views.forEach(v => { const el = document.getElementById(v); if(el) el.classList.add('hidden'); });
    
    const targetView = document.getElementById(`view-${menuId}`);
    if(targetView) {
        if(menuId === 'ekspedisi' || menuId === 'radius' || menuId === 'radar') {
            targetView.classList.replace('hidden', 'flex');
        } else {
            targetView.classList.remove('hidden');
        }
    }

    // Refresh ukuran peta Leaflet biar gak error abu-abu
    if (menuId === 'radar' && adminMap) { setTimeout(() => adminMap.invalidateSize(), 300); }
    if (menuId === 'ekspedisi' && eksMap) { setTimeout(() => eksMap.invalidateSize(), 300); }
    if (menuId === 'radius' && radiusMap) { 
        setTimeout(() => { 
            radiusMap.invalidateSize(); 
            window.updateRadiusCircle(); 
        }, 300); 
    }
};

// ===============================================
// INISIALISASI LEAFLET MAPS
// ===============================================
let adminMap = null, eksMap = null, radiusMap = null;
let radiusCircle = null;

if (typeof L !== 'undefined') {
    const OFFICE = { lat: -6.977414, lng: 107.555359 };
    const basecampIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45] });

    if(document.getElementById('admin-map')) {
        adminMap = L.map('admin-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(adminMap);
        L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(adminMap).bindPopup("<b>Markas MapelExpress</b>");
    }

    if(document.getElementById('eks-map')) {
        eksMap = L.map('eks-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(eksMap);
        
        eksMap.on('move', function() {
            const center = eksMap.getCenter();
            const elLat = document.getElementById('f-eks-lat');
            const elLng = document.getElementById('f-eks-lng');
            if(elLat) elLat.value = center.lat.toFixed(6);
            if(elLng) elLng.value = center.lng.toFixed(6);
        });
    }

    if(document.getElementById('radius-map')) {
        radiusMap = L.map('radius-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(radiusMap);
        
        radiusCircle = L.circle([OFFICE.lat, OFFICE.lng], {
            color: '#EF4444',       
            fillColor: '#EF4444',   
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '5, 5',      
            radius: 3000
        }).addTo(radiusMap);

        radiusMap.on('move', function() {
            const center = radiusMap.getCenter();
            document.getElementById('rad-lat').value = center.lat.toFixed(6);
            document.getElementById('rad-lng').value = center.lng.toFixed(6);
            radiusCircle.setLatLng(center);
        });
    }
}

// ===============================================
// LOGIC GEOFENCING (RADIUS)
// ===============================================
window.updateRadiusCircle = function() {
    if(!radiusCircle) return;
    const km = parseFloat(document.getElementById('rad-km').value) || 3;
    radiusCircle.setRadius(km * 1000); 
};

window.simpanRadius = async function() {
    const lat = document.getElementById('rad-lat').value;
    const lng = document.getElementById('rad-lng').value;
    const km = document.getElementById('rad-km').value;

    if (!lat || !lng || !km) return alert("Kordinat dan batas radius tidak boleh kosong!");

    const settingsData = {
        basecamp_lat: parseFloat(lat),
        basecamp_lng: parseFloat(lng),
        max_radius_km: parseFloat(km)
    };

    // Pastikan variabel sb dari db.js terhubung
    const sb = window.supabase || (window.sb); 

    if(sb) {
        try {
            const { error } = await sb.from('settings').upsert({ id: 1, ...settingsData });
            if (error) throw error;
            alert(`Batas area operasional berhasil dikunci di radius ${km} KM dari titik pusat.`);
        } catch(e) {
            console.error(e);
            alert("Gagal simpan ke Supabase. Pastikan tabel 'settings' sudah dibuat.");
        }
    } else {
        alert("Sistem belum terkoneksi ke Database Supabase!");
    }
};

// ===============================================
// LOGIC SIMPAN PIN EKSPEDISI KE DATABASE
// ===============================================
window.simpanEkspedisi = async function() {
    const nama = document.getElementById('f-eks-nama').value;
    const lat = parseFloat(document.getElementById('f-eks-lat').value);
    const lng = parseFloat(document.getElementById('f-eks-lng').value);
    
    if(!nama || !lat || !lng) return alert("Silakan isi Nama Cabang dan geser peta ke titik ekspedisi yang benar!");
    
    // Ganti teks tombol saat loading
    const btn = event.target;
    const oldText = btn.innerText;
    btn.innerText = "Menyimpan ke Database...";
    btn.disabled = true;

    const sb = window.supabase || (window.sb);

    try {
        if(sb) {
            // Masukkan data ke tabel ekspedisi
            const { error } = await sb.from('ekspedisi').insert([{ nama: nama, lat: lat, lng: lng }]);
            if (error) throw error;
            
            alert(`Suksess! Titik Ekspedisi ${nama} berhasil disimpan ke sistem.`);
            
            // Bersihkan input nama setelah berhasil
            document.getElementById('f-eks-nama').value = '';
            
            // Tambahkan visual Marker di Map supaya kelihatan
            L.marker([lat, lng]).addTo(eksMap).bindPopup(`<b>${nama}</b>`);
            if(adminMap) L.marker([lat, lng]).addTo(adminMap).bindPopup(`<b>${nama}</b>`);
            
            // Otomatis turunin sheet-nya
            window.toggleSheetEks();
        } else {
            alert("Koneksi Database (Supabase) belum tersedia!");
        }
    } catch(e) {
        alert("Gagal menyimpan ke Database: " + e.message);
    } finally {
        btn.innerText = oldText;
        btn.disabled = false;
    }
};
