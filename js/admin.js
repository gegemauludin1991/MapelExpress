/**
 * ADMIN CONTROLLER - MAPEL EXPRESS
 * (MERGED: UI Asli MapelExpress + Engine Peta & Supabase Fix)
 */

const socket = window.socketBridge || { on: function(){}, emit: function(){} };
const sb = window.sb || (typeof supabase !== 'undefined' ? supabase : null);

// ===============================================
// 1. UI HANDLERS & NAVIGASI (ASLI LU)
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

window.toggleSheetEks = function() {
    const sheet = document.getElementById('sheet-ekspedisi');
    if(sheet) {
        // Nyesuaiin ukuran 70vh dari HTML lu
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

window.bukaModalDriver = function() {
    const modal = document.getElementById('modal-form-driver');
    if(modal) modal.classList.replace('hidden', 'flex');
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

    const hTitle = document.getElementById('header-title');
    if(hTitle) hTitle.innerText = viewTitles[menuId] || 'Admin Panel';

    const views = ['view-radar', 'view-dispatch', 'view-ekspedisi', 'view-broadcast', 'view-pricing', 'view-promo', 'view-driver'];
    views.forEach(v => { const el = document.getElementById(v); if(el) el.classList.add('hidden'); });
    
    const targetView = document.getElementById(`view-${menuId}`);
    if(targetView) {
        if(menuId === 'ekspedisi' || menuId === 'radar') targetView.classList.replace('hidden', 'flex');
        else targetView.classList.remove('hidden');
    }

    // Refresh Map Size biar nggak abu-abu
    if (menuId === 'radar' && typeof adminMap !== 'undefined' && adminMap) { setTimeout(() => adminMap.invalidateSize(), 300); }
    if (menuId === 'ekspedisi' && typeof eksMap !== 'undefined' && eksMap) { setTimeout(() => eksMap.invalidateSize(), 300); }
};

// ===============================================
// 2. FUNGSI KHUSUS ICON EKSPEDISI (ANTI PECAH)
// ===============================================
function getIconEkspedisi(namaCabang) {
    let nama = namaCabang.toLowerCase();
    let iconFile = 'pin.png'; 
    let bgColor = '#ffffff'; 

    if (nama.includes('jne')) iconFile = 'jne.png';
    else if (nama.includes('j&t') || nama.includes('jnt') || nama.includes('j & t')) iconFile = 'jnt.png';
    else if (nama.includes('sicepat') || nama.includes('si cepat')) iconFile = 'sicepat.png';
    else if (nama.includes('shopee') || nama.includes('spx')) iconFile = 'spx.png';
    else if (nama.includes('ninja')) { iconFile = 'ninja.png'; bgColor = '#dc2626'; } 
    else if (nama.includes('anteraja')) iconFile = 'anteraja.png';
    else if (nama.includes('wahana')) iconFile = 'wahana.png'; 

    const htmlMarker = `
        <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background-color:${bgColor}; border-radius:50%; box-shadow:0 4px 10px rgba(0,0,0,0.3); border:2px solid white; overflow:hidden;">
            <img src="/assets/icons/${iconFile}" style="width:30px; height:30px; object-fit:contain;" onerror="this.src='/assets/icons/pin.png'" />
        </div>
    `;
    return L.divIcon({ className: '', html: htmlMarker, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] });
}

// ===============================================
// 3. INISIALISASI PETA LEAFLET
// ===============================================
let adminMap = null, eksMap = null;
let tempEksMarker = null;
let arrayMarkerEkspedisi = [];

if (typeof L !== 'undefined') {
    const OFFICE = { lat: -6.977414, lng: 107.555359 };
    const basecampIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] });

    if(document.getElementById('admin-map')) {
        adminMap = L.map('admin-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(adminMap);
        L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(adminMap).bindPopup("<b>Markas MapelExpress</b>");
    }

    if(document.getElementById('eks-map')) {
        eksMap = L.map('eks-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(eksMap);
        L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(eksMap).bindPopup("<b>Markas MapelExpress</b>");
        
        // Logic Tap Peta untuk Ekspedisi
        eksMap.on('click', function(e) {
            document.getElementById('f-eks-lat').value = e.latlng.lat.toFixed(6);
            document.getElementById('f-eks-lng').value = e.latlng.lng.toFixed(6);
            if(tempEksMarker) eksMap.removeLayer(tempEksMarker);
            tempEksMarker = L.marker(e.latlng).addTo(eksMap).bindPopup("<span class='text-xs font-bold'>Lokasi Dipilih</span>").openPopup();
            
            const sheet = document.getElementById('sheet-ekspedisi');
            if(sheet) { sheet.classList.remove('translate-y-[calc(100%-70px)]'); sheet.classList.add('translate-y-0'); }
        });
    }
}

// ===============================================
// 4. SUPABASE ENGINE (FETCH, SIMPAN, HAPUS EKSPEDISI)
// ===============================================
window.loadEkspedisi = async function() {
    if (!sb) return; 
    
    try {
        const { data, error } = await sb.from('ekspedisi').select('*');
        if (data) {
            arrayMarkerEkspedisi.forEach(m => m.remove());
            arrayMarkerEkspedisi = [];

            const tabelEks = document.getElementById('table-ekspedisi');
            const listRadar = document.getElementById('radar-eks-list');
            if(tabelEks) tabelEks.innerHTML = '';
            if(listRadar) listRadar.innerHTML = '';

            data.forEach(titik => {
                const iconEks = getIconEkspedisi(titik.nama); 
                const popupContent = `
                    <div style="text-align:center; min-width:120px;">
                        <p style="font-weight:900; margin-bottom:8px;">${titik.nama}</p>
                        <button onclick="window.hapusEkspedisi(${titik.id}, '${titik.nama}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; width:100%;">🗑️ Hapus</button>
                    </div>
                `;

                if(eksMap) arrayMarkerEkspedisi.push(L.marker([titik.lat, titik.lng], { icon: iconEks }).addTo(eksMap).bindPopup(popupContent));
                if(adminMap) arrayMarkerEkspedisi.push(L.marker([titik.lat, titik.lng], { icon: iconEks }).addTo(adminMap).bindPopup(popupContent));

                if(tabelEks) {
                    tabelEks.innerHTML += `
                        <tr>
                            <td class="p-3 font-bold text-xs">${titik.nama}</td>
                            <td class="p-3 text-center w-20">
                                <button onclick="window.hapusEkspedisi(${titik.id}, '${titik.nama}')" class="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1.5 rounded-lg font-bold text-xs">Hapus</button>
                            </td>
                        </tr>
                    `;
                }

                if(listRadar) {
                    listRadar.innerHTML += `
                        <div class="bg-white border border-gray-100 p-2 rounded-lg shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50" onclick="if(adminMap) adminMap.setView([${titik.lat}, ${titik.lng}], 16)">
                            <p class="text-xs font-bold text-gray-700">${titik.nama}</p>
                            <span class="text-[10px] text-gray-400 font-bold">Lihat</span>
                        </div>
                    `;
                }
            });
        }
    } catch(err) { console.error("Gagal load ekspedisi:", err); }
};

// Panggil saat pertama buka admin
setTimeout(() => { window.loadEkspedisi(); }, 1000);

window.simpanEkspedisi = async function() {
    try {
        const nama = document.getElementById('f-eks-nama').value;
        const lat = document.getElementById('f-eks-lat').value;
        const lng = document.getElementById('f-eks-lng').value;
        
        if(!nama || !lat || !lng) return alert("⚠️ ISI NAMA CABANG & TAP PETA DULU!");
        if(!sb) return alert("🚨 Database tidak terkoneksi!");

        const { error } = await sb.from('ekspedisi').insert([{ nama: nama, lat: parseFloat(lat), lng: parseFloat(lng) }]);
        if (error) throw error;
        
        document.getElementById('f-eks-nama').value = '';
        if(tempEksMarker) eksMap.removeLayer(tempEksMarker);
        
        window.loadEkspedisi(); 
        window.toggleSheetEks(); 
    } catch(e) { alert("❌ ERROR: " + e.message); }
};

window.hapusEkspedisi = async function(id, nama) {
    if(!confirm(`Yakin mau menghapus titik gerai "${nama}"?`)) return;
    if(!sb) return;
    try {
        const { error } = await sb.from('ekspedisi').delete().eq('id', id);
        if (error) throw error;
        window.loadEkspedisi(); 
    } catch(e) { alert("❌ GAGAL MENGHAPUS: " + e.message); }
};
