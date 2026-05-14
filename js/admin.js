/**
 * ADMIN CONTROLLER - FULL SUPABASE INTEGRATION
 */
const SUPABASE_URL = 'https://nahgibyegdeioquryfde.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5haGdpYnllZ2RlaW9xdXJ5ZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODM3NjksImV4cCI6MjA5NDE1OTc2OX0.NeN2uqRTKEJyc0SOEIV5iUQIIOGf88A46KRJffGUKmQ';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Data Master Server
let masterOrders = [];
let masterDrivers = [];
let adminEkspedisiList = [];
let tarifConfig = { base: 5000, perkm: 2000, maxkg: 5, extrakg: 1000, dimensi: 5000, disc: 0 };
let promoList = [];
let activeDriversOnline = {}; 

// Sinkronisasi data JSON ke Supabase biar aman
async function saveAppSetting(key, dataObj) {
    await supabase.from('app_settings').upsert({ id: key, value: dataObj });
}

// Inisialisasi Tarik Data Awal dari Supabase
async function initAdminServer() {
    // 1. Tarik Data Setting (Ekspedisi, Akun Driver, Tarif)
    const { data: settings } = await supabase.from('app_settings').select('*');
    if (settings) {
        settings.forEach(s => {
            if(s.id === 'mapel_ekspedisi') adminEkspedisiList = s.value || [];
            if(s.id === 'mapel_admin_master_drivers') masterDrivers = s.value || [];
            if(s.id === 'mapel_tarif_config') tarifConfig = s.value || tarifConfig;
            if(s.id === 'mapel_promo_list') promoList = s.value || [];
        });
        renderTableEkspedisi(); renderTableDriverAdmin(); loadTarif(); renderPromo();
    }

    // 2. Tarik Data Transaksi (Orderan)
    const { data: ords } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
    if (ords) { masterOrders = ords.map(o => o.data); renderSemuaOrders(); updateRadarStats(); }

    // 3. Tarik Posisi GPS Driver Terakhir
    const { data: drvs } = await supabase.from('driver_locations').select('*');
    if (drvs) { drvs.forEach(d => updateMarkerDriver(d.data)); }

    // 🔥 4. AKTIFKAN RADAR REALTIME (PENGGANTI SOCKET.IO) 🔥
    supabase.channel('admin_live_feed')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            const oData = payload.new.data;
            const idx = masterOrders.findIndex(o => o.id === oData.id);
            if (idx === -1) masterOrders.unshift(oData); else masterOrders[idx] = oData;
            renderSemuaOrders(); updateRadarStats();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, payload => {
            updateMarkerDriver(payload.new.data);
        })
        .subscribe();
}

// ==========================================
// UI & MAP LOGIC
// ==========================================
const OFFICE = { lat: -6.977414, lng: 107.555359 };
const basecampIcon = L.icon({ iconUrl: './assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45] });

const adminMap = L.map('admin-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(adminMap);
L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(adminMap);

const eksMap = L.map('eks-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(eksMap);
L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(eksMap);

let tempEksPin = null;
eksMap.on('click', function(e) {
    if (tempEksPin) eksMap.removeLayer(tempEksPin);
    tempEksPin = L.marker(e.latlng, { icon: L.divIcon({ className: 'bg-transparent border-0', html: `<div class="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center border-4 border-orange-500 animate-bounce">📍</div>`, iconSize: [32, 32] }) }).addTo(eksMap);
    document.getElementById('f-eks-lat').value = e.latlng.lat.toFixed(6);
    document.getElementById('f-eks-lng').value = e.latlng.lng.toFixed(6);
    document.getElementById('sheet-ekspedisi').style.transform = 'translateY(0)';
});

// Update Marker Driver Supabase
function updateMarkerDriver(drvData) {
    if(!drvData || !drvData.lat) return;
    if (!activeDriversOnline[drvData.id]) {
        const m = L.marker([drvData.lat, drvData.lng], { icon: L.icon({ iconUrl: '/assets/icons/kurir.png', iconSize: [40, 40] }) }).addTo(adminMap).bindPopup(`<b>${drvData.id}</b>`);
        activeDriversOnline[drvData.id] = { marker: m, data: drvData };
        renderDriverList();
    } else {
        activeDriversOnline[drvData.id].marker.setLatLng([drvData.lat, drvData.lng]);
        activeDriversOnline[drvData.id].data = drvData;
    }
    document.getElementById('rad-driver').innerText = Object.keys(activeDriversOnline).length;
}

// Re-Assign Driver (Supabase Update)
window.eksekusiReassign = async () => {
    const newDrvId = document.getElementById('select-reassign').value;
    if(!newDrvId) return alert("Pilih kurirnya bos!");
    
    const drv = masterDrivers.find(d => d.id === newDrvId);
    const idx = masterOrders.findIndex(o => o.id === activeDetailOrderId);
    if(idx !== -1 && drv) {
        masterOrders[idx].driverId = drv.id; masterOrders[idx].driverName = drv.name; masterOrders[idx].status = 'pending'; 
        
        // PUSH KE SUPABASE
        await supabase.from('orders').upsert({ id: masterOrders[idx].id, status: 'pending', data: masterOrders[idx] });
        
        alert(`Order dipindah ke ${drv.name}!`);
        tutupModal('modal-detail-pesanan');
    }
};

window.batalPesananDariAdmin = async () => {
    if(confirm('Yakin cancel order ini secara paksa?')) {
        const idx = masterOrders.findIndex(o => o.id === activeDetailOrderId);
        if(idx !== -1) {
            masterOrders[idx].status = 'cancel';
            await supabase.from('orders').upsert({ id: masterOrders[idx].id, status: 'cancel', data: masterOrders[idx] });
            tutupModal('modal-detail-pesanan');
        }
    }
}

// Simpan Akun Driver
window.simpanAkunDriver = () => {
    const idDriver = document.getElementById('d-id').value.trim().toUpperCase();
    const data = {
        id: idDriver, username: document.getElementById('d-user').value.trim(), password: document.getElementById('d-pass').value.trim(),
        name: document.getElementById('d-nama').value.trim(), wa: document.getElementById('d-wa').value, nopol: document.getElementById('d-nopol').value.toUpperCase(),
        warna: document.getElementById('d-warna').value, kendaraan: document.getElementById('d-tipe').value, status: 'active'
    };

    if(!data.id || !data.username || !data.password || !data.name || !data.nopol) return alert("Lengkapi ID, kredensial, nama, dan Nopol kendaraan!");

    const editIdx = parseInt(document.getElementById('d-edit-index').value);
    if(editIdx === -1) masterDrivers.push(data); else { data.status = masterDrivers[editIdx].status; masterDrivers[editIdx] = data; }

    saveAppSetting('mapel_admin_master_drivers', masterDrivers);
    renderTableDriverAdmin(); tutupModal('modal-form-driver');
};

// Start Sistem
initAdminServer();

// (Sisa Fungsi UI UI Navbar biarkan persis seperti script lu kemaren, jangan dirubah)
