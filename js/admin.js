/**
 * ADMIN CONTROLLER - MAPEL EXPRESS
 * (Perbaikan UI/UX Radar, Setup Ekspedisi & Logo Ikon)
 */

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if(sidebar && overlay) { sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); }
};

const viewTitles = {
    'radar': 'God Eye Radar',
    'dispatch': 'Manajemen Dispatcher',
    'ekspedisi': 'Titik Ekspedisi Map',
    'broadcast': 'Broadcast Global',
    'pricing': 'Konfigurasi Tarif',
    'promo': 'Banner Promosi',
    'driver': 'Data Internal Driver',
    'support': 'Pusat Bantuan'
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

    const views = ['view-radar', 'view-dispatch', 'view-ekspedisi', 'view-broadcast', 'view-pricing', 'view-promo', 'view-driver', 'view-support'];
    views.forEach(v => { const el = document.getElementById(v); if(el) el.classList.add('hidden'); });
    
    const targetView = document.getElementById(`view-${menuId}`);
    if(targetView) {
        if(menuId === 'ekspedisi') targetView.classList.replace('hidden', 'flex');
        else targetView.classList.remove('hidden');
    }

    if (menuId === 'radar') {
        setTimeout(() => adminMap.invalidateSize(), 300);
        updateRadarStats();
    }
    if (menuId === 'dispatch') {
        renderSemuaOrders();
        renderDriverList();
    }
    if (menuId === 'ekspedisi') {
        setTimeout(() => eksMap.invalidateSize(), 300);
        renderTableEkspedisi();
    }
    if (menuId === 'driver') renderTableDriverAdmin();
    if (menuId === 'pricing') loadTarif();
    if (menuId === 'promo') renderPromo();
};

window.tutupModal = (id) => {
    document.getElementById(id).classList.replace('flex', 'hidden');
};

// ==========================================
// 1. DATA MASTER & STATE
// ==========================================
const socket = io();

let masterOrders = JSON.parse(localStorage.getItem('mapel_admin_master_orders')) || [];
let masterDrivers = JSON.parse(localStorage.getItem('mapel_admin_master_drivers')) || [];
let adminEkspedisiList = JSON.parse(localStorage.getItem('mapel_ekspedisi')) || [];
let tarifConfig = JSON.parse(localStorage.getItem('mapel_tarif_config')) || { base: 5000, perkm: 2000, maxkg: 5, extrakg: 1000, dimensi: 5000, disc: 0 };
let promoList = JSON.parse(localStorage.getItem('mapel_promo_list')) || [];
let activeDriversOnline = {}; 

function saveDB(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function getWaktu() {
    const d = new Date(); const m = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
    return `${d.getDate()} ${m[d.getMonth()]} ${d.getFullYear()}, ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
}

// FIX NAMA ICON SESUAI REQUEST USER (j&t.png, wahana.png)
function getEkspedisiLogo(nama) {
    if (!nama) return '/assets/icons/kurir.png';
    const n = nama.toLowerCase();
    if (n.includes('j&t') || n.includes('jnt')) return '/assets/icons/j&t.png'; // J&T Fix
    if (n.includes('jne')) return '/assets/icons/jne.png';
    if (n.includes('ninja')) return '/assets/icons/ninja.png';
    if (n.includes('spx') || n.includes('shopee')) return '/assets/icons/spx.png';
    if (n.includes('wahana')) return '/assets/icons/wahana.png'; // Wahana Fix
    if (n.includes('sicepat') || n.includes('si cepat')) return '/assets/icons/sicepat.png';
    return '/assets/icons/kurir.png'; 
}

// ==========================================
// 2. MAP ENGINES (RADAR & EKSPEDISI TERPISAH)
// ==========================================
const OFFICE = { lat: -6.977414, lng: 107.555359 };
const basecampIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] });

// MAP 1: RADAR UTAMA
const adminMap = L.map('admin-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(adminMap);
L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(adminMap).bindPopup("<b>Markas MapelExpress</b>");

// MAP 2: KHUSUS SETUP EKSPEDISI
const eksMap = L.map('eks-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(eksMap);
L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(eksMap).bindPopup("<b>Pusat Operasional<br>MapelExpress</b>");

let tempEksPin = null;

let isSheetEksOpen = true;
window.toggleSheetEks = () => {
    const sheet = document.getElementById('sheet-ekspedisi');
    if(sheet) {
        // Tepat disisain 70px di bawah layar (Tinggi Title & Garis penarik)
        if(isSheetEksOpen) { sheet.style.transform = 'translateY(calc(100% - 70px))'; } 
        else { sheet.style.transform = 'translateY(0)'; }
        isSheetEksOpen = !isSheetEksOpen;
    }
}

eksMap.on('click', function(e) {
    if (tempEksPin) eksMap.removeLayer(tempEksPin);
    tempEksPin = L.marker(e.latlng, {
        icon: L.divIcon({ className: 'bg-transparent border-0', html: `<div class="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center border-4 border-orange-500 shadow-lg animate-bounce">📍</div>`, iconSize: [32, 32], iconAnchor:[16, 32] })
    }).addTo(eksMap);
    
    document.getElementById('f-eks-lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('f-eks-lng').value = e.latlng.lng.toFixed(6);
    document.getElementById('f-eks-link').value = ''; 

    const sheet = document.getElementById('sheet-ekspedisi');
    if(sheet && !isSheetEksOpen) { sheet.style.transform = 'translateY(0)'; isSheetEksOpen = true; }
});

function renderTitikEkspedisiMaps() {
    adminMap.eachLayer((layer) => { if(layer.options.icon && layer.options.icon.options.className && layer.options.icon.options.className.includes('custom-eks-admin')) adminMap.removeLayer(layer); });
    eksMap.eachLayer((layer) => { if(layer.options.icon && layer.options.icon.options.className && layer.options.icon.options.className.includes('custom-eks-admin')) eksMap.removeLayer(layer); });

    adminEkspedisiList.forEach(eks => {
        const logo = getEkspedisiLogo(eks.name);
        const iconMarker = L.divIcon({ className: 'custom-eks-admin border-0', html: `<div class="w-8 h-8 bg-white rounded-full border-2 border-orange-500 shadow-md flex items-center justify-center overflow-hidden p-1.5"><img src="${logo}" class="w-full h-full object-contain"></div>`, iconSize:[32,32], iconAnchor:[16,16] });
        L.marker([eks.lat, eks.lng], { icon: iconMarker }).addTo(adminMap).bindPopup(eks.name);
        L.marker([eks.lat, eks.lng], { icon: iconMarker }).addTo(eksMap).bindPopup(eks.name);
    });
}
renderTitikEkspedisiMaps();

// ==========================================
// 3. RADAR SEARCH & DROPDOWN LOGIC
// ==========================================
window.togglePanel = (panelId) => {
    document.querySelectorAll('.dropdown-panel').forEach(p => {
        if(p.id !== panelId) p.classList.remove('active');
    });
    document.getElementById(panelId).classList.toggle('active');
    
    if(panelId === 'panel-ekslist') renderRadarEksList();
};

window.showDetailPanel = (type) => {
    const content = document.getElementById('radar-detail-content');
    content.classList.remove('hidden');
    content.innerHTML = '';
    
    if(type === 'driver') {
        const drvs = Object.values(activeDriversOnline);
        if(drvs.length === 0) content.innerHTML = '<p class="text-center font-bold text-gray-400">Tidak ada driver online.</p>';
        drvs.forEach(d => {
            content.innerHTML += `<div class="bg-gray-50 border border-gray-200 p-2 rounded mb-2 flex items-center gap-2"><img src="/assets/icons/kurir.png" class="w-8 h-8 border rounded-full"><div><p class="text-xs font-bold text-blue-600">${d.data.id}</p><p class="text-[9px] font-bold text-green-500 uppercase">Standby</p></div></div>`;
        });
    } else {
        const todayStr = new Date().getDate().toString();
        let listOrder = masterOrders.filter(o => o.waktuMasuk && o.waktuMasuk.startsWith(todayStr));
        
        if(type === 'selesai') listOrder = listOrder.filter(o => o.status === 'completed');
        if(type === 'cancel') listOrder = listOrder.filter(o => o.status === 'cancel');
        
        if(listOrder.length === 0) content.innerHTML = '<p class="text-center font-bold text-gray-400">Data kosong.</p>';
        listOrder.forEach(o => {
            content.innerHTML += `<div class="bg-gray-50 border border-gray-200 p-2 rounded mb-2"><p class="text-xs font-bold text-gray-800">${o.id}</p><p class="text-[10px] text-gray-500 truncate">${o.namaBarang}</p></div>`;
        });
    }
}

function renderRadarEksList() {
    const list = document.getElementById('radar-eks-list');
    list.innerHTML = '';
    if(adminEkspedisiList.length === 0) {
        list.innerHTML = '<p class="text-center text-xs font-bold text-gray-400 mt-2">Belum ada titik ekspedisi.</p>'; return;
    }
    adminEkspedisiList.forEach((e, i) => {
        const logo = getEkspedisiLogo(e.name);
        list.innerHTML += `
            <div class="flex items-center gap-2 p-2 hover:bg-blue-50 border border-transparent hover:border-blue-100 rounded-lg cursor-pointer transition-colors group">
                <img src="${logo}" class="w-6 h-6 object-contain">
                <div class="flex-1 overflow-hidden" onclick="adminMap.setView([${e.lat}, ${e.lng}], 17, {animate:true})">
                    <p class="text-[11px] font-bold text-gray-800 truncate group-hover:text-blue-600">${e.name}</p>
                </div>
                <button onclick="window.hapusEkspedisi(${i})" class="text-[9px] font-bold bg-red-100 text-red-600 px-2 py-1 rounded">Del</button>
            </div>
        `;
    });
}

window.cariDiRadar = async () => {
    const query = document.getElementById('radar-search').value.trim();
    if(!query) return;

    // Kalo user paste link gmaps
    const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = query.match(regex);
    if(match) { 
        adminMap.setView([parseFloat(match[1]), parseFloat(match[2])], 16, {animate:true});
        return;
    }

    // Kalo user paste Latitude, Longitude manual
    const coordRegex = /^(-?\d+\.\d+)[\s,]+(-?\d+\.\d+)$/;
    const coordMatch = query.match(coordRegex);
    if(coordMatch) {
        adminMap.setView([parseFloat(coordMatch[1]), parseFloat(coordMatch[2])], 16, {animate:true});
        return;
    }

    // Kalo nyari teks alamat, pake Nominatim (OSM API)
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
        const data = await res.json();
        if(data && data.length > 0) {
            adminMap.setView([data[0].lat, data[0].lon], 16, {animate:true});
        } else {
            alert("Alamat tidak ditemukan di sistem satelit.");
        }
    } catch(e) { alert("Gagal mencari alamat."); }
};

socket.on('update_driver_map', (data) => {
    if (!activeDriversOnline[data.id]) {
        // FIX: Ikon Driver Pake gambar Kurir yang elegan
        const markerKurir = L.marker([data.lat, data.lng], { 
            icon: L.icon({ iconUrl: '/assets/icons/kurir.png', iconSize: [40, 40], iconAnchor: [20, 20] }),
            zIndexOffset: 1000
        }).addTo(adminMap).bindPopup(`<b>Driver: ${data.id}</b>`);

        activeDriversOnline[data.id] = { marker: markerKurir, data: data };
        if(typeof renderDriverList === 'function') renderDriverList();
    } else {
        activeDriversOnline[data.id].marker.setLatLng([data.lat, data.lng]);
        activeDriversOnline[data.id].data = data;
    }
    document.getElementById('rad-driver').innerText = Object.keys(activeDriversOnline).length;
});

function updateRadarStats() {
    const todayStr = new Date().getDate().toString();
    let oToday = 0, oSelesai = 0, oCancel = 0;
    
    masterOrders.forEach(o => {
        if(o.waktuMasuk && o.waktuMasuk.startsWith(todayStr)) {
            oToday++;
            if(o.status === 'completed') oSelesai++;
            if(o.status === 'cancel') oCancel++;
        }
    });

    document.getElementById('rad-order').innerText = oToday;
    document.getElementById('rad-selesai').innerText = oSelesai;
    document.getElementById('rad-cancel').innerText = oCancel;
}

function renderDriverList() {
    const list = document.getElementById('list-active-drivers');
    if(!list) return;
    list.innerHTML = '';
    const drivers = Object.values(activeDriversOnline);
    
    if (drivers.length === 0) {
        list.innerHTML = '<p class="text-center text-gray-400 text-sm font-bold py-10">Tim belum ada yang jalan.</p>';
        return;
    }
    drivers.forEach(d => {
        list.innerHTML += `
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-200 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <img src="/assets/icons/kurir.png" class="w-10 h-10 border border-gray-200 rounded-full shadow-sm bg-white p-1">
                    <div>
                        <h4 class="font-black text-gray-800 text-sm">${d.data.id}</h4>
                        <p class="text-[9px] font-bold text-green-600 uppercase tracking-widest mt-0.5">🟢 Online Radar</p>
                    </div>
                </div>
            </div>
        `;
    });
}

// ==========================================
// 4. DISPATCHER & EVIDENT
// ==========================================
socket.on('new_order_broadcast', (order) => {
    if (!masterOrders.find(o => o.id === order.id)) {
        order.status = 'pending'; order.waktuMasuk = getWaktu();
        masterOrders.unshift(order); saveDB('mapel_admin_master_orders', masterOrders);
        if(!document.getElementById('view-dispatch').classList.contains('hidden')) renderSemuaOrders();
        updateRadarStats();
    }
});

socket.on('order_status_changed', (data) => {
    const idx = masterOrders.findIndex(o => o.id === data.orderId);
    if (idx !== -1) {
        masterOrders[idx].status = data.status;
        if(data.driverData) { masterOrders[idx].driverId = data.driverData.id; masterOrders[idx].driverName = data.driverData.name; }
        if(data.photoBase64) {
            if (data.status === 'picked_up') masterOrders[idx].photoPickup = data.photoBase64;
            if (data.status === 'completed') masterOrders[idx].photoDropoff = data.photoBase64;
        }
        if(!masterOrders[idx].tracking) masterOrders[idx].tracking = [];
        masterOrders[idx].tracking.push({ time: getWaktu(), status: `Status: ${data.status}` });
        saveDB('mapel_admin_master_orders', masterOrders);
        if(!document.getElementById('view-dispatch').classList.contains('hidden')) renderSemuaOrders();
        updateRadarStats();
    }
});

function getBadge(status) {
    if(status === 'pending') return `<span class="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-[10px] font-black uppercase">Antrean</span>`;
    if(status === 'picked_up') return `<span class="bg-blue-100 text-blue-700 px-2 py-1 rounded text-[10px] font-black uppercase">Jalan</span>`;
    if(status === 'completed') return `<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-[10px] font-black uppercase">Selesai</span>`;
    return `<span class="bg-red-100 text-red-700 px-2 py-1 rounded text-[10px] font-black uppercase">Cancel</span>`;
}

window.renderSemuaOrders = () => {
    const lPending = document.getElementById('list-pending-orders');
    const lCompleted = document.getElementById('list-completed-orders');
    if(!lPending || !lCompleted) return;

    lPending.innerHTML = ''; lCompleted.innerHTML = '';

    masterOrders.forEach(o => {
        const card = `
            <div class="bg-gray-50 hover:bg-gray-100 p-4 rounded-xl border ${o.status === 'pending' ? 'border-yellow-200' : 'border-gray-200'} transition-colors">
                <div class="flex justify-between items-center mb-3 border-b border-gray-200 pb-2">
                    <h4 class="font-black text-gray-800 text-sm">${o.id}</h4>
                    ${getBadge(o.status)}
                </div>
                <div class="space-y-1 mb-3 border-b border-gray-200 pb-3">
                    <p class="text-[11px] text-gray-600 truncate"><span class="font-bold text-gray-800">Dari:</span> ${o.alamatJemput}</p>
                    <p class="text-[11px] text-gray-600 truncate"><span class="font-bold text-blue-600">Ke:</span> ${o.alamatTujuan}</p>
                </div>
                <div class="flex justify-between items-center">
                    <p class="text-[10px] font-bold ${o.driverName ? 'text-green-600' : 'text-gray-400'}">${o.driverName ? `🛵 ${o.driverName}` : 'Belum ada kurir'}</p>
                    <button onclick="window.lihatDetailAdmin('${o.id}')" class="bg-white border border-gray-300 font-bold py-1 px-3 rounded-lg text-xs shadow-sm hover:bg-blue-50 transition-colors">Kelola</button>
                </div>
            </div>
        `;
        if(o.status === 'completed' || o.status === 'cancel') lCompleted.innerHTML += card;
        else lPending.innerHTML += card;
    });
}

let activeDetailOrderId = null;
window.lihatDetailAdmin = (id) => {
    const order = masterOrders.find(o => o.id === id);
    if(!order) return;
    activeDetailOrderId = id;

    let driverOptions = masterDrivers.filter(d => d.status !== 'banned').map(d => `<option value="${d.id}" ${order.driverId === d.id ? 'selected' : ''}>${d.name} (${d.kendaraan})</option>`).join('');
    let reassignHtml = '';
    
    if(order.status !== 'completed' && order.status !== 'cancel') {
        reassignHtml = `
            <div class="bg-yellow-50 border border-yellow-200 p-4 rounded-xl mt-2">
                <p class="text-[10px] font-bold text-yellow-700 uppercase mb-2 tracking-widest">🔄 Re-Assign Kurir</p>
                <div class="flex gap-2">
                    <select id="select-reassign" class="flex-1 border border-yellow-300 rounded-lg px-3 py-2 text-sm font-bold bg-white outline-none">
                        <option value="">-- Pilih Kurir Pengganti --</option>
                        ${driverOptions}
                    </select>
                    <button onclick="window.eksekusiReassign()" class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold px-4 py-2 rounded-lg text-sm shadow-md transition-colors">Pindah!</button>
                </div>
            </div>
        `;
    }

    let photoHtml = '';
    if (order.photoPickup || order.photoDropoff) {
        photoHtml = `<div class="grid grid-cols-2 gap-2 mt-2">`;
        if (order.photoPickup) photoHtml += `<div><p class="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-1">Evident PickUp</p><img src="${order.photoPickup}" class="w-full h-32 object-cover rounded-lg border border-gray-200 shadow-sm"></div>`;
        if (order.photoDropoff) photoHtml += `<div><p class="text-[9px] font-bold text-green-500 uppercase tracking-widest mb-1">Evident Selesai</p><img src="${order.photoDropoff}" class="w-full h-32 object-cover rounded-lg border border-gray-200 shadow-sm"></div>`;
        photoHtml += `</div>`;
    }

    document.getElementById('detail-pesanan-body').innerHTML = `
        <div class="bg-gray-50 p-3 rounded-xl border border-gray-200 text-sm">
            <p><b>Barang:</b> ${order.namaBarang} (${order.berat}KG)</p>
            <p class="mt-1"><b>Dari:</b> ${order.alamatJemput}</p>
            <p class="text-blue-600"><b>Ke:</b> ${order.alamatTujuan}</p>
        </div>
        ${reassignHtml}
        <div>
            <p class="text-[10px] font-bold text-gray-400 uppercase border-b mb-1">Evident Foto</p>
            ${photoHtml || '<p class="text-xs text-gray-400">Belum ada foto.</p>'}
        </div>
    `;

    document.getElementById('modal-detail-pesanan').classList.replace('hidden', 'flex');
};

window.eksekusiReassign = () => {
    const newDrvId = document.getElementById('select-reassign').value;
    if(!newDrvId) return alert("Pilih kurirnya bos!");
    
    const drv = masterDrivers.find(d => d.id === newDrvId);
    const idx = masterOrders.findIndex(o => o.id === activeDetailOrderId);
    if(idx !== -1 && drv) {
        masterOrders[idx].driverId = drv.id;
        masterOrders[idx].driverName = drv.name;
        masterOrders[idx].status = 'pending'; 
        saveDB('mapel_admin_master_orders', masterOrders);
        alert(`Order berhasil dipindah ke ${drv.name}!`);
        renderSemuaOrders();
        tutupModal('modal-detail-pesanan');
    }
};

window.batalPesananDariAdmin = () => {
    if(confirm('Yakin cancel order ini secara paksa?')) {
        const idx = masterOrders.findIndex(o => o.id === activeDetailOrderId);
        if(idx !== -1) {
            masterOrders[idx].status = 'cancel';
            saveDB('mapel_admin_master_orders', masterOrders);
            renderSemuaOrders();
            tutupModal('modal-detail-pesanan');
        }
    }
}

// ==========================================
// 5. MANAJEMEN EKSPEDISI
// ==========================================
function renderTableEkspedisi() {
    const tbody = document.getElementById('table-ekspedisi');
    tbody.innerHTML = '';
    adminEkspedisiList.forEach((e, i) => {
        tbody.innerHTML += `
            <tr class="border-b border-gray-100 hover:bg-gray-50 flex w-full">
                <td class="p-3 w-2/3 truncate"><p class="font-bold text-gray-800">${e.name}</p><p class="text-[9px] font-mono text-gray-400 mt-0.5">${e.lat}, ${e.lng}</p></td>
                <td class="p-3 w-1/3 text-center flex items-center justify-center"><button onclick="window.hapusEkspedisi(${i})" class="text-red-500 font-bold bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors text-xs">Hapus</button></td>
            </tr>
        `;
    });
    renderTitikEkspedisiMaps();
    if(typeof renderRadarEksList === 'function') renderRadarEksList();
}

window.simpanEkspedisi = function() {
    const nama = document.getElementById('f-eks-nama').value;
    const link = document.getElementById('f-eks-link').value;
    let lat = parseFloat(document.getElementById('f-eks-lat').value);
    let lng = parseFloat(document.getElementById('f-eks-lng').value);

    if(!nama) return alert("Nama gerai wajib diisi bos!");

    if(link && link.trim() !== '') {
        const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
        const match = link.match(regex);
        if(match) { lat = parseFloat(match[1]); lng = parseFloat(match[2]); } 
        else return alert("Link Gmaps ngga valid.");
    }

    if(isNaN(lat) || isNaN(lng)) return alert("Koordinat ngga valid, klik peta atau paste link gmaps yg bener!");
    
    adminEkspedisiList.push({ name: nama, lat, lng });
    saveDB('mapel_ekspedisi', adminEkspedisiList);
    
    document.getElementById('f-eks-nama').value = ''; document.getElementById('f-eks-link').value = '';
    document.getElementById('f-eks-lat').value = ''; document.getElementById('f-eks-lng').value = '';
    if(tempEksPin) eksMap.removeLayer(tempEksPin);
    
    renderTableEkspedisi();
    eksMap.setView([lat, lng], 16);
    
    // Tutup pelan-pelan sheetnya
    const sheet = document.getElementById('sheet-ekspedisi');
    if(sheet) { sheet.style.transform = 'translateY(calc(100% - 70px))'; isSheetEksOpen = false; }
};

window.hapusEkspedisi = (i) => { if(confirm("Hapus titik ini dari aplikasi Customer?")) { adminEkspedisiList.splice(i, 1); saveDB('mapel_ekspedisi', adminEkspedisiList); renderTableEkspedisi(); } };

// ==========================================
// 6. INTERNAL AKUN DRIVER
// ==========================================
function renderTableDriverAdmin() {
    const tbody = document.getElementById('table-driver-crud');
    if(!tbody) return;
    tbody.innerHTML = '';
    if(masterDrivers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-gray-400 text-sm font-bold">Belum ada akun driver.</td></tr>`;
        return;
    }
    masterDrivers.forEach((d, i) => {
        const isBanned = d.status === 'banned';
        tbody.innerHTML += `
            <tr class="border-b border-gray-100 hover:bg-gray-50 ${isBanned ? 'opacity-60 bg-red-50' : ''}">
                <td class="p-4"><p class="font-black text-gray-800 text-sm truncate">${d.name}</p><p class="text-[9px] text-blue-600 font-mono tracking-widest mt-0.5">${d.id}</p></td>
                <td class="p-4"><p class="text-xs font-bold text-gray-800 truncate">U: <span class="text-blue-600">${d.username}</span></p><p class="text-[10px] text-gray-500 font-mono">P: ${d.password}</p></td>
                <td class="p-4"><p class="text-xs font-bold text-gray-700">${d.kendaraan} <span class="font-normal text-gray-500">(${d.warna})</span></p><p class="text-[10px] text-gray-500 uppercase font-black">${d.nopol}</p></td>
                <td class="p-4"><span class="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider ${isBanned ? 'bg-red-200 text-red-700' : 'bg-green-100 text-green-700'}">${isBanned ? 'BANNED' : 'AKTIF'}</span></td>
                <td class="p-4 text-center space-y-1">
                    <button onclick="window.editDriver(${i})" class="w-full block text-[10px] font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">Edit</button>
                    <button onclick="window.toggleBanned(${i})" class="w-full block text-[10px] font-bold px-3 py-1.5 rounded-lg ${isBanned ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}">${isBanned ? 'Buka Ban' : 'Banned'}</button>
                </td>
            </tr>
        `;
    });
}

window.bukaModalDriver = () => {
    document.getElementById('d-id').value = "IDME-" + Math.floor(1000 + Math.random() * 9000);
    document.getElementById('d-user').value = ''; document.getElementById('d-pass').value = '';
    document.getElementById('d-nama').value = ''; document.getElementById('d-wa').value = '';
    document.getElementById('d-nopol').value = ''; document.getElementById('d-warna').value = '';
    document.getElementById('d-tipe').value = 'Motor';
    document.getElementById('d-edit-index').value = '-1';
    
    document.getElementById('modal-form-driver').classList.replace('hidden', 'flex');
}

window.editDriver = (idx) => {
    const d = masterDrivers[idx];
    document.getElementById('d-id').value = d.id; 
    document.getElementById('d-user').value = d.username; document.getElementById('d-pass').value = d.password;
    document.getElementById('d-nama').value = d.name; document.getElementById('d-wa').value = d.wa;
    document.getElementById('d-nopol').value = d.nopol; document.getElementById('d-warna').value = d.warna;
    document.getElementById('d-tipe').value = d.kendaraan;
    document.getElementById('d-edit-index').value = idx;
    
    document.getElementById('modal-form-driver').classList.replace('hidden', 'flex');
}

window.simpanAkunDriver = () => {
    const idDriver = document.getElementById('d-id').value.trim().toUpperCase();
    const data = {
        id: idDriver,
        username: document.getElementById('d-user').value.trim(),
        password: document.getElementById('d-pass').value.trim(),
        name: document.getElementById('d-nama').value.trim(),
        wa: document.getElementById('d-wa').value,
        nopol: document.getElementById('d-nopol').value.toUpperCase(),
        warna: document.getElementById('d-warna').value,
        kendaraan: document.getElementById('d-tipe').value,
        status: 'active'
    };

    if(!data.id || !data.username || !data.password || !data.name || !data.nopol) return alert("Lengkapi ID, kredensial, nama, dan Nopol kendaraan!");

    const editIdx = parseInt(document.getElementById('d-edit-index').value);
    
    if(editIdx === -1) {
        masterDrivers.push(data);
    } else {
        data.status = masterDrivers[editIdx].status; 
        masterDrivers[editIdx] = data;
    }

    saveDB('mapel_admin_master_drivers', masterDrivers);
    renderTableDriverAdmin();
    tutupModal('modal-form-driver');
};

window.toggleBanned = (i) => {
    const action = masterDrivers[i].status === 'banned' ? 'mengaktifkan' : 'mem-banned';
    if(confirm(`Yakin ingin ${action} akun ${masterDrivers[i].name}?`)) {
        masterDrivers[i].status = masterDrivers[i].status === 'banned' ? 'active' : 'banned';
        saveDB('mapel_admin_master_drivers', masterDrivers);
        renderTableDriverAdmin();
    }
}

// ==========================================
// 7. BROADCAST PESAN & 8. PRICING & PROMO 
// ==========================================
window.kirimBroadcast = () => {
    const tgt = document.getElementById('bc-target').value;
    const title = document.getElementById('bc-title').value;
    const msg = document.getElementById('bc-msg').value;
    if(!title || !msg) return alert("Isi judul dan pesan bos!");
    alert(`Broadcast "${title}" berhasil diledakkan ke ${tgt.toUpperCase()}! 🚀`);
    document.getElementById('bc-title').value = ''; document.getElementById('bc-msg').value = '';
}

window.loadTarif = () => {
    document.getElementById('tf-base').value = tarifConfig.base; document.getElementById('tf-perkm').value = tarifConfig.perkm;
    document.getElementById('tf-maxkg').value = tarifConfig.maxkg; document.getElementById('tf-extrakg').value = tarifConfig.extrakg;
    document.getElementById('tf-dimensi').value = tarifConfig.dimensi; document.getElementById('tf-disc').value = tarifConfig.disc;
}
window.simpanTarif = () => {
    tarifConfig = {
        base: Number(document.getElementById('tf-base').value), perkm: Number(document.getElementById('tf-perkm').value),
        maxkg: Number(document.getElementById('tf-maxkg').value), extrakg: Number(document.getElementById('tf-extrakg').value),
        dimensi: Number(document.getElementById('tf-dimensi').value), disc: Number(document.getElementById('tf-disc').value)
    };
    saveDB('mapel_tarif_config', tarifConfig);
    alert("Konfigurasi Tarif Tersimpan Sistem! 💰");
}

let tempPromoBase64 = null;
const prmFileInput = document.getElementById('prm-file');
if(prmFileInput) {
    prmFileInput.addEventListener('change', function(e) {
        const file = e.target.files[0]; if(!file) return;
        document.getElementById('prm-placeholder').innerHTML = '<span class="text-xs font-bold text-gray-400 animate-pulse">Memproses...</span>';
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const cvs = document.createElement('canvas'); const ctx = cvs.getContext('2d');
                const MAX_WIDTH = 600; let scale = 1;
                if (img.width > MAX_WIDTH) scale = MAX_WIDTH / img.width;
                cvs.width = img.width * scale; cvs.height = img.height * scale;
                ctx.drawImage(img, 0, 0, cvs.width, cvs.height);
                tempPromoBase64 = cvs.toDataURL('image/jpeg', 0.8);
                
                document.getElementById('prm-preview').src = tempPromoBase64;
                document.getElementById('prm-preview').classList.remove('hidden');
                document.getElementById('prm-placeholder').classList.add('hidden');
            }
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    });
}

window.simpanPromo = () => {
    const title = document.getElementById('prm-title').value;
    if(!title || !tempPromoBase64) return alert("Isi Judul dan Upload Foto/Banner Promo!");
    promoList.push({ id: Date.now(), title, img: tempPromoBase64 });
    saveDB('mapel_promo_list', promoList);
    
    document.getElementById('prm-title').value = ''; tempPromoBase64 = null;
    document.getElementById('prm-preview').classList.add('hidden'); document.getElementById('prm-placeholder').classList.remove('hidden');
    document.getElementById('prm-placeholder').innerHTML = '<span class="text-2xl mb-2 block">📸</span><p class="text-xs font-bold">Klik untuk Upload</p>';
    renderPromo();
}

window.renderPromo = () => {
    const list = document.getElementById('list-promo');
    if(!list) return;
    list.innerHTML = '';
    if(promoList.length === 0) list.innerHTML = '<p class="text-xs font-bold text-gray-400 col-span-2">Belum ada promo aktif.</p>';
    promoList.forEach((p, i) => {
        list.innerHTML += `
            <div class="border border-gray-200 rounded-xl overflow-hidden relative shadow-sm hover:shadow-md transition-shadow">
                <button onclick="window.hapusPromo(${i})" class="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center font-bold text-xs shadow-lg transition-colors">X</button>
                <img src="${p.img}" class="w-full h-32 object-cover">
                <div class="p-3 bg-white text-center font-black text-xs uppercase text-gray-800 truncate">${p.title}</div>
            </div>
        `;
    });
}
window.hapusPromo = (i) => { if(confirm("Hapus promo ini?")) { promoList.splice(i, 1); saveDB('mapel_promo_list', promoList); renderPromo(); } };

// INIT START
setTimeout(() => { switchMenu('radar'); updateRadarStats(); }, 500);
