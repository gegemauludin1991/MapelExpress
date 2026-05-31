/**
 * MAIN APP CONTROLLER - SISI KURIR / DRIVER (FULL SYNC)
 * - Map Layer Toggle (Street/Satellite)
 * - Profil Bisa Diedit & Disimpan ke Database
 * - GPS Marker Live
 */

const supabaseUrl = 'https://nahgibyegdeioquryfde.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5haGdpYnllZ2RlaW9xdXJ5ZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODM3NjksImV4cCI6MjA5NDE1OTc2OX0.NeN2uqRTKEJyc0SOEIV5iUQIIOGf88A46KRJffGUKmQ';
const sb = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;

const OFFICE = { lat: -6.977414, lng: 107.555359 };
const myMap = typeof DynamicMap !== 'undefined' ? new DynamicMap('map', OFFICE.lat, OFFICE.lng, 15) : null;

// ==========================================
// STATE GLOBAL
// ==========================================
let currentGpsLocation = OFFICE;
let driverMarker = null; 
let driverStats = JSON.parse(localStorage.getItem('mapel_driver_stats')) || { saldo: 0, totalOrder: 0 };
let isOnline = localStorage.getItem('mapel_driver_is_online') === 'true'; 
let activeOrder = null; 
let photoStep = null; 
window.driverSessionSource = 'local'; // Flag untuk cek db sumber (auth vs custom table)

// ==========================================
// MAP & GPS INIT & LAYER TOGGLE
// ==========================================
if (myMap && myMap.map) {
    myMap.map.touchZoom.enable();
    myMap.map.dragging.enable();
    if (myMap.map.tap) myMap.map.tap.disable();

    // Setup Map Layers (Satelit vs 3D/Street)
    const tileStreet = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' });
    const tileSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Tiles &copy; Esri' });
    let isSatMode = false;

    // Bersihkan bawaan DynamicMap lalu inject layer yang bisa ditoggle
    myMap.map.eachLayer((layer) => { if (layer instanceof L.TileLayer) myMap.map.removeLayer(layer); });
    tileStreet.addTo(myMap.map);

    const btnMapLayer = document.getElementById('btn-map-layer');
    if (btnMapLayer) {
        btnMapLayer.onclick = () => {
            if (isSatMode) {
                myMap.map.removeLayer(tileSat);
                tileStreet.addTo(myMap.map);
                btnMapLayer.classList.replace('text-blue-600', 'text-gray-600');
                btnMapLayer.classList.replace('bg-blue-50', 'bg-white');
            } else {
                myMap.map.removeLayer(tileStreet);
                tileSat.addTo(myMap.map);
                btnMapLayer.classList.replace('text-gray-600', 'text-blue-600');
                btnMapLayer.classList.replace('bg-white', 'bg-blue-50');
            }
            isSatMode = !isSatMode;
        };
    }

    // Icon Kantor Pusat
    const officeIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] });
    L.marker([OFFICE.lat, OFFICE.lng], { icon: officeIcon }).addTo(myMap.map)
        .bindPopup("<div class='font-bold text-center text-blue-800 text-xs'>Pusat Operasional<br>MapelExpress</div>");

    // Lacak GPS Realtime Driver
    myMap.map.locate({ setView: false, watch: true, enableHighAccuracy: true });
    myMap.map.on('locationfound', (e) => { 
        currentGpsLocation = e.latlng; 
        
        if (!driverMarker) {
            const kurirIcon = L.icon({ iconUrl: '/assets/icons/kurir.png', iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] });
            driverMarker = L.marker([e.latlng.lat, e.latlng.lng], { icon: kurirIcon, zIndexOffset: 9999 })
                .addTo(myMap.map)
                .bindPopup("<div class='text-[10px] font-bold uppercase'>Posisi Saya</div>");
            myMap.map.setView(e.latlng, 16);
        } else {
            driverMarker.setLatLng(e.latlng);
        }

        if(isOnline && activeOrder) broadcastLocation(e.latlng); 
    });

    const btnMyLocation = document.getElementById('btn-my-location');
    if (btnMyLocation) {
        btnMyLocation.onclick = () => {
            if (currentGpsLocation && myMap) myMap.map.setView(currentGpsLocation, 17, { animate: true });
            else myMap.map.locate({ setView: true, maxZoom: 17, enableHighAccuracy: true });
        };
    }
}

// Load Pin Ekspedisi
async function loadEkspedisiPin() {
    if(!sb || !myMap) return;
    const { data: eksData } = await sb.from('ekspedisi').select('*');
    if (eksData && eksData.length > 0) {
        eksData.forEach(eks => {
            const n = eks.nama.toLowerCase();
            const ts = new Date().getTime();
            let logoUrl = null;
            if (n.includes('j&t') || n.includes('jnt')) logoUrl = `/assets/icons/j%26t.png?v=${ts}`;
            else if (n.includes('jne')) logoUrl = `/assets/icons/jne.png?v=${ts}`;
            else if (n.includes('ninja')) logoUrl = `/assets/icons/ninja.png?v=${ts}`;
            else if (n.includes('spx') || n.includes('shopee')) logoUrl = `/assets/icons/spx.png?v=${ts}`;
            else if (n.includes('wahana')) logoUrl = `/assets/icons/wahana.png?v=${ts}`;
            else if (n.includes('sicepat') || n.includes('si cepat')) logoUrl = `/assets/icons/sicepat.png?v=${ts}`;

            myMap.addMarker(
                eks.lat, eks.lng, 'ekspedisi',
                `<div class="text-center font-sans"><p class="font-bold text-[13px] text-gray-800">${eks.nama}</p></div>`,
                logoUrl
            );
        });
    }
}

// ==========================================
// INISIALISASI SESI & PROFIL
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    if (!sb) return alert("Koneksi Database Gagal!");

    let validSession = null;

    // 1. Cek dari Supabase Auth
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
        if (profile && (profile.role === 'driver' || profile.role === 'kurir')) {
            window.driverSessionSource = 'auth';
            validSession = {
                id: profile.id,
                nama: profile.full_name || profile.nama || 'Driver Mapel',
                whatsapp: profile.whatsapp || '-',
                nopol: profile.nopol || '',
                tipe_kendaraan: profile.tipe_kendaraan || 'Motor',
                warna: profile.warna || '',
                foto: profile.foto || '/assets/icons/kurir.png'
            };
        }
    }

    // 2. Cek LocalStorage
    if (!validSession) {
        const localData = localStorage.getItem('mapel_driver_session');
        if (localData) {
            window.driverSessionSource = 'local';
            validSession = JSON.parse(localData);
        }
    }

    if (!validSession) {
        alert("Sesi habis. Silakan login kembali.");
        window.location.replace('index.html');
        return;
    }

    window.driverSession = validSession;

    // Render Profil UI
    document.getElementById('dash-name').innerText = validSession.nama;
    document.getElementById('dash-id').innerText = `ID: DRV-${String(validSession.id).substring(0,6).toUpperCase()}`;
    if(document.getElementById('dash-photo')) document.getElementById('dash-photo').src = validSession.foto || '/assets/icons/kurir.png';
    if(document.getElementById('set-photo-preview')) document.getElementById('set-photo-preview').src = validSession.foto || '/assets/icons/kurir.png';
    document.getElementById('set-nama').value = validSession.nama;
    document.getElementById('set-wa').value = validSession.whatsapp;
    document.getElementById('set-nopol').value = validSession.nopol || '';
    if(validSession.warna) document.getElementById('set-warna').value = validSession.warna;
    document.getElementById('set-jenis').value = validSession.tipe_kendaraan || 'Motor';

    updateSaldoUI();
    loadEkspedisiPin();
    listenToIncomingOrders();

    // Toggle Online/Offline Tetap Nempel
    const toggle = document.getElementById('toggle-status');
    const statusText = document.getElementById('status-text');
    if(toggle) {
        toggle.checked = isOnline;
        statusText.innerText = isOnline ? "ONLINE" : "OFFLINE";
        statusText.className = isOnline ? "text-[11px] font-black text-green-500 uppercase" : "text-[11px] font-bold text-gray-400 uppercase";

        toggle.addEventListener('change', (e) => {
            isOnline = e.target.checked;
            localStorage.setItem('mapel_driver_is_online', isOnline); 
            statusText.innerText = isOnline ? "ONLINE" : "OFFLINE";
            statusText.className = isOnline ? "text-[11px] font-black text-green-500 uppercase" : "text-[11px] font-bold text-gray-400 uppercase";
        });
    }

    // FUNGSI UPLOAD FOTO PROFIL (Base64)
    const uploadPhoto = document.getElementById('upload-photo');
    if(uploadPhoto) {
        uploadPhoto.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    const base64Str = event.target.result;
                    document.getElementById('set-photo-preview').src = base64Str;
                    document.getElementById('dash-photo').src = base64Str;
                    window.driverSession.foto = base64Str; 
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // FUNGSI SIMPAN PERUBAHAN PROFIL
    const btnSaveProfile = document.getElementById('btn-save-profile');
    if (btnSaveProfile) {
        btnSaveProfile.onclick = async () => {
            btnSaveProfile.innerText = "Menyimpan...";
            btnSaveProfile.disabled = true;

            const updateData = {
                nama: document.getElementById('set-nama').value,
                whatsapp: document.getElementById('set-wa').value,
                nopol: document.getElementById('set-nopol').value,
                warna: document.getElementById('set-warna').value,
                tipe_kendaraan: document.getElementById('set-jenis').value,
                foto: window.driverSession.foto 
            };

            try {
                // Update ke DB tergantung dari mana driver login
                if (window.driverSessionSource === 'auth') {
                    const authPayload = { 
                        full_name: updateData.nama, 
                        whatsapp: updateData.whatsapp, 
                        nopol: updateData.nopol,
                        warna: updateData.warna, 
                        tipe_kendaraan: updateData.tipe_kendaraan, 
                        foto: updateData.foto 
                    };
                    await sb.from('profiles').update(authPayload).eq('id', window.driverSession.id);
                } else {
                    await sb.from('drivers').update(updateData).eq('id', window.driverSession.id);
                }

                // Update Local Data
                window.driverSession = { ...window.driverSession, ...updateData };
                localStorage.setItem('mapel_driver_session', JSON.stringify(window.driverSession));
                document.getElementById('dash-name').innerText = window.driverSession.nama;

                alert("Profil berhasil diperbarui!");
            } catch (error) {
                alert("Gagal menyimpan profil: " + error.message);
            } finally {
                btnSaveProfile.innerText = "SIMPAN PERUBAHAN";
                btnSaveProfile.disabled = false;
            }
        };
    }
});

function updateSaldoUI() {
    const elSaldo = document.querySelector('.text-3xl.font-black.text-gray-900');
    if(elSaldo) elSaldo.innerText = `Rp ${driverStats.saldo.toLocaleString('id-ID')}`;
    const elTotal = document.querySelectorAll('.text-2xl.font-black.text-gray-800')[0];
    if(elTotal) elTotal.innerText = driverStats.totalOrder;
}

// ==========================================
// NAVIGATION TABS
// ==========================================
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
    if (target === 'map' && myMap && myMap.map) setTimeout(() => myMap.map.invalidateSize(), 300);
};

// ==========================================
// REALTIME ORDER & KAMERA LOGIC
// ==========================================
function listenToIncomingOrders() {
    sb.channel('public:orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
            const order = payload.new;
            if (isOnline && !activeOrder && order.status === 'pending') {
                munculkanPopupOrder(order);
            }
        }).subscribe();
}

function munculkanPopupOrder(order) {
    const d = order.data;
    document.getElementById('order-jemput').innerText = d.alamatJemput || '-';
    document.getElementById('order-tujuan').innerText = d.alamatTujuan || '-';
    document.getElementById('order-barang').innerText = `${d.keterangan || 'Paket Reguler'} (${d.berat || '-'})`;
    document.querySelector('.text-[16px].font-black.text-blue-700').innerText = `Rp ${d.totalOngkir.toLocaleString('id-ID')}`;

    const popup = document.getElementById('popup-order');
    const card = document.getElementById('order-card');
    
    popup.classList.remove('hidden');
    setTimeout(() => { popup.classList.remove('opacity-0'); card.classList.remove('scale-95'); }, 50);

    document.getElementById('btn-tolak').onclick = () => {
        popup.classList.add('opacity-0'); card.classList.add('scale-95');
        setTimeout(() => popup.classList.add('hidden'), 300);
    };

    document.getElementById('btn-terima').onclick = async () => {
        document.getElementById('btn-terima').innerText = 'Memproses...';
        
        const driverInfo = {
            name: window.driverSession.nama,
            wa: window.driverSession.whatsapp,
            nopol: window.driverSession.nopol,
            photo: window.driverSession.foto
        };

        const updatedData = { ...d, driver: driverInfo };

        const { error } = await sb.from('orders').update({ status: 'accepted', data: updatedData }).eq('id', order.id);

        if (error) {
            alert("Order sudah diambil driver lain / Error sistem.");
            document.getElementById('btn-terima').innerText = 'TERIMA ORDER';
        } else {
            activeOrder = { id: order.id, ...updatedData };
            popup.classList.add('opacity-0'); card.classList.add('scale-95');
            setTimeout(() => popup.classList.add('hidden'), 300);
            document.getElementById('btn-terima').innerText = 'TERIMA ORDER';
            
            mulaiTugasDriver();
        }
    };
}

function mulaiTugasDriver() {
    window.switchTab('map');
    
    const sheet = document.getElementById('sheet-tugas');
    document.getElementById('tugas-title').innerText = "MENJEMPUT PAKET";
    document.getElementById('tugas-badge').innerText = "MENUJU LOKASI";
    document.getElementById('tugas-label-lokasi').innerText = "Alamat Jemput:";
    document.getElementById('tugas-alamat').innerText = activeOrder.alamatJemput;
    
    const btnAction = document.getElementById('btn-action-tugas');
    btnAction.innerText = "PAKET SUDAH DIAMBIL";
    btnAction.className = "w-full bg-blue-600 text-white font-bold py-4 px-6 rounded-2xl shadow-lg active:bg-blue-700 transition-all active:scale-[0.98] mt-2";
    
    if(myMap && currentGpsLocation && activeOrder) {
        myMap.drawRoute([{ lat: currentGpsLocation.lat, lng: currentGpsLocation.lng }, { lat: activeOrder.jemputLat, lng: activeOrder.jemputLng }], () => {});
    }

    sheet.style.transform = 'translateY(0)';
    btnAction.onclick = () => { window.bukaKamera('pickup'); };
}

window.bukaKamera = function(step) {
    photoStep = step;
    document.getElementById('kamera-title').innerText = step === 'pickup' ? 'Bukti Ambil Paket' : 'Bukti Selesai Antar';
    document.getElementById('photo-preview').classList.add('hidden');
    document.getElementById('camera-placeholder').classList.remove('hidden');
    document.getElementById('btn-submit-foto').disabled = true;
    document.getElementById('btn-submit-foto').classList.replace('opacity-100', 'opacity-50');
    document.getElementById('btn-submit-foto').classList.remove('cursor-pointer');
    
    document.getElementById('modal-kamera').classList.remove('hidden');
    document.getElementById('modal-kamera').style.display = 'flex';
}

window.tutupKamera = function() {
    document.getElementById('modal-kamera').classList.add('hidden');
    document.getElementById('modal-kamera').style.display = 'none';
}

document.getElementById('input-kamera').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            const base64Str = event.target.result;
            const img = document.getElementById('photo-preview');
            img.src = base64Str;
            img.classList.remove('hidden');
            document.getElementById('camera-placeholder').classList.add('hidden');
            
            const btnSubmit = document.getElementById('btn-submit-foto');
            btnSubmit.disabled = false;
            btnSubmit.classList.replace('opacity-50', 'opacity-100');
            btnSubmit.classList.add('cursor-pointer');
            btnSubmit.dataset.base64 = base64Str;
        }
        reader.readAsDataURL(file);
    }
});

document.getElementById('btn-submit-foto').onclick = async function() {
    const base64Foto = this.dataset.base64;
    const btn = this;
    btn.innerText = "Mengirim..."; btn.disabled = true;

    if(photoStep === 'pickup') {
        activeOrder.pickup_photo = base64Foto;
        await sb.from('orders').update({ status: 'picked_up', data: activeOrder }).eq('id', activeOrder.id);
        
        window.tutupKamera();
        btn.innerText = "Kirim & Lanjut";
        
        document.getElementById('tugas-title').innerText = "MENGANTAR PAKET";
        document.getElementById('tugas-badge').innerText = "MENUJU TUJUAN";
        document.getElementById('tugas-badge').classList.replace('bg-blue-600', 'bg-orange-500');
        document.getElementById('tugas-label-lokasi').innerText = "Alamat Drop-off:";
        document.getElementById('tugas-alamat').innerText = activeOrder.alamatTujuan;
        
        const btnAction = document.getElementById('btn-action-tugas');
        btnAction.innerText = "SELESAIKAN ORDER";
        btnAction.className = "w-full bg-green-500 text-white font-bold py-4 px-6 rounded-2xl shadow-lg active:bg-green-600 transition-all active:scale-[0.98] mt-2";
        
        if(myMap && currentGpsLocation && activeOrder) {
            myMap.drawRoute([{ lat: currentGpsLocation.lat, lng: currentGpsLocation.lng }, { lat: activeOrder.tujuanLat, lng: activeOrder.tujuanLng }], () => {});
        }
        
        btnAction.onclick = () => { window.bukaKamera('dropoff'); };

    } else if (photoStep === 'dropoff') {
        activeOrder.dropoff_photo = base64Foto;
        await sb.from('orders').update({ status: 'completed', data: activeOrder }).eq('id', activeOrder.id);
        
        driverStats.saldo += activeOrder.totalOngkir;
        driverStats.totalOrder += 1;
        localStorage.setItem('mapel_driver_stats', JSON.stringify(driverStats));
        updateSaldoUI();

        window.tutupKamera();
        btn.innerText = "Kirim & Lanjut";
        
        document.getElementById('sheet-tugas').style.transform = 'translateY(120%)';
        if(myMap.routingControl) myMap.map.removeControl(myMap.routingControl);
        
        alert("🎉 Hore! Orderan selesai, saldo kamu bertambah.");
        activeOrder = null;
        window.switchTab('dashboard');
    }
};

function broadcastLocation(latlng) {
    if(!sb) return;
    sb.channel('public:orders').send({
        type: 'broadcast',
        event: 'update_driver_map',
        payload: { lat: latlng.lat, lng: latlng.lng }
    });
}
