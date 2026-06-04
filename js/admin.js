/**
 * ADMIN ENGINE - MAPEL EXPRESS
 * (BUG FIXES: NOTIFICATION LIST, IMAGE COMPRESSION, & DB ERROR HANDLING)
 */

const sb = window.sb || (typeof supabase !== 'undefined' ? supabase : null);
const OFFICE = { lat: -6.977414, lng: 107.555359 }; // Titik Tengah Peta

// ===============================================
// 1. UI & NAVIGASI UMUM & NOTIFIKASI
// ===============================================
window.notifAdminData = []; // Memori nyimpan daftar lonceng notif

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if(sidebar && overlay) { sidebar.classList.toggle('-translate-x-full'); overlay.classList.toggle('hidden'); }
};

window.bukaNotifAdmin = function() {
    const modal = document.getElementById('modal-notif-admin');
    const dot = document.getElementById('admin-notif-dot');
    if(modal) modal.classList.replace('hidden', 'flex');
    if(dot) dot.classList.add('hidden'); 
    window.renderNotif(); // Tampilkan list saat dibuka
};

window.tutupModal = function(id) { 
    const md = document.getElementById(id);
    if(md) md.classList.replace('flex', 'hidden'); 
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

const viewTitles = {
    'radar': 'Radar Kurir & Map', 'dispatch': 'Manajemen Dispatcher', 'broadcast': 'Broadcast Global', 'pricing': 'Pengaturan Tarif Dinamis', 'promo': 'Manajemen Promo', 'driver': 'Data Akun Driver'
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

    const views = ['view-radar', 'view-dispatch', 'view-broadcast', 'view-pricing', 'view-promo', 'view-driver'];
    views.forEach(v => { const el = document.getElementById(v); if(el) el.classList.add('hidden'); });
    
    const targetView = document.getElementById(`view-${menuId}`);
    if(targetView) {
        if(menuId === 'radar' || menuId === 'dispatch') targetView.classList.replace('hidden', 'flex');
        else targetView.classList.remove('hidden');
    }

    if (menuId === 'radar' && typeof adminMap !== 'undefined' && adminMap) { setTimeout(() => adminMap.invalidateSize(), 300); }
};

// ===============================================
// 1.A LOGIC NOTIFIKASI
// ===============================================
window.tambahNotif = function(pesan) {
    const time = new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
    window.notifAdminData.unshift({ pesan, time }); // Masukin notif baru ke paling atas
    
    const dot = document.getElementById('admin-notif-dot');
    if(dot) dot.classList.remove('hidden'); // Munculin titik merah
};

window.renderNotif = function() {
    const container = document.getElementById('list-notif-admin');
    if(!container) return;
    
    if(window.notifAdminData.length === 0) {
        container.innerHTML = '<p class="text-center text-sm font-bold text-gray-400 mt-4">Belum ada aktivitas baru.</p>';
        return;
    }
    
    container.innerHTML = '';
    window.notifAdminData.forEach(n => {
        container.innerHTML += `
            <div class="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-3">
                <div class="bg-blue-600 text-white p-1.5 rounded-full mt-0.5">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
                </div>
                <div>
                    <p class="text-xs font-bold text-gray-800">${n.pesan}</p>
                    <span class="text-[9px] text-gray-500 font-bold">${n.time}</span>
                </div>
            </div>
        `;
    });
};

// ===============================================
// 2. RADAR MAP (MAP LAYER, GPS, RADIUS, ASSET)
// ===============================================
let adminMap = null;
let tempEksMarker = null;
let arrayMarkerEkspedisi = [];
let radiusCircle = null;
let tileStreet = null;
let tileSat = null;
let isSatMode = false;
let holdMapTimer = null;

if (typeof L !== 'undefined' && document.getElementById('admin-map')) {
    
    adminMap = L.map('admin-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
    
    tileStreet = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 });
    tileSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 });
    tileStreet.addTo(adminMap); 

    const basecampIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] });
    L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon, zIndexOffset: 999 }).addTo(adminMap).bindPopup("<b class='text-sm'>Markas MapelExpress</b>");

    const startHoldTimer = (e) => { holdMapTimer = setTimeout(() => { bikinTitikDariMap(e); }, 3000); };
    const clearHoldTimer = () => { if (holdMapTimer) clearTimeout(holdMapTimer); };

    adminMap.on('mousedown', startHoldTimer); adminMap.on('mouseup mousemove', clearHoldTimer);
    adminMap.on('touchstart', startHoldTimer); adminMap.on('touchend touchmove', clearHoldTimer);
    adminMap.on('contextmenu', function(e) { clearHoldTimer(); bikinTitikDariMap(e); });
}

function bikinTitikDariMap(e) {
    document.getElementById('f-eks-lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('f-eks-lng').value = e.latlng.lng.toFixed(6);
    if(tempEksMarker) adminMap.removeLayer(tempEksMarker);
    tempEksMarker = L.marker(e.latlng).addTo(adminMap).bindPopup("<span class='text-xs font-bold'>Titik Gerai Baru</span>").openPopup();

    const sheet = document.getElementById('sheet-ekspedisi');
    if(sheet && sheet.classList.contains('translate-y-[calc(100%-85px)]')) { window.toggleSheetEks(); }
}

window.toggleMapLayer = function() {
    if(!adminMap) return;
    if (isSatMode) { adminMap.removeLayer(tileSat); tileStreet.addTo(adminMap); } 
    else { adminMap.removeLayer(tileStreet); tileSat.addTo(adminMap); }
    isSatMode = !isSatMode;
};

window.locateGPS = function() {
    if(!adminMap) return;
    adminMap.locate({ setView: true, maxZoom: 16 });
};

// ===============================================
// 2.A SISTEM RADIUS DINAMIS
// ===============================================
window.bukaModalRadius = function() { document.getElementById('modal-radius').classList.replace('hidden', 'flex'); };

window.drawRadiusCircle = function(km) {
    if(!adminMap) return;
    if(radiusCircle) adminMap.removeLayer(radiusCircle);
    radiusCircle = L.circle([OFFICE.lat, OFFICE.lng], { color: '#3B82F6', fillColor: '#60A5FA', fillOpacity: 0.15, weight: 2, radius: (km || 15) * 1000 }).addTo(adminMap);
};

window.simpanRadius = async function() {
    const km = document.getElementById('input-radius-km').value;
    if(!km) return alert('Isi dulu radius kilometernya bro!');
    try {
        const { data } = await sb.from('settings').select('*').eq('id', 1).single();
        let currentData = data ? data.data : {};
        currentData.radius_km = parseFloat(km);
        
        const { error } = await sb.from('settings').upsert({ id: 1, data: currentData });
        if(error) throw error;
        
        alert("Radius wilayah berhasil disetel!");
        window.tutupModal('modal-radius');
        window.drawRadiusCircle(parseFloat(km));
    } catch(e) { alert('Gagal Simpan Radius: ' + e.message); }
};

// ===============================================
// 2.B KELOLA ASET / EKSPEDISI
// ===============================================
window.toggleSheetEks = function() {
    const sheet = document.getElementById('sheet-ekspedisi');
    if(sheet) {
        if(sheet.classList.contains('translate-y-[calc(100%-85px)]')) {
            sheet.classList.remove('translate-y-[calc(100%-85px)]');
            sheet.classList.add('translate-y-0');
        } else {
            sheet.classList.remove('translate-y-0');
            sheet.classList.add('translate-y-[calc(100%-85px)]');
            if(tempEksMarker && adminMap) adminMap.removeLayer(tempEksMarker); 
        }
    }
};

function getIconEkspedisi(namaCabang) {
    let nama = namaCabang.toLowerCase();
    let iconFile = 'pin.png'; let bgColor = '#ffffff'; 
    if (nama.includes('jne')) iconFile = 'jne.png';
    else if (nama.includes('j&t') || nama.includes('jnt') || nama.includes('j & t')) iconFile = 'j&t.png';
    else if (nama.includes('sicepat') || nama.includes('si cepat')) iconFile = 'sicepat.png';
    else if (nama.includes('shopee') || nama.includes('spx')) iconFile = 'spx.png';
    else if (nama.includes('ninja')) { iconFile = 'ninja.png'; bgColor = '#dc2626'; } 
    else if (nama.includes('anteraja')) iconFile = 'anteraja.png';
    else if (nama.includes('wahana')) iconFile = 'wahana.png'; 

    const safeIconFile = encodeURIComponent(iconFile); const timeStamp = new Date().getTime();
    const htmlMarker = `<div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background-color:${bgColor}; border-radius:50%; box-shadow:0 4px 10px rgba(0,0,0,0.3); border:2px solid white; overflow:hidden;"><img src="/assets/icons/${safeIconFile}?v=${timeStamp}" style="width:30px; height:30px; object-fit:contain;" onerror="this.src='/assets/icons/pin.png'" /></div>`;
    return L.divIcon({ className: '', html: htmlMarker, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] });
}

window.loadEkspedisi = async function() {
    if (!sb) return; 
    try {
        const { data } = await sb.from('ekspedisi').select('*');
        if (data) {
            arrayMarkerEkspedisi.forEach(m => m.remove()); arrayMarkerEkspedisi = [];
            const tabelEks = document.getElementById('table-ekspedisi'); const listRadar = document.getElementById('radar-eks-list'); 
            if(tabelEks) tabelEks.innerHTML = ''; if(listRadar) listRadar.innerHTML = '';

            data.forEach(titik => {
                const iconEks = getIconEkspedisi(titik.nama); 
                const popupContent = `<div style="text-align:center; min-width:120px;"><p style="font-weight:900; margin-bottom:8px;">${titik.nama}</p><button onclick="window.hapusEkspedisi(${titik.id}, '${titik.nama}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; width:100%;">🗑️ Hapus</button></div>`;
                if(adminMap) arrayMarkerEkspedisi.push(L.marker([titik.lat, titik.lng], { icon: iconEks }).addTo(adminMap).bindPopup(popupContent));
                if(tabelEks) tabelEks.innerHTML += `<tr><td class="p-3 font-bold text-xs">${titik.nama}</td><td class="p-3 text-center w-20"><button onclick="window.hapusEkspedisi(${titik.id}, '${titik.nama}')" class="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1.5 rounded-lg font-bold text-xs">Hapus</button></td></tr>`;
                if(listRadar) listRadar.innerHTML += `<div class="bg-white border border-gray-100 p-2 rounded-lg shadow-sm flex justify-between items-center cursor-pointer hover:bg-gray-50" onclick="if(adminMap) adminMap.setView([${titik.lat}, ${titik.lng}], 16)"><p class="text-xs font-bold text-gray-700">${titik.nama}</p><span class="text-[10px] text-gray-400 font-bold">Lihat</span></div>`;
            });
        }
    } catch(err) { console.error("Error Load:", err); }
};

window.simpanEkspedisi = async function() {
    try {
        const nama = document.getElementById('f-eks-nama').value;
        const lat = document.getElementById('f-eks-lat').value; const lng = document.getElementById('f-eks-lng').value;
        if(!nama || !lat || !lng) return alert("⚠️ ISI NAMA CABANG & TAHAN PETA 3 DETIK DULU!");
        
        const { error } = await sb.from('ekspedisi').insert([{ nama: nama, lat: parseFloat(lat), lng: parseFloat(lng) }]);
        if(error) throw error;

        document.getElementById('f-eks-nama').value = '';
        if(tempEksMarker && adminMap) adminMap.removeLayer(tempEksMarker);
        window.loadEkspedisi(); window.toggleSheetEks(); 
    } catch(e) { alert("❌ ERROR: " + e.message); }
};

window.hapusEkspedisi = async function(id, nama) {
    if(!confirm(`Yakin mau menghapus titik gerai "${nama}"?`)) return;
    await sb.from('ekspedisi').delete().eq('id', id);
    window.loadEkspedisi(); 
};

// ===============================================
// 3. DISPATCHER ORDER
// ===============================================
window.loadOrders = async function() {
    if(!sb) return;
    try {
        const { data } = await sb.from('orders').select('*').order('created_at', { ascending: false });
        const divPending = document.getElementById('list-order-pending'); const divActive = document.getElementById('list-order-active'); const divCancel = document.getElementById('list-order-cancel');
        if(!divPending || !divActive || !divCancel) return;
        divPending.innerHTML = ''; divActive.innerHTML = ''; divCancel.innerHTML = '';
        let cPen = 0, cAct = 0, cCan = 0;

        if (data) {
            data.forEach(o => {
                const od = o.data; 
                const timeCreated = new Date(o.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
                let cardHTML = `
                    <div class="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer" onclick='window.lihatDetailOrder(${JSON.stringify(o).replace(/'/g, "&#39;")})'>
                        <div class="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
                            <span class="text-xs font-black text-gray-800 uppercase">${o.id}</span>
                            <span class="text-[10px] text-gray-500 font-bold">${timeCreated}</span>
                        </div>
                        <div class="mb-2"><p class="text-[10px] font-bold text-gray-400 uppercase">Pengirim</p><p class="text-xs font-bold text-gray-800">${od.sender_name || '-'} <span class="text-blue-500">(${od.sender_phone || '-'})</span></p></div>
                        <div class="mb-2"><p class="text-[10px] font-bold text-gray-400 uppercase">Penerima</p><p class="text-xs font-bold text-gray-800">${od.receiver_name || '-'} <span class="text-blue-500">(${od.receiver_phone || '-'})</span></p></div>
                        <div class="bg-gray-50 p-2 rounded-lg mt-3"><p class="text-[10px] font-bold text-gray-600 truncate">📍 Jemput: ${od.pickup_address || '-'}</p><p class="text-[10px] font-bold text-gray-600 truncate mt-1">🏁 Antar: ${od.dropoff_address || '-'}</p></div>
                `;
                if (o.status === 'pending') {
                    cardHTML += `<div class="flex gap-2 mt-3" onclick="event.stopPropagation()"><button onclick="window.updateStatusOrder('${o.id}', 'cancelled')" class="flex-1 bg-red-50 text-red-600 border border-red-200 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100">Batalkan</button><button onclick="alert('Fitur Assign Driver Manual akan dikembangkan.')" class="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm">Dispos</button></div></div>`;
                    divPending.innerHTML += cardHTML; cPen++;
                } else if (o.status === 'active' || o.status === 'process') {
                    cardHTML += `<div class="mt-3 pt-3 border-t border-gray-100"><p class="text-[10px] font-black text-blue-600 uppercase">👷 Dikerjakan Oleh: ${od.driver_name || 'Driver Aktif'}</p></div></div>`;
                    divActive.innerHTML += cardHTML; cAct++;
                } else if (o.status === 'cancelled') {
                    cardHTML += `</div>`; divCancel.innerHTML += cardHTML; cCan++;
                }
            });
        }
        document.getElementById('count-pending').innerText = cPen; document.getElementById('count-active').innerText = cAct; document.getElementById('count-cancel').innerText = cCan;
    } catch(e) { console.log(e); }
};

window.updateStatusOrder = async function(orderId, newStatus) {
    if(!confirm(`Ubah status order ini menjadi ${newStatus}?`)) return;
    try {
        const { error } = await sb.from('orders').update({ status: newStatus }).eq('id', orderId);
        if(error) throw error;
        window.loadOrders();
    } catch (e) { alert("Error update status: " + e.message); }
};

window.lihatDetailOrder = function(order) {
    const modal = document.getElementById('modal-detail-order');
    const body = document.getElementById('detail-order-body');
    const d = order.data || {};
    let historyHtml = '';
    if(order.status === 'active' || order.status === 'process') {
        historyHtml = `
            <div class="bg-blue-50 border border-blue-100 p-4 rounded-xl mt-4">
                <h4 class="text-xs font-black text-blue-800 mb-3 border-b border-blue-200 pb-2">Jejak Pekerjaan Real-Time</h4>
                <div class="space-y-3">
                    <div class="flex gap-3 items-center"><div class="w-2 h-2 bg-green-500 rounded-full"></div><p class="text-xs font-bold text-gray-700">Order Dibuat: <span class="font-normal text-gray-500">${new Date(order.created_at).toLocaleString('id-ID')}</span></p></div>
                    <div class="flex gap-3 items-center"><div class="w-2 h-2 bg-blue-500 rounded-full"></div><p class="text-xs font-bold text-gray-700">Diambil Driver: <span class="font-normal text-blue-600">${d.driver_name || 'N/A'}</span></p></div>
                    ${d.pickup_photo ? `<div class="ml-5"><img src="${d.pickup_photo}" class="h-20 rounded border border-gray-300"></div>` : ''}
                    ${d.dropoff_photo ? `<div class="flex gap-3 items-center"><div class="w-2 h-2 bg-gray-900 rounded-full"></div><p class="text-xs font-bold text-gray-700">Tiba di Tujuan</p></div><div class="ml-5"><img src="${d.dropoff_photo}" class="h-20 rounded border border-gray-300"></div>` : ''}
                </div>
            </div>
        `;
    }

    body.innerHTML = `
        <div class="flex justify-between border-b border-gray-100 pb-3"><p class="text-sm font-black text-gray-800">ORDER ID: ${order.id}</p><span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold uppercase">${order.status}</span></div>
        <div class="grid grid-cols-2 gap-4">
            <div><p class="text-[10px] font-bold text-gray-400 uppercase">Pengirim</p><p class="text-xs font-bold text-gray-800">${d.sender_name || '-'}</p><p class="text-[10px] text-gray-500">${d.sender_phone || '-'}</p></div>
            <div><p class="text-[10px] font-bold text-gray-400 uppercase">Penerima</p><p class="text-xs font-bold text-gray-800">${d.receiver_name || '-'}</p><p class="text-[10px] text-gray-500">${d.receiver_phone || '-'}</p></div>
        </div>
        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2">
            <div><p class="text-[10px] font-bold text-gray-400 uppercase">Lokasi Jemput</p><p class="text-xs font-bold text-gray-700">${d.pickup_address || '-'}</p></div>
            <div><p class="text-[10px] font-bold text-gray-400 uppercase">Lokasi Antar</p><p class="text-xs font-bold text-gray-700">${d.dropoff_address || '-'}</p></div>
        </div>
        ${historyHtml}
    `;
    modal.classList.replace('hidden', 'flex');
};

// ===============================================
// 4. MANAGEMENT DRIVER (COMPRESSION & FIX DB ERROR)
// ===============================================
window.bukaModalDriver = function() {
    document.getElementById('modal-form-driver').classList.replace('hidden', 'flex');
    document.getElementById('d-foto-preview').classList.add('hidden');
    document.getElementById('d-foto-placeholder').classList.remove('hidden');
    document.getElementById('d-foto-base64').value = '';
};

window.previewFotoDriver = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 300; const MAX_HEIGHT = 300; // Kompres gambar biar ringan di database
                let width = img.width; let height = img.height;

                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                
                canvas.width = width; canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);

                document.getElementById('d-foto-preview').src = dataUrl;
                document.getElementById('d-foto-preview').classList.remove('hidden');
                document.getElementById('d-foto-placeholder').classList.add('hidden');
                document.getElementById('d-foto-base64').value = dataUrl; 
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
};

window.loadDrivers = async function() {
    if(!sb) return;
    try {
        const { data } = await sb.from('drivers').select('*');
        const tbody = document.getElementById('table-driver-crud');
        if(!tbody) return;
        if (data && data.length > 0) {
            tbody.innerHTML = '';
            data.forEach(d => {
                const fotoProfile = d.foto || '/assets/icons/pin.png'; 
                tbody.innerHTML += `<tr class="hover:bg-gray-50 transition-colors"><td class="p-4 pl-6 flex items-center gap-3"><img src="${fotoProfile}" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" onerror="this.src='/assets/icons/pin.png'"><div><p class="font-bold text-gray-800">${d.nama}</p><p class="text-[10px] text-gray-500 font-bold">${d.whatsapp}</p></div></td><td class="p-4"><p class="font-bold text-blue-600">${d.username}</p><p class="text-[10px] text-gray-500 font-bold">Pass: ${d.password}</p></td><td class="p-4"><p class="font-black text-gray-800 uppercase tracking-widest text-xs">${d.nopol}</p><p class="text-[10px] text-gray-500 font-bold">${d.tipe_kendaraan}</p></td><td class="p-4"><span class="bg-green-100 text-green-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Aktif</span></td><td class="p-4 text-center"><button onclick="window.hapusDriver(${d.id}, '${d.nama}')" class="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-black transition-colors">Hapus</button></td></tr>`;
            });
        }
    } catch(err) { console.error(err); }
};

window.simpanAkunDriver = async function() {
    const user = document.getElementById('d-user').value;
    const pass = document.getElementById('d-pass').value;
    const nama = document.getElementById('d-nama').value;
    const wa = document.getElementById('d-wa').value;
    const tipe = document.getElementById('d-tipe').value;
    const nopol = document.getElementById('d-nopol').value;
    const foto = document.getElementById('d-foto-base64').value || ''; // Kalau gak masukin foto, kasih string kosong

    if(!user || !pass || !nama || !nopol || !wa) return alert("⚠️ Lengkapi semua kolom form (kecuali foto kalau tidak ada)!");
    
    try {
        const { error } = await sb.from('drivers').insert([{ username: user, password: pass, nama: nama, whatsapp: wa, tipe_kendaraan: tipe, nopol: nopol, foto: foto, status: 'aktif' }]);
        
        if (error) throw error; // Wajib di-throw biar ketahuan errornya dari database
        
        alert(`✅ Akun Driver ${nama} berhasil diterbitkan.`);
        window.tutupModal('modal-form-driver');
        window.loadDrivers(); 
    } catch(e) { alert("❌ Gagal simpan driver: " + e.message); }
};

window.hapusDriver = async function(id, nama) {
    if(!confirm(`Putus mitra dan hapus akun ${nama}?`)) return;
    await sb.from('drivers').delete().eq('id', id);
    window.loadDrivers(); 
};

// ===============================================
// 5. PROMOSI & BROADCAST (COMPRESSION PROMO)
// ===============================================
window.previewPromo = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                const MAX_WIDTH = 800; const MAX_HEIGHT = 400; // Kompres gambar promo
                let width = img.width; let height = img.height;

                if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
                else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
                
                canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                document.getElementById('prm-preview').src = dataUrl; document.getElementById('prm-preview').classList.remove('hidden'); document.getElementById('prm-placeholder').classList.add('hidden'); document.getElementById('prm-base64').value = dataUrl; 
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
};

window.simpanBroadcast = async function() { alert("Fitur Kirim Broadcast (Icon Lonceng Global) akan tersedia."); }; 
window.loadPromos = async function() {};
window.simpanPromo = async function() {};

// ===============================================
// 6. DYNAMIC PRICING (TIDAK ADA PERUBAHAN)
// ===============================================
window.listKategoriBerat = []; window.listKategoriDimensi = [];
window.loadTarif = async function() {
    if(!sb) return;
    try {
        const { data } = await sb.from('settings').select('*').eq('id', 1).single();
        if(data && data.data) {
            document.getElementById('tf-base').value = data.data.jarak_dasar || '';
            document.getElementById('tf-perkm').value = data.data.jarak_per_km || '';
            document.getElementById('input-radius-km').value = data.data.radius_km || 15;
            window.drawRadiusCircle(data.data.radius_km || 15);
            window.listKategoriBerat = data.data.kategori_berat || []; window.listKategoriDimensi = data.data.kategori_dimensi || [];
            window.renderBerat(); window.renderDimensi();
        }
    } catch(e) { console.log("Belum ada setting awal."); }
}
window.tambahListBerat = function() { const n = document.getElementById('input-berat-nama').value.trim(); const h = parseInt(document.getElementById('input-berat-harga').value) || 0; if (n) { window.listKategoriBerat.push({ nama: n, harga: h }); document.getElementById('input-berat-nama').value=''; document.getElementById('input-berat-harga').value=''; window.renderBerat(); } };
window.hapusBerat = function(idx) { window.listKategoriBerat.splice(idx, 1); window.renderBerat(); };
window.renderBerat = function() { const ul = document.getElementById('render-list-berat'); if(!ul) return; ul.innerHTML = ''; window.listKategoriBerat.forEach((item, index) => { let ht = item.harga === 0 ? '<span class="text-green-600 font-black">Gratis</span>' : `<span class="text-orange-600 font-black">+ Rp ${item.harga.toLocaleString('id-ID')}</span>`; ul.innerHTML += `<li class="bg-white border border-gray-200 p-3 rounded-xl flex justify-between items-center shadow-sm"><div><p class="text-xs font-bold text-gray-800">${item.nama}</p><p class="text-[10px] mt-0.5">${ht}</p></div><button onclick="window.hapusBerat(${index})" class="bg-red-50 text-red-500 p-2 rounded-lg text-xs font-bold">Hapus</button></li>`; }); };
window.tambahListDimensi = function() { const n = document.getElementById('input-dimensi-nama').value.trim(); const h = parseInt(document.getElementById('input-dimensi-harga').value) || 0; if (n) { window.listKategoriDimensi.push({ nama: n, harga: h }); document.getElementById('input-dimensi-nama').value=''; document.getElementById('input-dimensi-harga').value=''; window.renderDimensi(); } };
window.hapusDimensi = function(idx) { window.listKategoriDimensi.splice(idx, 1); window.renderDimensi(); };
window.renderDimensi = function() { const ul = document.getElementById('render-list-dimensi'); if(!ul) return; ul.innerHTML = ''; window.listKategoriDimensi.forEach((item, index) => { let ht = item.harga === 0 ? '<span class="text-green-600 font-black">Gratis</span>' : `<span class="text-orange-600 font-black">+ Rp ${item.harga.toLocaleString('id-ID')}</span>`; ul.innerHTML += `<li class="bg-white border border-gray-200 p-3 rounded-xl flex justify-between items-center shadow-sm"><div><p class="text-xs font-bold text-gray-800">${item.nama}</p><p class="text-[10px] mt-0.5">${ht}</p></div><button onclick="window.hapusDimensi(${index})" class="bg-red-50 text-red-500 p-2 rounded-lg text-xs font-bold">Hapus</button></li>`; }); };
window.simpanSemuaTarif = async function() {
    const baseFare = document.getElementById('tf-base').value; const perKmFare = document.getElementById('tf-perkm').value;
    if(!baseFare || !perKmFare) return alert("⚠️ Isi tarif jarak dasar!");
    try {
        const { data: exData } = await sb.from('settings').select('*').eq('id', 1).single();
        const dataTarif = { ...(exData ? exData.data : {}), jarak_dasar: parseInt(baseFare), jarak_per_km: parseInt(perKmFare), kategori_berat: window.listKategoriBerat, kategori_dimensi: window.listKategoriDimensi };
        const { error } = await sb.from('settings').upsert({ id: 1, data: dataTarif });
        if(error) throw error; alert("✅ Konfigurasi Tarif berhasil disimpan!");
    } catch (e) { alert("Error: " + e.message); }
};

// ===============================================
// INITIALIZE & REALTIME LISTENER
// ===============================================
setTimeout(() => { 
    window.loadEkspedisi();
    window.loadOrders();
    window.loadTarif();
    window.loadDrivers();
}, 1000);

if (sb) {
    sb.channel('public:orders')
        // Tangkap kalau ada orderan baru yang masuk database
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => { 
            window.tambahNotif(`Pesanan Baru Masuk! (ID: ${payload.new.id.split('-')[0]})`);
            window.loadOrders(); 
        })
        // Tangkap kalau status orderan berubah (diambil driver / selesai)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => { 
            if(payload.new.status) window.tambahNotif(`Status Order ${payload.new.id.split('-')[0]} => ${payload.new.status.toUpperCase()}`);
            window.loadOrders(); 
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ekspedisi' }, payload => { window.loadEkspedisi(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, payload => { window.loadDrivers(); })
        .subscribe();
}
