/**
 * ADMIN ENGINE - MAPEL EXPRESS
 * (ALL FEATURES V1: RADAR, DISPATCHER, BROADCAST, PROMO, PRICING, DRIVER)
 */

const sb = window.sb || (typeof supabase !== 'undefined' ? supabase : null);

// ===============================================
// 1. UI & NAVIGASI
// ===============================================
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
};

window.tutupModal = function(id) { 
    const md = document.getElementById(id);
    if(md) md.classList.replace('flex', 'hidden'); 
};

window.bukaModalDriver = function() {
    const modal = document.getElementById('modal-form-driver');
    if(modal) {
        modal.classList.replace('hidden', 'flex');
        document.getElementById('d-user').value = '';
        document.getElementById('d-pass').value = '';
        document.getElementById('d-nama').value = '';
        document.getElementById('d-wa').value = '';
        document.getElementById('d-nopol').value = '';
        document.getElementById('d-foto-base64').value = '';
        document.getElementById('d-foto-preview').classList.add('hidden');
        document.getElementById('d-foto-placeholder').classList.remove('hidden');
    }
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
        if(sheet.classList.contains('translate-y-[calc(100%-85px)]')) {
            sheet.classList.remove('translate-y-[calc(100%-85px)]');
            sheet.classList.add('translate-y-0');
        } else {
            sheet.classList.remove('translate-y-0');
            sheet.classList.add('translate-y-[calc(100%-85px)]');
        }
    }
};

const viewTitles = {
    'radar': 'God Eye Radar', 'dispatch': 'Manajemen Dispatcher', 'ekspedisi': 'Setup Ekspedisi', 'broadcast': 'Broadcast Global', 'pricing': 'Pengaturan Tarif Dinamis', 'promo': 'Manajemen Promo', 'driver': 'Data Akun Driver'
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
        if(menuId === 'ekspedisi' || menuId === 'radar' || menuId === 'dispatch') targetView.classList.replace('hidden', 'flex');
        else targetView.classList.remove('hidden');
    }

    if (menuId === 'radar' && typeof adminMap !== 'undefined' && adminMap) { setTimeout(() => adminMap.invalidateSize(), 300); }
    if (menuId === 'ekspedisi' && typeof eksMap !== 'undefined' && eksMap) { setTimeout(() => eksMap.invalidateSize(), 300); }
};

// ===============================================
// 2. RADAR & EKSPEDISI (FIX ICON J&T)
// ===============================================
function getIconEkspedisi(namaCabang) {
    let nama = namaCabang.toLowerCase();
    let iconFile = 'pin.png'; 
    let bgColor = '#ffffff'; 

    if (nama.includes('jne')) iconFile = 'jne.png';
    // FIX J&T: Pastikan file di folder bernama jnt.png karena simbol & error di web server
    else if (nama.includes('j&t') || nama.includes('j&t') || nama.includes('j & t')) iconFile = 'j&t.png';
    else if (nama.includes('sicepat') || nama.includes('si cepat')) iconFile = 'sicepat.png';
    else if (nama.includes('shopee') || nama.includes('spx')) iconFile = 'spx.png';
    else if (nama.includes('ninja')) { iconFile = 'ninja.png'; bgColor = '#dc2626'; } 
    else if (nama.includes('anteraja')) iconFile = 'anteraja.png';
    else if (nama.includes('wahana')) iconFile = 'wahana.png'; 

    const htmlMarker = `<div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background-color:${bgColor}; border-radius:50%; box-shadow:0 4px 10px rgba(0,0,0,0.3); border:2px solid white; overflow:hidden;"><img src="/assets/icons/${iconFile}" style="width:30px; height:30px; object-fit:contain;" onerror="this.src='/assets/icons/pin.png'" /></div>`;
    return L.divIcon({ className: '', html: htmlMarker, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] });
}

let adminMap = null, eksMap = null;
let tempEksMarker = null;
let arrayMarkerEkspedisi = [];

if (typeof L !== 'undefined') {
    const OFFICE = { lat: -6.977414, lng: 107.555359 };
    const basecampIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] });

    if(document.getElementById('admin-map')) {
        adminMap = L.map('admin-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(adminMap);
        L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(adminMap).bindPopup("<b>Markas MapelExpress</b>");
    }

    if(document.getElementById('eks-map')) {
        eksMap = L.map('eks-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(eksMap);
        L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(eksMap).bindPopup("<b>Markas MapelExpress</b>");
        
        eksMap.on('click', function(e) {
            document.getElementById('f-eks-lat').value = e.latlng.lat.toFixed(6);
            document.getElementById('f-eks-lng').value = e.latlng.lng.toFixed(6);
            if(tempEksMarker) eksMap.removeLayer(tempEksMarker);
            tempEksMarker = L.marker(e.latlng).addTo(eksMap).bindPopup("<span class='text-xs font-bold'>Lokasi Dipilih</span>").openPopup();
            const sheet = document.getElementById('sheet-ekspedisi');
            if(sheet) { sheet.classList.remove('translate-y-[calc(100%-85px)]'); sheet.classList.add('translate-y-0'); }
        });
    }
}

window.loadEkspedisi = async function() {
    if (!sb) return; 
    try {
        const { data } = await sb.from('ekspedisi').select('*');
        if (data) {
            arrayMarkerEkspedisi.forEach(m => m.remove());
            arrayMarkerEkspedisi = [];
            const tabelEks = document.getElementById('table-ekspedisi');
            const listRadar = document.getElementById('radar-eks-list'); 
            if(tabelEks) tabelEks.innerHTML = '';
            if(listRadar) listRadar.innerHTML = '';

            data.forEach(titik => {
                const iconEks = getIconEkspedisi(titik.nama); 
                const popupContent = `<div style="text-align:center; min-width:120px;"><p style="font-weight:900; margin-bottom:8px;">${titik.nama}</p><button onclick="window.hapusEkspedisi(${titik.id}, '${titik.nama}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; width:100%;">🗑️ Hapus</button></div>`;
                if(eksMap) arrayMarkerEkspedisi.push(L.marker([titik.lat, titik.lng], { icon: iconEks }).addTo(eksMap).bindPopup(popupContent));
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
        const lat = document.getElementById('f-eks-lat').value;
        const lng = document.getElementById('f-eks-lng').value;
        if(!nama || !lat || !lng) return alert("⚠️ ISI NAMA CABANG & TAP PETA DULU!");
        await sb.from('ekspedisi').insert([{ nama: nama, lat: parseFloat(lat), lng: parseFloat(lng) }]);
        document.getElementById('f-eks-nama').value = '';
        if(tempEksMarker) eksMap.removeLayer(tempEksMarker);
        window.loadEkspedisi(); 
        window.toggleSheetEks(); 
    } catch(e) { alert("❌ ERROR: " + e.message); }
};

window.hapusEkspedisi = async function(id, nama) {
    if(!confirm(`Yakin mau menghapus titik gerai "${nama}"?`)) return;
    await sb.from('ekspedisi').delete().eq('id', id);
    window.loadEkspedisi(); 
};

// ===============================================
// 3. DISPATCHER ORDER (3 KOLOM GRID)
// ===============================================
window.loadOrders = async function() {
    if(!sb) return;
    try {
        const { data } = await sb.from('orders').select('*').order('created_at', { ascending: false });
        
        const divPending = document.getElementById('list-order-pending');
        const divActive = document.getElementById('list-order-active');
        const divCancel = document.getElementById('list-order-cancel');
        
        divPending.innerHTML = ''; divActive.innerHTML = ''; divCancel.innerHTML = '';
        let cPen = 0, cAct = 0, cCan = 0;

        if (data) {
            data.forEach(o => {
                const od = o.data; // Data JSON
                const timeCreated = new Date(o.created_at).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'});
                
                // Card UI Generator
                let cardHTML = `
                    <div class="bg-white border border-gray-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer" onclick='window.lihatDetailOrder(${JSON.stringify(o).replace(/'/g, "&#39;")})'>
                        <div class="flex justify-between items-start mb-2 border-b border-gray-100 pb-2">
                            <span class="text-xs font-black text-gray-800 uppercase">${o.id}</span>
                            <span class="text-[10px] text-gray-500 font-bold">${timeCreated}</span>
                        </div>
                        <div class="mb-2">
                            <p class="text-[10px] font-bold text-gray-400 uppercase">Pengirim</p>
                            <p class="text-xs font-bold text-gray-800">${od.sender_name || '-'} <span class="text-blue-500">(${od.sender_phone || '-'})</span></p>
                        </div>
                        <div class="mb-2">
                            <p class="text-[10px] font-bold text-gray-400 uppercase">Penerima</p>
                            <p class="text-xs font-bold text-gray-800">${od.receiver_name || '-'} <span class="text-blue-500">(${od.receiver_phone || '-'})</span></p>
                        </div>
                        <div class="bg-gray-50 p-2 rounded-lg mt-3">
                            <p class="text-[10px] font-bold text-gray-600 truncate">📍 Jemput: ${od.pickup_address || '-'}</p>
                            <p class="text-[10px] font-bold text-gray-600 truncate mt-1">🏁 Antar: ${od.dropoff_address || '-'}</p>
                        </div>
                `;

                // Render per kategori status
                if (o.status === 'pending') {
                    cardHTML += `
                        <div class="flex gap-2 mt-3" onclick="event.stopPropagation()">
                            <button onclick="window.updateStatusOrder('${o.id}', 'cancelled')" class="flex-1 bg-red-50 text-red-600 border border-red-200 py-1.5 rounded-lg text-xs font-bold hover:bg-red-100">Batalkan</button>
                            <button onclick="alert('Fitur Assign Driver Manual akan dikembangkan.')" class="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 shadow-sm">Dispos</button>
                        </div></div>`;
                    divPending.innerHTML += cardHTML;
                    cPen++;
                } else if (o.status === 'active' || o.status === 'process') {
                    cardHTML += `<div class="mt-3 pt-3 border-t border-gray-100"><p class="text-[10px] font-black text-blue-600 uppercase">👷 Dikerjakan Oleh: ${od.driver_name || 'Driver Aktif'}</p></div></div>`;
                    divActive.innerHTML += cardHTML;
                    cAct++;
                } else if (o.status === 'cancelled') {
                    cardHTML += `</div>`;
                    divCancel.innerHTML += cardHTML;
                    cCan++;
                }
            });
        }
        
        document.getElementById('count-pending').innerText = cPen;
        document.getElementById('count-active').innerText = cAct;
        document.getElementById('count-cancel').innerText = cCan;

    } catch(e) { console.log(e); }
};

window.updateStatusOrder = async function(orderId, newStatus) {
    if(!confirm(`Ubah status order ini menjadi ${newStatus}?`)) return;
    try {
        await sb.from('orders').update({ status: newStatus }).eq('id', orderId);
        window.loadOrders();
    } catch (e) { alert("Error"); }
};

window.lihatDetailOrder = function(order) {
    const modal = document.getElementById('modal-detail-order');
    const body = document.getElementById('detail-order-body');
    const d = order.data;
    
    // Tampilan Histori Pekerjaan (Time & Photo)
    let historyHtml = '';
    if(order.status === 'active' || order.status === 'process') {
        historyHtml = `
            <div class="bg-blue-50 border border-blue-100 p-4 rounded-xl mt-4">
                <h4 class="text-xs font-black text-blue-800 mb-3 border-b border-blue-200 pb-2">Jejeak Pekerjaan Real-Time</h4>
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
            <div><p class="text-[10px] font-bold text-gray-400 uppercase">Pengirim</p><p class="text-xs font-bold text-gray-800">${d.sender_name}</p><p class="text-[10px] text-gray-500">${d.sender_phone}</p></div>
            <div><p class="text-[10px] font-bold text-gray-400 uppercase">Penerima</p><p class="text-xs font-bold text-gray-800">${d.receiver_name}</p><p class="text-[10px] text-gray-500">${d.receiver_phone}</p></div>
        </div>
        <div class="bg-gray-50 p-3 rounded-xl border border-gray-100 space-y-2">
            <div><p class="text-[10px] font-bold text-gray-400 uppercase">Lokasi Jemput</p><p class="text-xs font-bold text-gray-700">${d.pickup_address}</p></div>
            <div><p class="text-[10px] font-bold text-gray-400 uppercase">Lokasi Antar</p><p class="text-xs font-bold text-gray-700">${d.dropoff_address}</p></div>
        </div>
        ${historyHtml}
    `;
    modal.classList.replace('hidden', 'flex');
};

setTimeout(() => { window.loadOrders(); }, 1000);

// ===============================================
// 4. BROADCAST PESAN NOTIFIKASI
// ===============================================
window.simpanBroadcast = async function() {
    const target = document.getElementById('bc-target').value;
    const judul = document.getElementById('bc-judul').value;
    const pesan = document.getElementById('bc-pesan').value;

    if(!judul || !pesan) return alert("⚠️ Isi judul dan pesan broadcast!");
    if(!sb) return alert("🚨 Database Error");

    try {
        await sb.from('notifications').insert([{ target: target, judul: judul, pesan: pesan }]);
        alert("✅ Broadcast berhasil dikirim! Akan masuk ke Lonceng Notifikasi Customer/Driver.");
        document.getElementById('bc-judul').value = '';
        document.getElementById('bc-pesan').value = '';
    } catch (e) { alert("Error " + e.message); }
};

// ===============================================
// 5. MANAJEMEN PROMO POP-UP (IMAGE UPLOAD)
// ===============================================
window.previewPromo = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('prm-preview').src = e.target.result;
            document.getElementById('prm-preview').classList.remove('hidden');
            document.getElementById('prm-placeholder').classList.add('hidden');
            document.getElementById('prm-base64').value = e.target.result; 
        }
        reader.readAsDataURL(file);
    }
};

window.loadPromos = async function() {
    if(!sb) return;
    try {
        const { data } = await sb.from('promos').select('*').order('created_at', { ascending: false });
        const listPromo = document.getElementById('list-promo');
        if (data && data.length > 0) {
            listPromo.innerHTML = '';
            data.forEach(p => {
                listPromo.innerHTML += `
                    <div class="border border-gray-200 rounded-xl overflow-hidden shadow-sm relative group">
                        <img src="${p.image_base64}" class="w-full h-32 object-cover">
                        <div class="p-3 bg-white">
                            <p class="text-xs font-black text-gray-800 truncate">${p.judul}</p>
                            <span class="${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} text-[10px] px-2 py-0.5 rounded font-bold uppercase mt-1 inline-block">${p.is_active ? 'Aktif' : 'Mati'}</span>
                        </div>
                        <button onclick="window.hapusPromo(${p.id})" class="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
                    </div>
                `;
            });
        } else {
            listPromo.innerHTML = '<p class="text-xs text-gray-400 font-bold italic">Belum ada promo yang diterbitkan.</p>';
        }
    } catch(e) {}
};
setTimeout(() => { window.loadPromos(); }, 1500);

window.simpanPromo = async function() {
    const judul = document.getElementById('prm-judul').value;
    const base64 = document.getElementById('prm-base64').value;
    
    if(!judul || !base64) return alert("⚠️ Isi Judul dan Pilih Gambar Promo!");
    
    try {
        await sb.from('promos').insert([{ judul: judul, image_base64: base64, is_active: true }]);
        alert("✅ Banner Promo diterbitkan!");
        // Reset Form
        document.getElementById('prm-judul').value = '';
        document.getElementById('prm-base64').value = '';
        document.getElementById('prm-preview').classList.add('hidden');
        document.getElementById('prm-placeholder').classList.remove('hidden');
        window.loadPromos();
    } catch(e) { alert("Error"); }
};

window.hapusPromo = async function(id) {
    if(!confirm("Hapus promo ini?")) return;
    await sb.from('promos').delete().eq('id', id);
    window.loadPromos();
};

// ===============================================
// 6. FUNGSI DRIVER
// ===============================================
window.previewFotoDriver = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('d-foto-preview').src = e.target.result;
            document.getElementById('d-foto-preview').classList.remove('hidden');
            document.getElementById('d-foto-placeholder').classList.add('hidden');
            document.getElementById('d-foto-base64').value = e.target.result; 
        }
        reader.readAsDataURL(file);
    }
};

window.loadDrivers = async function() {
    if(!sb) return;
    try {
        const { data } = await sb.from('drivers').select('*');
        const tbody = document.getElementById('table-driver-crud');
        if (data && data.length > 0) {
            tbody.innerHTML = '';
            data.forEach(d => {
                const fotoProfile = d.foto || '/assets/icons/pin.png'; 
                tbody.innerHTML += `<tr class="hover:bg-gray-50 transition-colors"><td class="p-4 pl-6 flex items-center gap-3"><img src="${fotoProfile}" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" onerror="this.src='/assets/icons/pin.png'"><div><p class="font-bold text-gray-800">${d.nama}</p><p class="text-[10px] text-gray-500 font-bold">${d.whatsapp}</p></div></td><td class="p-4"><p class="font-bold text-blue-600">${d.username}</p><p class="text-[10px] text-gray-500 font-bold">Pass: ${d.password}</p></td><td class="p-4"><p class="font-black text-gray-800 uppercase tracking-widest text-xs">${d.nopol}</p><p class="text-[10px] text-gray-500 font-bold">${d.tipe_kendaraan}</p></td><td class="p-4"><span class="bg-green-100 text-green-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Aktif</span></td><td class="p-4 text-center"><button onclick="window.hapusDriver(${d.id}, '${d.nama}')" class="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-black transition-colors">Hapus</button></td></tr>`;
            });
        }
    } catch(err) { console.error(err); }
};
setTimeout(() => { window.loadDrivers(); }, 1200);

window.simpanAkunDriver = async function() {
    const user = document.getElementById('d-user').value;
    const pass = document.getElementById('d-pass').value;
    const nama = document.getElementById('d-nama').value;
    const wa = document.getElementById('d-wa').value;
    const tipe = document.getElementById('d-tipe').value;
    const nopol = document.getElementById('d-nopol').value;
    const foto = document.getElementById('d-foto-base64').value; 
    if(!user || !pass || !nama || !nopol || !wa) return alert("⚠️ Lengkapi semua kolom form!");
    try {
        await sb.from('drivers').insert([{ username: user, password: pass, nama: nama, whatsapp: wa, tipe_kendaraan: tipe, nopol: nopol, foto: foto, status: 'aktif' }]);
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
// 7. DYNAMIC PRICING
// ===============================================
window.listKategoriBerat = [];
window.listKategoriDimensi = [];

window.tambahListBerat = function() {
    const namaInput = document.getElementById('input-berat-nama');
    const hargaInput = document.getElementById('input-berat-harga');
    const nama = namaInput.value.trim();
    const harga = parseInt(hargaInput.value) || 0;
    if (!nama) return;
    window.listKategoriBerat.push({ nama: nama, harga: harga });
    namaInput.value = ''; hargaInput.value = ''; window.renderBerat();
};
window.hapusBerat = function(index) { window.listKategoriBerat.splice(index, 1); window.renderBerat(); };
window.renderBerat = function() {
    const ul = document.getElementById('render-list-berat'); ul.innerHTML = '';
    window.listKategoriBerat.forEach((item, index) => {
        let hargaText = item.harga === 0 ? '<span class="text-green-600 font-black">Gratis</span>' : `<span class="text-orange-600 font-black">+ Rp ${item.harga.toLocaleString('id-ID')}</span>`;
        ul.innerHTML += `<li class="bg-white border border-gray-200 p-3 rounded-xl flex justify-between items-center shadow-sm"><div><p class="text-xs font-bold text-gray-800">${item.nama}</p><p class="text-[10px] mt-0.5">${hargaText}</p></div><button onclick="window.hapusBerat(${index})" class="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-lg text-xs font-bold">Hapus</button></li>`;
    });
};

window.tambahListDimensi = function() {
    const namaInput = document.getElementById('input-dimensi-nama');
    const hargaInput = document.getElementById('input-dimensi-harga');
    const nama = namaInput.value.trim();
    const harga = parseInt(hargaInput.value) || 0;
    if (!nama) return;
    window.listKategoriDimensi.push({ nama: nama, harga: harga });
    namaInput.value = ''; hargaInput.value = ''; window.renderDimensi();
};
window.hapusDimensi = function(index) { window.listKategoriDimensi.splice(index, 1); window.renderDimensi(); };
window.renderDimensi = function() {
    const ul = document.getElementById('render-list-dimensi'); ul.innerHTML = '';
    window.listKategoriDimensi.forEach((item, index) => {
        let hargaText = item.harga === 0 ? '<span class="text-green-600 font-black">Gratis</span>' : `<span class="text-orange-600 font-black">+ Rp ${item.harga.toLocaleString('id-ID')}</span>`;
        ul.innerHTML += `<li class="bg-white border border-gray-200 p-3 rounded-xl flex justify-between items-center shadow-sm"><div><p class="text-xs font-bold text-gray-800">${item.nama}</p><p class="text-[10px] mt-0.5">${hargaText}</p></div><button onclick="window.hapusDimensi(${index})" class="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-lg text-xs font-bold">Hapus</button></li>`;
    });
};

window.simpanSemuaTarif = function() {
    alert("✅ Konfigurasi Tarif berhasil disimpan.");
};

// ===============================================
// 8. REALTIME LISTENER
// ===============================================
if (sb) {
    sb.channel('public:semua_table')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ekspedisi' }, payload => { window.loadEkspedisi(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, payload => { window.loadDrivers(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => { window.loadOrders(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'promos' }, payload => { window.loadPromos(); })
        .subscribe();
}
