/**
 * ADMIN CONTROLLER - MAPEL EXPRESS
 * Fix: Tap Ekspedisi, Geofence MoveEnd, Popup Dinamis, Error Handling
 */

// ===============================================
// 1. UI HANDLERS
// ===============================================
window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if(sidebar && overlay) { sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); }
};

window.togglePanel = function(id) {
    const el = document.getElementById(id);
    if(el) {
        if(el.classList.contains('active')) el.classList.remove('active'); 
        else {
            document.querySelectorAll('.dropdown-panel').forEach(p => p.classList.remove('active'));
            el.classList.add('active'); 
        }
    }
};

window.bukaNotifAdmin = function() {
    const modal = document.getElementById('modal-notif-admin');
    const dot = document.getElementById('admin-notif-dot');
    if(modal) modal.classList.replace('hidden', 'flex');
    if(dot) dot.classList.add('hidden'); 
};

window.toggleSheetEks = function() {
    const sheet = document.getElementById('sheet-ekspedisi');
    if(sheet) {
        if(sheet.classList.contains('translate-y-[calc(100%-95px)]')) {
            sheet.classList.remove('translate-y-[calc(100%-95px)]');
            sheet.classList.add('translate-y-0');
        } else {
            sheet.classList.remove('translate-y-0');
            sheet.classList.add('translate-y-[calc(100%-95px)]');
        }
    }
};

window.toggleSheetRadius = function() {
    const sheet = document.getElementById('sheet-radius');
    if(sheet) {
        if(sheet.classList.contains('translate-y-[calc(100%-95px)]')) {
            sheet.classList.remove('translate-y-[calc(100%-95px)]');
            sheet.classList.add('translate-y-0');
        } else {
            sheet.classList.remove('translate-y-0');
            sheet.classList.add('translate-y-[calc(100%-95px)]');
        }
    }
};

window.tutupModal = (id) => { 
    const md = document.getElementById(id);
    if(md) md.classList.replace('flex', 'hidden'); 
};

const viewTitles = { 'radar': 'God Eye Radar', 'dispatch': 'Manajemen Dispatcher', 'ekspedisi': 'Titik Ekspedisi Map', 'broadcast': 'Broadcast Global', 'pricing': 'Konfigurasi Tarif', 'radius': 'Atur Radius Geofencing', 'promo': 'Banner Promosi', 'driver': 'Data Internal Driver' };

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
        if(menuId === 'ekspedisi' || menuId === 'radius' || menuId === 'radar') targetView.classList.replace('hidden', 'flex');
        else targetView.classList.remove('hidden');
    }

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
// 2. INISIALISASI PETA, PIN, DAN POPUP
// ===============================================
let adminMap = null, eksMap = null, radiusMap = null;
let radiusCircle = null;
let tempEksMarker = null;

// FORM POPUP DINAMIS UNTUK BASECAMP
const popupBasecampHTML = `
    <div style="min-width: 160px; padding: 4px;">
        <p class="text-xs font-black text-gray-800 mb-1 border-b border-gray-200 pb-1">Lokasi Basecamp</p>
        <p class="text-[9px] text-gray-500 font-bold mb-2">Ubah alamat detail perusahaan:</p>
        <textarea id="bc-alamat-input" class="w-full bg-gray-50 border border-gray-300 rounded p-1.5 text-xs outline-none mb-2" rows="2">Jalan Raya Mapel No. 1</textarea>
        <button onclick="window.simpanAlamatBC()" class="w-full bg-blue-600 text-white font-bold py-1.5 rounded text-[10px] shadow-sm active:bg-blue-700">Simpan Perubahan</button>
    </div>
`;

window.simpanAlamatBC = function() {
    const alamatBaru = document.getElementById('bc-alamat-input').value;
    alert("Berhasil! Alamat Basecamp di-update menjadi:\n" + alamatBaru);
};

if (typeof L !== 'undefined') {
    const OFFICE = { lat: -6.977414, lng: 107.555359 }; 
    const basecampIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -35] });

    // --- MAP RADAR ---
    if(document.getElementById('admin-map')) {
        adminMap = L.map('admin-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(adminMap);
        L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(adminMap).bindPopup(popupBasecampHTML);
    }

    // --- MAP EKSPEDISI ---
    if(document.getElementById('eks-map')) {
        eksMap = L.map('eks-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(eksMap);
        L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(eksMap).bindPopup(popupBasecampHTML);
        
        // LOGIC KLIK/TAP MAP UNTUK EKSPEDISI
        eksMap.on('click', function(e) {
            document.getElementById('f-eks-lat').value = e.latlng.lat.toFixed(6);
            document.getElementById('f-eks-lng').value = e.latlng.lng.toFixed(6);
            
            if(tempEksMarker) eksMap.removeLayer(tempEksMarker);
            tempEksMarker = L.marker(e.latlng).addTo(eksMap).bindPopup("<b>Titik Baru</b>").openPopup();
        });
    }

    // --- MAP GEOFENCING ---
    if(document.getElementById('radius-map')) {
        radiusMap = L.map('radius-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(radiusMap);
        
        radiusCircle = L.circle([OFFICE.lat, OFFICE.lng], {
            color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.15, weight: 2, dashArray: '5, 5', radius: 3000
        }).addTo(radiusMap);

        // LOGIC BARU: Lingkaran hanya pindah ketika SELESAI GESER MAP (moveend), jadi nggak kelihatan aneh
        radiusMap.on('moveend', function() {
            const center = radiusMap.getCenter();
            document.getElementById('rad-lat').value = center.lat.toFixed(6);
            document.getElementById('rad-lng').value = center.lng.toFixed(6);
            radiusCircle.setLatLng(center);
        });
        
        // Buat update form secara real-time saat digeser, tanpa mindahin lingkarannya dulu
        radiusMap.on('move', function() {
            const center = radiusMap.getCenter();
            document.getElementById('rad-lat').value = center.lat.toFixed(6);
            document.getElementById('rad-lng').value = center.lng.toFixed(6);
        });
    }
}

window.updateRadiusCircle = function() {
    if(!radiusCircle) return;
    const km = parseFloat(document.getElementById('rad-km').value) || 3;
    radiusCircle.setRadius(km * 1000); 
};


// ===============================================
// 3. DATABASE ACTION & FETCH DATA
// ===============================================

// FUNGSI UNTUK MENAMPILKAN PIN EKSPEDISI DARI DATABASE
window.loadEkspedisi = async function() {
    if (!window.sb) return; 
    
    // Icon khusus untuk ekspedisi (pakai pin yang sama, atau bisa lu ubah url-nya nanti)
    const iconEks = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [35, 35], iconAnchor: [17.5, 35] });

    try {
        const { data, error } = await window.sb.from('ekspedisi').select('*');
        if (data) {
            data.forEach(titik => {
                if(eksMap) L.marker([titik.lat, titik.lng], { icon: iconEks }).addTo(eksMap).bindPopup(`<b>${titik.nama}</b>`);
                if(adminMap) L.marker([titik.lat, titik.lng], { icon: iconEks }).addTo(adminMap).bindPopup(`<b>${titik.nama}</b>`);
            });
        }
    } catch(err) {
        console.error("Gagal load ekspedisi:", err);
    }
};

// Panggil fetch ekspedisi setelah 1 detik halaman dimuat
setTimeout(() => {
    window.loadEkspedisi();
}, 1000);

window.simpanRadius = async function() {
    const lat = document.getElementById('rad-lat').value;
    const lng = document.getElementById('rad-lng').value;
    const km = document.getElementById('rad-km').value;

    if (!lat || !lng || !km) return alert("Peta harus digeser dulu!");

    const dbClient = window.sb || window.supabaseClient || window.supabase;
    if(!dbClient) return alert("ERROR: File db.js belum menambahkan 'window.sb = supabase;'");

    const settingsData = { basecamp_lat: parseFloat(lat), basecamp_lng: parseFloat(lng), max_radius_km: parseFloat(km) };

    try {
        const { error } = await dbClient.from('settings').upsert({ id: 1, ...settingsData });
        if (error) throw error;
        alert(`Batas area terkunci di radius ${km} KM!`);
        window.toggleSheetRadius();
    } catch(e) {
        alert("Gagal Simpan Database: Pastikan tabel 'settings' ada di Supabase. Error: " + e.message);
    }
};

window.simpanEkspedisi = async function() {
    const nama = document.getElementById('f-eks-nama').value;
    const lat = parseFloat(document.getElementById('f-eks-lat').value);
    const lng = parseFloat(document.getElementById('f-eks-lng').value);
    
    if(!nama || !lat || !lng) return alert("Isi Nama Cabang dan Tap peta untuk menentukan titik!");
    
    const dbClient = window.sb || window.supabaseClient || window.supabase;
    if(!dbClient) return alert("ERROR: File db.js belum menambahkan 'window.sb = supabase;'");

    try {
        const { error } = await dbClient.from('ekspedisi').insert([{ nama: nama, lat: lat, lng: lng }]);
        if (error) throw error;
        
        alert(`Titik ${nama} tersimpan!`);
        document.getElementById('f-eks-nama').value = '';
        if(tempEksMarker) eksMap.removeLayer(tempEksMarker);
        
        // Render langsung ke map
        const iconEks = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [35, 35], iconAnchor: [17.5, 35] });
        L.marker([lat, lng], { icon: iconEks }).addTo(eksMap).bindPopup(`<b>${nama}</b>`);
        if(adminMap) L.marker([lat, lng], { icon: iconEks }).addTo(adminMap).bindPopup(`<b>${nama}</b>`);
        
        window.toggleSheetEks(); 
    } catch(e) {
        alert("Gagal Simpan Database: Pastikan tabel 'ekspedisi' ada di Supabase. Error: " + e.message);
    }
};
