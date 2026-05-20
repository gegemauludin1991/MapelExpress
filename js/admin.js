/**
 * ADMIN CONTROLLER - MAPEL EXPRESS
 * Fitur Tambahan: Geofencing Radius & Multi-Client Auth Driver Setup
 */

const socket = window.socketBridge || { on: function(){}, emit: function(){} };

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
    'radius': 'Atur Radius Geofencing', // TITLE BARU
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
        if(menuId === 'ekspedisi' || menuId === 'radius') targetView.classList.replace('hidden', 'flex');
        else targetView.classList.remove('hidden');
    }

    if (menuId === 'radar' && typeof adminMap !== 'undefined') { setTimeout(() => adminMap.invalidateSize(), 300); }
    if (menuId === 'ekspedisi' && typeof eksMap !== 'undefined') { setTimeout(() => eksMap.invalidateSize(), 300); }
    // TRIGGER MAP RADIUS SUPAYA TIDAK NGE-GLITCH ABU-ABU
    if (menuId === 'radius' && typeof radiusMap !== 'undefined') { 
        setTimeout(() => { 
            radiusMap.invalidateSize(); 
            window.updateRadiusPreview(); // Auto refresh bulatan saat map dibuka
        }, 300); 
    }
};

window.tutupModal = (id) => { 
    const md = document.getElementById(id);
    if(md) md.classList.replace('flex', 'hidden'); 
};

window.bukaModalDriver = () => {
    // Kosongin Form
    document.getElementById('d-id').value = '';
    document.getElementById('d-user').value = '';
    document.getElementById('d-pass').value = '';
    document.getElementById('d-nama').value = '';
    document.getElementById('d-wa').value = '';
    document.getElementById('d-nopol').value = '';
    document.getElementById('d-warna').value = '';
    
    const md = document.getElementById('modal-form-driver');
    if(md) md.classList.replace('hidden', 'flex');
}

// ===============================================
// INISIALISASI LEAFLET MAPS (RADAR, EKSPEDISI, RADIUS)
// ===============================================
let adminMap = null, eksMap = null, radiusMap = null;
let radiusCircle = null, radiusMarker = null;

if (typeof L !== 'undefined') {
    // Default Basecamp (Akan ter-overwrite kalau udh disave di DB)
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
    }

    // MAP BARU KHUSUS GEOFENCING
    if(document.getElementById('radius-map')) {
        radiusMap = L.map('radius-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(radiusMap);
        
        radiusMarker = L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(radiusMap);
        radiusCircle = L.circle([OFFICE.lat, OFFICE.lng], {
            color: '#EF4444',       // Border Merah
            fillColor: '#EF4444',   // Isian Merah Transparan
            fillOpacity: 0.15,
            weight: 2,
            dashArray: '5, 5',      // Efek putus-putus
            radius: 3000            // 3 KM (Default Muter 6KM)
        }).addTo(radiusMap);
    }
}

// ===============================================
// LOGIC GEOFENCING (RADIUS)
// ===============================================
window.updateRadiusPreview = function() {
    if(!radiusMap) return;
    const lat = parseFloat(document.getElementById('rad-lat').value) || -6.977414;
    const lng = parseFloat(document.getElementById('rad-lng').value) || 107.555359;
    const km = parseFloat(document.getElementById('rad-km').value) || 3;
    
    const newPos = new L.LatLng(lat, lng);
    const radiusMeters = km * 1000; 

    // Update Posisi Pin dan Bulatan
    radiusMarker.setLatLng(newPos);
    radiusCircle.setLatLng(newPos);
    radiusCircle.setRadius(radiusMeters);
    
    // Auto Zoom/Geser map biar bulatannya nge-pas layar
    radiusMap.setView(newPos);
    radiusMap.fitBounds(radiusCircle.getBounds(), { padding: [30, 30] });
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

    // LOGIC SAVE KE DATABASE SUPABASE (Tabel 'settings')
    if(window.supabase) {
        try {
            // Karena ini single row settings, kita asumsikan upsert data ke id = 1
            const { error } = await window.supabase.from('settings').upsert({ id: 1, ...settingsData });
            if (error) throw error;
            alert("Batas area operasional berhasil dikunci ke sistem! Customer di luar jarak " + km + " KM otomatis tertolak.");
        } catch(e) {
            console.error(e);
            alert("Gagal simpan ke Supabase, namun tersimpan di sistem lokal (Cache).");
            // Fallback save lokal sementara
            localStorage.setItem('mapel_radius_settings', JSON.stringify(settingsData));
        }
    }
};

// ===============================================
// LOGIC PEMBUATAN AKUN DRIVER (SUPABASE MULTI-CLIENT TRICK)
// ===============================================
window.simpanAkunDriver = async function() {
    const id = document.getElementById('d-id').value;
    const email = document.getElementById('d-user').value;
    const pass = document.getElementById('d-pass').value;
    const nama = document.getElementById('d-nama').value;
    const wa = document.getElementById('d-wa').value;
    const tipe = document.getElementById('d-tipe').value;
    const nopol = document.getElementById('d-nopol').value;
    const warna = document.getElementById('d-warna').value;

    if (!email || !pass || !nama) return alert("Email, Password, dan Nama Driver Wajib Diisi!");
    if (pass.length < 6) return alert("Password minimal 6 karakter!");

    const btnSave = document.getElementById('btn-save-driver');
    const originalText = btnSave.innerText;
    btnSave.innerText = "Membuat Akun...";
    btnSave.disabled = true;

    try {
        if(window.supabase) {
            // TRICK DEWA: Bikin Client Supabase "Bayangan" agar Admin tidak ter-logout saat bikin akun orang lain.
            // PersistSession: false memastikan token admin lokal lu aman!
            const sbAdminClient = window.supabase.createClient(
                'https://nahgibyegdeioquryfde.supabase.co', 
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5haGdpYnllZ2RlaW9xdXJ5ZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODM3NjksImV4cCI6MjA5NDE1OTc2OX0.NeN2uqRTKEJyc0SOEIV5iUQIIOGf88A46KRJffGUKmQ', 
                { auth: { persistSession: false } }
            );

            // 1. Daftarkan kredensial Auth Driver ke Supabase secara diam-diam
            const { data: authData, error: authErr } = await sbAdminClient.auth.signUp({
                email: email,
                password: pass
            });
            if (authErr) throw authErr;

            // 2. Suntik data Profil dan Kendaraan Driver ke tabel 'profiles'
            const { error: profileErr } = await window.supabase.from('profiles').update({
                full_name: nama,
                whatsapp: wa,
                role: 'driver', // Paksa role jadi Driver
                driver_id: id || `DRV-${Math.floor(Math.random() * 9999)}`,
                kendaraan_tipe: tipe,
                kendaraan_nopol: nopol,
                kendaraan_warna: warna,
                password_hint: pass // Hanya utk catatan admin
            }).eq('id', authData.user.id);
            
            if (profileErr) throw profileErr;

            alert(`BERHASIL! Akun Mitra Driver atas nama ${nama} siap digunakan.\n\nSuruh driver login aplikasi pakai:\nEmail: ${email}\nPassword: ${pass}`);
            window.tutupModal('modal-form-driver');
            
            // TODO: Panggil fungsi render ulang list driver admin di sini nantinya
        } else {
            alert("Sistem belum terkoneksi ke Database!");
        }
    } catch(err) {
        alert("Gagal Bikin Akun: " + err.message);
    } finally {
        btnSave.innerText = originalText;
        btnSave.disabled = false;
    }
};
