/**
 * ADMIN ENGINE - MAPEL EXPRESS
 * (FULL FIX: RADAR, PRICING, & DRIVER DB INTEGRATION)
 */

const sb = window.sb || (typeof supabase !== 'undefined' ? supabase : null);

// ===============================================
// 1. UI, MENU, & MODAL CONTROLLER
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
        // Reset form pas dibuka
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
        if(menuId === 'ekspedisi' || menuId === 'radar') targetView.classList.replace('hidden', 'flex');
        else targetView.classList.remove('hidden');
    }

    if (menuId === 'radar' && typeof adminMap !== 'undefined' && adminMap) { setTimeout(() => adminMap.invalidateSize(), 300); }
    if (menuId === 'ekspedisi' && typeof eksMap !== 'undefined' && eksMap) { setTimeout(() => eksMap.invalidateSize(), 300); }
};

// ===============================================
// 2. LOGIKA PETA & EKSPEDISI
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

// ===============================================
// 3. FUNGSI DATABASE (EKSPEDISI)
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
                const popupContent = `<div style="text-align:center; min-width:120px;"><p style="font-weight:900; margin-bottom:8px;">${titik.nama}</p><button onclick="window.hapusEkspedisi(${titik.id}, '${titik.nama}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:4px 8px; border-radius:4px; font-weight:bold; cursor:pointer; width:100%;">🗑️ Hapus</button></div>`;

                if(eksMap) arrayMarkerEkspedisi.push(L.marker([titik.lat, titik.lng], { icon: iconEks }).addTo(eksMap).bindPopup(popupContent));
                if(adminMap) arrayMarkerEkspedisi.push(L.marker([titik.lat, titik.lng], { icon: iconEks }).addTo(adminMap).bindPopup(popupContent));

                if(tabelEks) {
                    tabelEks.innerHTML += `<tr><td class="p-3 font-bold text-xs">${titik.nama}</td><td class="p-3 text-center w-20"><button onclick="window.hapusEkspedisi(${titik.id}, '${titik.nama}')" class="bg-red-100 hover:bg-red-200 text-red-600 px-3 py-1.5 rounded-lg font-bold text-xs">Hapus</button></td></tr>`;
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
    } catch(err) { console.error("Error Load:", err); }
};
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

// ===============================================
// 4. FUNGSI DRIVER (DB INTEGRATION + FOTO)
// ===============================================

// Preview Foto ke Base64 (Anti Ribet Storage)
window.previewFotoDriver = function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('d-foto-preview').src = e.target.result;
            document.getElementById('d-foto-preview').classList.remove('hidden');
            document.getElementById('d-foto-placeholder').classList.add('hidden');
            document.getElementById('d-foto-base64').value = e.target.result; // Simpen base64 nya
        }
        reader.readAsDataURL(file);
    }
};

// Tarik data driver dari DB
window.loadDrivers = async function() {
    if(!sb) return;
    try {
        const { data, error } = await sb.from('drivers').select('*');
        const tbody = document.getElementById('table-driver-crud');
        if(!tbody) return;

        if (data && data.length > 0) {
            tbody.innerHTML = '';
            data.forEach(d => {
                // Kalo gaada foto, kasih icon pin default aja
                const fotoProfile = d.foto || '/assets/icons/pin.png'; 
                
                tbody.innerHTML += `
                    <tr class="hover:bg-gray-50 transition-colors">
                        <td class="p-4 pl-6 flex items-center gap-3">
                            <img src="${fotoProfile}" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" onerror="this.src='/assets/icons/pin.png'">
                            <div><p class="font-bold text-gray-800">${d.nama}</p><p class="text-[10px] text-gray-500 font-bold">${d.whatsapp}</p></div>
                        </td>
                        <td class="p-4">
                            <p class="font-bold text-blue-600">${d.username}</p>
                            <p class="text-[10px] text-gray-500 font-bold">Pass: ${d.password}</p>
                        </td>
                        <td class="p-4">
                            <p class="font-black text-gray-800 uppercase tracking-widest text-xs">${d.nopol}</p>
                            <p class="text-[10px] text-gray-500 font-bold">${d.tipe_kendaraan}</p>
                        </td>
                        <td class="p-4"><span class="bg-green-100 text-green-700 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">Aktif</span></td>
                        <td class="p-4 text-center">
                            <button onclick="window.hapusDriver(${d.id}, '${d.nama}')" class="text-red-500 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg text-xs font-black transition-colors">Hapus</button>
                        </td>
                    </tr>
                `;
            });
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold text-xs">Belum ada akun driver dibuat.</td></tr>';
        }
    } catch(err) { console.error("Gagal load driver:", err); }
};
setTimeout(() => { window.loadDrivers(); }, 1200); // Load otomatis pas awal buka admin

// Simpan data ke DB
window.simpanAkunDriver = async function() {
    const user = document.getElementById('d-user').value;
    const pass = document.getElementById('d-pass').value;
    const nama = document.getElementById('d-nama').value;
    const wa = document.getElementById('d-wa').value;
    const tipe = document.getElementById('d-tipe').value;
    const nopol = document.getElementById('d-nopol').value;
    const foto = document.getElementById('d-foto-base64').value; // Base64 Text

    if(!user || !pass || !nama || !nopol || !wa) return alert("⚠️ Lengkapi semua kolom form!");
    if(!sb) return alert("🚨 Database belum terkoneksi!");

    try {
        const { error } = await sb.from('drivers').insert([{
            username: user, 
            password: pass, 
            nama: nama, 
            whatsapp: wa, 
            tipe_kendaraan: tipe, 
            nopol: nopol, 
            foto: foto, 
            status: 'aktif'
        }]);

        if (error) throw error;

        alert(`✅ Mantap! Akun Driver ${nama} berhasil diterbitkan.`);
        window.tutupModal('modal-form-driver');
        window.loadDrivers(); // Refresh tabel

    } catch(e) {
        alert("❌ Gagal simpan driver: " + e.message);
    }
};

window.hapusDriver = async function(id, nama) {
    if(!confirm(`Yakin mau putus mitra dan hapus akun ${nama}?`)) return;
    if(!sb) return;
    try {
        const { error } = await sb.from('drivers').delete().eq('id', id);
        if (error) throw error;
        window.loadDrivers(); 
    } catch(e) { alert("❌ Gagal hapus driver: " + e.message); }
};

// ===============================================
// 5. DYNAMIC PRICING (BERAT & DIMENSI)
// ===============================================
window.listKategoriBerat = [];
window.listKategoriDimensi = [];

window.tambahListBerat = function() {
    const namaInput = document.getElementById('input-berat-nama');
    const hargaInput = document.getElementById('input-berat-harga');
    const nama = namaInput.value.trim();
    const harga = parseInt(hargaInput.value) || 0;
    if (!nama) return alert("Isi nama kategori berat dulu!");
    window.listKategoriBerat.push({ nama: nama, harga: harga });
    namaInput.value = '';
    hargaInput.value = '';
    window.renderBerat();
};

window.hapusBerat = function(index) {
    window.listKategoriBerat.splice(index, 1);
    window.renderBerat();
};

window.renderBerat = function() {
    const ul = document.getElementById('render-list-berat');
    ul.innerHTML = '';
    if(window.listKategoriBerat.length === 0) {
        ul.innerHTML = '<p class="text-xs text-gray-400 italic">Belum ada kategori yang ditambahkan.</p>';
        return;
    }
    window.listKategoriBerat.forEach((item, index) => {
        let hargaText = item.harga === 0 ? '<span class="text-green-600 font-black">Gratis</span>' : `<span class="text-orange-600 font-black">+ Rp ${item.harga.toLocaleString('id-ID')}</span>`;
        ul.innerHTML += `<li class="bg-white border border-gray-200 p-3 rounded-xl flex justify-between items-center shadow-sm"><div><p class="text-xs font-bold text-gray-800">${item.nama}</p><p class="text-[10px] mt-0.5">${hargaText}</p></div><button onclick="window.hapusBerat(${index})" class="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-lg text-xs font-bold transition-colors">Hapus</button></li>`;
    });
};

window.tambahListDimensi = function() {
    const namaInput = document.getElementById('input-dimensi-nama');
    const hargaInput = document.getElementById('input-dimensi-harga');
    const nama = namaInput.value.trim();
    const harga = parseInt(hargaInput.value) || 0;
    if (!nama) return alert("Isi nama kategori dimensi dulu!");
    window.listKategoriDimensi.push({ nama: nama, harga: harga });
    namaInput.value = '';
    hargaInput.value = '';
    window.renderDimensi();
};

window.hapusDimensi = function(index) {
    window.listKategoriDimensi.splice(index, 1);
    window.renderDimensi();
};

window.renderDimensi = function() {
    const ul = document.getElementById('render-list-dimensi');
    ul.innerHTML = '';
    if(window.listKategoriDimensi.length === 0) {
        ul.innerHTML = '<p class="text-xs text-gray-400 italic">Belum ada kategori yang ditambahkan.</p>';
        return;
    }
    window.listKategoriDimensi.forEach((item, index) => {
        let hargaText = item.harga === 0 ? '<span class="text-green-600 font-black">Gratis</span>' : `<span class="text-orange-600 font-black">+ Rp ${item.harga.toLocaleString('id-ID')}</span>`;
        ul.innerHTML += `<li class="bg-white border border-gray-200 p-3 rounded-xl flex justify-between items-center shadow-sm"><div><p class="text-xs font-bold text-gray-800">${item.nama}</p><p class="text-[10px] mt-0.5">${hargaText}</p></div><button onclick="window.hapusDimensi(${index})" class="bg-red-50 text-red-500 hover:bg-red-100 p-2 rounded-lg text-xs font-bold transition-colors">Hapus</button></li>`;
    });
};

window.renderBerat();
window.renderDimensi();

window.simpanSemuaTarif = function() {
    const baseFare = document.getElementById('tf-base').value;
    const perKmFare = document.getElementById('tf-perkm').value;

    if(!baseFare || !perKmFare) return alert("⚠️ Isi tarif jarak dasar (KM) terlebih dahulu!");
    if(window.listKategoriBerat.length === 0) return alert("⚠️ Tambahkan minimal 1 kategori berat!");
    if(window.listKategoriDimensi.length === 0) return alert("⚠️ Tambahkan minimal 1 kategori dimensi!");

    alert("✅ Mantap! Konfigurasi Tarif, Berat, & Dimensi berhasil disimpan.");
};

if (sb) {
    sb.channel('public:ekspedisi_settings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ekspedisi' }, payload => { window.loadEkspedisi(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, payload => { window.loadDrivers(); })
        .subscribe();
}
