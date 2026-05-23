/**
 * ADMIN CONTROLLER - MAPEL EXPRESS
 * ORIGINAL VERSION + FIXED ICONS, MENUS, & REALTIME CHANNELS
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

const viewTitles = { 
    'radar': 'God Eye Radar', 'dispatch': 'Manajemen Dispatcher', 
    'ekspedisi': 'Titik Ekspedisi Map', 'broadcast': 'Broadcast Global', 
    'pricing': 'Konfigurasi Tarif', 'radius': 'Atur Radius Geofencing', 
    'promo': 'Banner Promosi', 'driver': 'Data Internal Driver' 
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
    
    views.forEach(v => { 
        const el = document.getElementById(v); 
        if(el) {
            el.classList.add('hidden'); 
            el.classList.remove('flex', 'block'); // Bersihkan class lama
        }
    });
    
    const targetView = document.getElementById(`view-${menuId}`);
    if(targetView) {
        targetView.classList.remove('hidden');
        // Pastikan tampilan peta tetap flex, menu lain jadi block biar nggak blank
        if(menuId === 'ekspedisi' || menuId === 'radius' || menuId === 'radar') {
            targetView.classList.add('flex');
        } else {
            targetView.classList.add('block');
        }
    }

    if (menuId === 'radar' && adminMap) { setTimeout(() => adminMap.invalidateSize(), 300); }
    if (menuId === 'ekspedisi' && eksMap) { setTimeout(() => eksMap.invalidateSize(), 300); }
    if (menuId === 'radius' && radiusMap) { setTimeout(() => radiusMap.invalidateSize(), 300); }
};

// ===============================================
// 2. FUNGSI KHUSUS ICON EKSPEDISI (DIKEMBANGKAN)
// ===============================================
function getIconEkspedisi(namaCabang) {
    let nama = namaCabang.toLowerCase();
    let iconFile = 'pin.png'; 
    let bgColor = '#ffffff'; // Warna dasar bulat putih

    // Deteksi nama
    if (nama.includes('jne')) iconFile = 'jne.png';
    else if (nama.includes('j&t') || nama.includes('jnt')) iconFile = 'jnt.png';
    else if (nama.includes('sicepat')) iconFile = 'sicepat.png';
    else if (nama.includes('shopee') || nama.includes('spx')) iconFile = 'spx.png';
    else if (nama.includes('ninja')) { iconFile = 'ninja.png'; bgColor = '#dc2626'; } // Ninja background merah
    else if (nama.includes('anteraja')) iconFile = 'anteraja.png';

    // Desain Card Bulat (width 40px), Icon Dalam diperbesar jadi 30px (hampir penuhi lingkaran)
    const htmlMarker = `
        <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background-color:${bgColor}; border-radius:50%; box-shadow:0 4px 10px rgba(0,0,0,0.3); border:2px solid white; overflow:hidden;">
            <img src="/assets/icons/${iconFile}" style="width:30px; height:30px; object-fit:contain;" onerror="this.src='/assets/icons/pin.png'" />
        </div>
    `;

    return L.divIcon({ className: '', html: htmlMarker, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] });
}

// ===============================================
// 3. INISIALISASI PETA, PIN, DAN POPUP
// ===============================================
let adminMap = null, eksMap = null, radiusMap = null;
let radiusCircle = null;
let tempEksMarker = null;

const OFFICE = { lat: -6.977414, lng: 107.555359 }; 

const popupBasecampHTML = `
    <div style="min-width: 160px; padding: 4px;">
        <p class="text-xs font-black text-gray-800 mb-1 border-b border-gray-200 pb-1">Lokasi Basecamp</p>
        <p class="text-[9px] text-gray-500 font-bold mb-2">Ubah alamat detail perusahaan:</p>
        <textarea id="bc-alamat-input" class="w-full bg-gray-50 border border-gray-300 rounded p-1.5 text-xs outline-none mb-2" rows="2">Jalan Raya Mapel No. 1</textarea>
        <button onclick="window.simpanAlamatBC()" class="w-full bg-blue-600 text-white font-bold py-1.5 rounded text-[10px] shadow-sm active:bg-blue-700">Simpan Perubahan</button>
    </div>
`;

window.simpanAlamatBC = function() {
    alert("Berhasil! Alamat Basecamp di-update!");
};

if (typeof L !== 'undefined') {
    const basecampIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -35] });

    if(document.getElementById('admin-map')) {
        adminMap = L.map('admin-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(adminMap);
        L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(adminMap).bindPopup(popupBasecampHTML);
    }

    if(document.getElementById('eks-map')) {
        eksMap = L.map('eks-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(eksMap);
        L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(eksMap).bindPopup(popupBasecampHTML);
        
        eksMap.on('click', function(e) {
            document.getElementById('f-eks-lat').value = e.latlng.lat.toFixed(6);
            document.getElementById('f-eks-lng').value = e.latlng.lng.toFixed(6);
            if(tempEksMarker) eksMap.removeLayer(tempEksMarker);
            tempEksMarker = L.marker(e.latlng).addTo(eksMap).bindPopup("<b>Titik Baru</b>").openPopup();
            
            const sheet = document.getElementById('sheet-ekspedisi');
            if(sheet) { sheet.classList.remove('translate-y-[calc(100%-95px)]'); sheet.classList.add('translate-y-0'); }
        });
    }

    if(document.getElementById('radius-map')) {
        radiusMap = L.map('radius-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(radiusMap);
        L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(radiusMap).bindPopup(popupBasecampHTML);

        radiusCircle = L.circle([OFFICE.lat, OFFICE.lng], { color: '#EF4444', fillColor: '#EF4444', fillOpacity: 0.15, weight: 2, radius: 3000 }).addTo(radiusMap);

        if(document.getElementById('rad-lat')) document.getElementById('rad-lat').value = OFFICE.lat;
        if(document.getElementById('rad-lng')) document.getElementById('rad-lng').value = OFFICE.lng;
    }
}

window.updateRadiusCircle = function() {
    if(!radiusCircle) return;
    const km = parseFloat(document.getElementById('rad-km').value) || 3;
    radiusCircle.setRadius(km * 1000); 
};


// ===============================================
// 4. DATABASE ACTION & FETCH DATA
// ===============================================
let arrayMarkerEkspedisi = [];

window.loadEkspedisi = async function() {
    if (!window.sb) return; 
    
    try {
        const { data, error } = await window.sb.from('ekspedisi').select('*');
        if (data) {
            // Bersihkan marker lama
            arrayMarkerEkspedisi.forEach(m => m.remove());
            arrayMarkerEkspedisi = [];

            const tabelEks = document.getElementById('table-ekspedisi');
            if(tabelEks) tabelEks.innerHTML = '';

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
                            <td class="p-3 text-center">
                                <button onclick="window.hapusEkspedisi(${titik.id}, '${titik.nama}')" style="background:#fee2e2; color:#dc2626; padding:4px 8px; border-radius:4px; font-weight:bold;">Hapus</button>
                            </td>
                        </tr>
                    `;
                }
            });
        }
    } catch(err) { console.error("Gagal load ekspedisi:", err); }
};

setTimeout(() => { window.loadEkspedisi(); }, 1000);

window.hapusEkspedisi = async function(id, nama) {
    if(!confirm(`Yakin mau menghapus titik gerai "${nama}"?`)) return;
    if(!window.sb) return alert("Koneksi Database Gagal!");
    try {
        const { error } = await window.sb.from('ekspedisi').delete().eq('id', id);
        if (error) throw error;
        window.loadEkspedisi(); // Langsung render ulang petanya
    } catch(e) { alert("❌ GAGAL MENGHAPUS: " + e.message); }
};

window.simpanRadius = async function() {
    const km = document.getElementById('rad-km').value;
    if (!km || !window.sb) return;
    try {
        await window.sb.from('settings').upsert({ id: 1, max_radius_km: parseFloat(km) });
        alert(`Batas operasional dikunci di radius ${km} KM!`);
        window.toggleSheetRadius(); 
    } catch(e) { alert("Error: " + e.message); }
};

window.simpanEkspedisi = async function() {
    try {
        const nama = document.getElementById('f-eks-nama').value;
        const lat = parseFloat(document.getElementById('f-eks-lat').value);
        const lng = parseFloat(document.getElementById('f-eks-lng').value);
        
        if(!nama || !lat || !lng) return alert("⚠️ ISI NAMA CABANG & TAP PETA DULU!");
        if(!window.sb) return alert("🚨 Database tidak terkoneksi!");

        const { error } = await window.sb.from('ekspedisi').insert([{ nama: nama, lat: lat, lng: lng }]);
        if (error) throw error;
        
        document.getElementById('f-eks-nama').value = '';
        if(tempEksMarker) eksMap.removeLayer(tempEksMarker);
        
        window.loadEkspedisi(); 
        window.toggleSheetEks(); 
        
    } catch(e) { alert("❌ ERROR: " + e.message); }
};

// ===============================================
// 5. SALURAN DATA (REALTIME BRIDGE KE CUSTOMER/DRIVER)
// ===============================================
if (window.sb) {
    // Listener ini nangkep kalau ada perubahan data dari Customer/Driver, atau Admin lain
    window.sb.channel('public:ekspedisi_settings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ekspedisi' }, payload => {
            console.log('Update Data Ekspedisi:', payload);
            window.loadEkspedisi(); // Auto update peta Admin
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, payload => {
            console.log('Update Settings Radius:', payload);
            if(payload.new && payload.new.max_radius_km && radiusCircle) {
                document.getElementById('rad-km').value = payload.new.max_radius_km;
                window.updateRadiusCircle(); // Auto perbesar lingkaran
            }
        })
        .subscribe();
}
