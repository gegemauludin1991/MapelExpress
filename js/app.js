/**
 * MAIN APP CONTROLLER - SISI CUSTOMER
 * (Terkoneksi Supabase, Auto-Sync Profil Google, & GPS Aktif)
 */

const OFFICE = { lat: -6.977414, lng: 107.555359, wa: "6281234567890", alamat: "Jl. Raya Margaasih, Kab. Bandung" };
const myMap = typeof DynamicMap !== 'undefined' ? new DynamicMap('map', OFFICE.lat, OFFICE.lng, 14) : null;

if (myMap) {
    myMap.map.removeLayer(myMap.driverMarker);
    const officeIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] });
    L.marker([OFFICE.lat, OFFICE.lng], { icon: officeIcon }).addTo(myMap.map).bindPopup(`
        <div class="font-sans text-center w-48 whitespace-normal">
            <h3 class="font-bold text-blue-800 text-[13px] border-b border-gray-200 pb-1 mb-1">MapelExpress</h3>
            <p class="text-[10px] text-gray-600 leading-tight">Komplek CCM No 105, Desa Mekarrahayu, Kec Margaasih, Kab Bandung</p>
        </div>
    `);
}

const socket = window.socketBridge || { on: function(){}, emit: function(){} };

function getWaktuSekarang() {
    const now = new Date();
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${now.getDate()} ${bulan[now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

const kurirIcon = typeof L !== 'undefined' ? L.icon({ iconUrl: '/assets/icons/kurir.png', iconSize: [40, 40], iconAnchor: [20, 20] }) : null;
let liveDriverMarker = null; 
let isOrderActive = false; 
let currentJenisLayanan = 'personal'; 
let customerNotifs = JSON.parse(localStorage.getItem('mapel_customer_notif')) || [];

document.addEventListener("DOMContentLoaded", async () => {
    window.ekspedisiList = JSON.parse(localStorage.getItem('mapel_ekspedisi')) || [];
    if(typeof renderPinEkspedisi === 'function') renderPinEkspedisi();

    // MESIN AUTO-SYNC DATA PROFIL CUSTOMER KE DATABASE
    if (typeof supabase !== 'undefined') {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                // Tarik data profil dari database (bukan cuma dari Google doang)
                let { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                
                // Menentukan nama & WA prioritas (Data Manual -> Data Google -> Default Email)
                const finalName = profile?.full_name || user.user_metadata?.full_name || user.email.split('@')[0];
                const finalWa = profile?.whatsapp || user.user_metadata?.whatsapp || "";

                // Jika user login via Google & datanya belum masuk tabel database, KITA BUATIN OTOMATIS!
                if (!profile) {
                    const newProfile = { id: user.id, full_name: finalName, whatsapp: finalWa, role: 'customer' };
                    await supabase.from('profiles').upsert([newProfile]);
                    profile = newProfile;
                }

                // Simpan profil di memori sementara biar bisa diedit
                window.currentUserProfile = { id: user.id, email: user.email, role: profile?.role || 'customer' };

                // Update Tampilan UI Sesuai Data Asli Database
                document.getElementById('profile-name-input').value = finalName;
                document.getElementById('profile-email-text').innerText = user.email;
                document.getElementById('profile-wa-input').value = finalWa;

                const namaPanggilan = finalName.split(' ')[0];
                document.getElementById('header-greeting').innerText = `Hai, ${namaPanggilan}! 👋`;
            }
        } catch(e) { console.error("Gagal menarik profil: ", e); }
    }

    const btnNotif = document.getElementById('btn-notif-customer');
    const btnProfile = document.getElementById('btn-profile');

    if (btnNotif) {
        btnNotif.onclick = () => {
            if(typeof renderCustomerNotifs === 'function') renderCustomerNotifs();
            window.showModal('modal-cust-notif');
            const dot = document.getElementById('cust-notif-dot');
            if(dot) dot.classList.add('hidden');
        };
    }
    if (btnProfile) btnProfile.onclick = () => window.showModal('modal-cust-profile');
});

// FUNGSI MENYIMPAN EDIT PROFIL (NAMA & WA)
window.simpanProfilCustomer = async () => {
    const btn = document.getElementById('btn-save-profile');
    const inputNama = document.getElementById('profile-name-input').value;
    const inputWa = document.getElementById('profile-wa-input').value;

    if (!inputNama || !inputWa) return alert("Nama dan WhatsApp tidak boleh kosong!");

    btn.innerText = "Menyimpan...";
    btn.disabled = true;

    if (typeof supabase !== 'undefined' && window.currentUserProfile) {
        // Update data ke Database Supabase
        const { error } = await supabase.from('profiles').upsert({
            id: window.currentUserProfile.id,
            full_name: inputNama,
            whatsapp: inputWa,
            role: window.currentUserProfile.role
        });

        if (error) {
            alert("Gagal menyimpan profil: " + error.message);
        } else {
            alert("Profil berhasil diperbarui!");
            // Update Sapaan Header
            const namaPanggilan = inputNama.split(' ')[0];
            document.getElementById('header-greeting').innerText = `Hai, ${namaPanggilan}! 👋`;
            window.closeAllModals();
        }
    }

    btn.innerText = "Simpan Profil";
    btn.disabled = false;
};

// FUNGSI LOGOUT YANG MENGATASI BUG NYANGKUT
window.eksekusiLogout = async () => {
    if(confirm("Yakin ingin keluar dari akun ini?")) {
        try {
            if (typeof supabase !== 'undefined') {
                await supabase.auth.signOut(); // Hancurkan sesi di server
            }
            localStorage.clear(); // Bersihkan sampah HP
            sessionStorage.clear();
            window.location.replace('/index.html'); // Lempar ke halaman login
        } catch (e) {
            console.error("Logout gagal:", e);
            localStorage.clear();
            window.location.replace('/index.html'); // Paksa buang walau error
        }
    }
};

window.showModal = (id) => {
    const backdrop = document.getElementById('backdrop-overlay');
    if(backdrop) backdrop.classList.remove('hidden');
    setTimeout(() => { 
        const el = document.getElementById(id);
        if(el) {
            if(id === 'modal-cust-profile') el.classList.remove('translate-x-full');
            else el.classList.remove('translate-y-full'); 
        }
    }, 50);
};

window.closeAllModals = () => {
    const notifModal = document.getElementById('modal-cust-notif');
    if(notifModal) notifModal.classList.add('translate-y-full');
    const profileModal = document.getElementById('modal-cust-profile');
    if(profileModal) profileModal.classList.add('translate-x-full');
    setTimeout(() => { 
        const backdrop = document.getElementById('backdrop-overlay');
        if(backdrop) backdrop.classList.add('hidden'); 
    }, 300);
};

window.hubungiAdmin = () => { window.open(`https://wa.me/${OFFICE.wa}?text=Halo Admin`, '_blank'); };
window.kirimFeedback = () => { window.open(`https://wa.me/${OFFICE.wa}?text=Feedback`, '_blank'); };

window.swapLokasi = () => {
    if (!pickupMarker || !targetDestMarker) return alert("Tentukan Titik Jemput dan Tujuan!");
    const inputJemput = document.getElementById('input-jemput');
    const inputTujuan = document.getElementById('input-tujuan');
    
    const tempText = inputJemput.value;
    inputJemput.value = inputTujuan.value;
    inputTujuan.value = tempText;

    const tempLatLng = pickupMarker.getLatLng();
    pickupMarker.setLatLng(targetDestMarker.getLatLng());
    targetDestMarker.setLatLng(tempLatLng);

    myMap.drawRoute([
        { lat: pickupMarker.getLatLng().lat, lng: pickupMarker.getLatLng().lng }, 
        { lat: targetDestMarker.getLatLng().lat, lng: targetDestMarker.getLatLng().lng }
    ], (hasil) => document.getElementById('label-jarak-rute').innerText = `Jarak: ${hasil.jarakKm} KM`);
};

// MESIN GPS KEMBALI AKTIF
async function getAddressFromCoords(lat, lng) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
        const data = await res.json();
        if (data && data.display_name) {
            let arr = data.display_name.split(', ');
            let cleanArr = arr.filter(p => !p.match(/^\d{5}$/) && p.trim().toLowerCase() !== 'indonesia');
            return cleanArr.join(', ');
        }
        return "Lokasi Terpilih";
    } catch (e) { return "Titik Terpilih"; }
}

let realGpsMarker = null; 
let pickupMarker = null;  
let targetDestMarker = null; 
let realGpsLatLng = null; 
let reverseGeocodeTimer = null; 

const blueDotIcon = typeof L !== 'undefined' ? L.divIcon({ className: 'bg-transparent border-0', html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_0_4px_rgba(59,130,246,0.3)]"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] }) : null;

if(myMap) {
    myMap.map.locate({ setView: false, watch: true, enableHighAccuracy: true });
    let isFirstLoc = true;

    myMap.map.on('locationfound', (e) => {
        realGpsLatLng = e.latlng; 
        if (!realGpsMarker) realGpsMarker = L.marker(e.latlng, { icon: blueDotIcon, zIndexOffset: 1000 }).addTo(myMap.map);
        else realGpsMarker.setLatLng(e.latlng);

        if (isFirstLoc) { 
            myMap.map.setView(e.latlng, 16);
            getAddressFromCoords(e.latlng.lat, e.latlng.lng).then(alamat => {
                const inputJemput = document.getElementById('input-jemput');
                if(inputJemput.value === 'Mencari GPS...') inputJemput.value = alamat;
            });
            isFirstLoc = false; 
        }
    });

    document.getElementById('btn-my-location').onclick = () => {
        if (realGpsLatLng) {
            myMap.map.setView(realGpsLatLng, 17, { animate: true });
            getAddressFromCoords(realGpsLatLng.lat, realGpsLatLng.lng).then(alamat => document.getElementById('input-jemput').value = alamat);
        }
    };
}

let pickingMode = null; 
document.getElementById('btn-pick-jemput').onclick = () => { pickingMode = 'jemput'; enterPickingMode("Set Lokasi Jemput", "blue"); };
document.getElementById('btn-pick-tujuan').onclick = () => { pickingMode = 'tujuan'; currentJenisLayanan = 'personal'; enterPickingMode("Set Tujuan Personal", "red"); };

function enterPickingMode(btnText, color) {
    pickingMode = currentJenisLayanan === 'personal' && btnText.includes('Tujuan') ? 'tujuan' : 'jemput';
    document.getElementById('bottom-sheet').style.transform = 'translateY(150%)'; 
    const hexColor = color === 'blue' ? '#2563EB' : '#DC2626';
    document.getElementById('pin-bg').setAttribute('fill', hexColor);
    document.querySelectorAll('#svg-pin-overlay path[stroke]').forEach(p => p.setAttribute('stroke', hexColor));

    if(pickupMarker && pickingMode === 'jemput') myMap.map.removeLayer(pickupMarker);
    if(targetDestMarker && pickingMode === 'tujuan') myMap.map.removeLayer(targetDestMarker);

    document.getElementById('set-lokasi-dot').className = `w-3 h-3 rounded-full bg-${color}-500 shadow-lg border-2 border-white animate-pulse`;
    document.getElementById('center-pin-overlay').classList.remove('hidden');
    document.getElementById('set-lokasi-card').classList.remove('hidden');
    setTimeout(() => { document.getElementById('set-lokasi-card').classList.remove('opacity-0'); }, 50);
    document.getElementById('btn-set-lokasi').innerText = btnText;

    document.getElementById('set-lokasi-title').innerText = "Mencari lokasi...";
    const center = myMap.map.getCenter();
    getAddressFromCoords(center.lat, center.lng).then(alamat => {
        if(pickingMode) {
            document.getElementById('set-lokasi-title').innerText = alamat;
            document.getElementById('set-lokasi-dot').classList.remove('animate-pulse');
        }
    });
}

if(myMap) {
    myMap.map.on('moveend', function() {
        if(pickingMode) {
            const center = myMap.map.getCenter();
            document.getElementById('set-lokasi-title').innerText = "Mencari lokasi...";
            document.getElementById('set-lokasi-dot').classList.add('animate-pulse');
            
            clearTimeout(reverseGeocodeTimer);
            reverseGeocodeTimer = setTimeout(() => {
                getAddressFromCoords(center.lat, center.lng).then(alamat => {
                    if (pickingMode) {
                        document.getElementById('set-lokasi-title').innerText = alamat;
                        document.getElementById('set-lokasi-dot').classList.remove('animate-pulse');
                    }
                });
            }, 800); 
        }
    });
}

document.getElementById('btn-set-lokasi').onclick = async () => {
    const btn = document.getElementById('btn-set-lokasi');
    const originalText = btn.innerText;
    btn.innerText = "Memproses...";
    btn.disabled = true;

    const center = myMap.map.getCenter();
    let alamat = document.getElementById('set-lokasi-title').innerText;
    
    if (alamat === "Geser peta untuk menentukan titik" || alamat === "Mencari lokasi...") {
        alamat = await getAddressFromCoords(center.lat, center.lng);
    }
    
    if (pickingMode === 'jemput') {
        document.getElementById('input-jemput').value = alamat;
        if (!pickupMarker) pickupMarker = myMap.addMarker(center.lat, center.lng, 'jemput', 'Lokasi Jemput Barang');
        else pickupMarker.setLatLng(center); 
    } else if (pickingMode === 'tujuan') { 
        window.buatRuteKeTujuan(center.lat, center.lng, alamat); 
    }
    
    window.exitPickingMode();
    btn.innerText = originalText;
    btn.disabled = false;
};

// FUNGSI KELUAR DARI MODE PILIH MAP
window.exitPickingMode = function() {
    pickingMode = null;
    document.getElementById('set-lokasi-card').classList.add('opacity-0'); 
    document.getElementById('center-pin-overlay').classList.add('hidden');
    
    setTimeout(() => { 
        document.getElementById('set-lokasi-card').classList.add('hidden'); 
        const bs = document.getElementById('bottom-sheet');
        if(bs) {
            bs.style.transform = 'translateY(0)'; 
            isSheetOpen = true; 
        }
    }, 300);
}

// LOGIC ORDER SAMA DENGAN ORIGINAL
window.buatRuteKeTujuan = (targetLat, targetLng, namaTujuan) => {
    myMap.map.closePopup();
    if (!pickupMarker) {
        if (!realGpsLatLng) return alert("Tunggu GPS kelock dulu bro!");
        pickupMarker = myMap.addMarker(realGpsLatLng.lat, realGpsLatLng.lng, 'jemput', 'Lokasi Jemput Barang');
        getAddressFromCoords(realGpsLatLng.lat, realGpsLatLng.lng).then(alamat => document.getElementById('input-jemput').value = alamat);
    }
    document.getElementById('input-tujuan').value = namaTujuan;
    document.getElementById('label-tujuan-form').innerText = namaTujuan;
    document.getElementById('label-tujuan-form').previousElementSibling.innerText = currentJenisLayanan === 'ekspedisi' ? 'TUJUAN EKSPEDISI' : 'TUJUAN PERSONAL';
    
    if(targetDestMarker) myMap.map.removeLayer(targetDestMarker);
    const logoUrl = currentJenisLayanan === 'ekspedisi' ? getEkspedisiLogo(namaTujuan) : null;
    const iconType = currentJenisLayanan === 'ekspedisi' ? 'ekspedisi' : 'tujuan_personal';
    
    targetDestMarker = myMap.addMarker(targetLat, targetLng, iconType, `<b>${namaTujuan}</b>`, logoUrl);
    const pickupPos = pickupMarker.getLatLng();
    myMap.drawRoute([{ lat: pickupPos.lat, lng: pickupPos.lng }, { lat: targetLat, lng: targetLng }], (hasil) => {
        document.getElementById('label-jarak-rute').innerText = `Jarak: ${hasil.jarakKm} KM`;
        document.getElementById('section-pilih-ekspedisi').classList.add('hidden');
        document.getElementById('section-form-order').classList.remove('hidden');
        const btnPesan = document.getElementById('btn-pesan-kurir');
        btnPesan.disabled = false;
        btnPesan.className = "bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center pointer-events-auto cursor-pointer shadow-lg active:scale-95 transition-transform";
    });
    const bs = document.getElementById('bottom-sheet');
    if(bs) { bs.style.transform = 'translateY(0)'; isSheetOpen = true; }
};

window.batalPilihEkspedisi = () => {
    document.getElementById('section-form-order').classList.add('hidden');
    document.getElementById('section-pilih-ekspedisi').classList.remove('hidden');
    document.getElementById('list-semua-ekspedisi').classList.add('hidden');
    document.getElementById('input-tujuan').value = "";
    if(targetDestMarker) myMap.map.removeLayer(targetDestMarker);
    if(myMap.routingControl) myMap.map.removeControl(myMap.routingControl);
};

document.getElementById('btn-pesan-kurir').onclick = () => {
    if (!pickupMarker || !targetDestMarker) return alert("Titik belum lengkap!");
    const orderData = {
        id: "ORD-" + Math.floor(Math.random() * 90000),
        jenisLayanan: currentJenisLayanan,
        namaBarang: document.getElementById('form-nama').value,
        berat: document.getElementById('form-berat').value,
        alamatJemput: document.getElementById('input-jemput').value,
        jemputLat: pickupMarker.getLatLng().lat, jemputLng: pickupMarker.getLatLng().lng,
        alamatTujuan: document.getElementById('input-tujuan').value,
        tujuanLat: targetDestMarker.getLatLng().lat, tujuanLng: targetDestMarker.getLatLng().lng,
        tracking: [{ time: getWaktuSekarang(), status: 'Pesanan Dibuat, Mencari Driver...' }]
    };
    window.currentOrderData = orderData;
    document.getElementById('btn-pesan-kurir').innerText = "Mencari Driver...";
    document.getElementById('btn-pesan-kurir').className = "bg-gray-800 text-white font-bold py-3.5 px-6 rounded-2xl pointer-events-none animate-pulse";
    socket.emit('customer_create_order', orderData);
};

let isSheetOpen = true;
const sheetHandle = document.getElementById('sheet-handle');
if (sheetHandle) {
    sheetHandle.onclick = () => {
        if (pickingMode) return; 
        const bs = document.getElementById('bottom-sheet');
        if (bs) {
            if (isSheetOpen) bs.style.transform = 'translateY(calc(100% - 35px))'; 
            else bs.style.transform = 'translateY(0)'; 
            isSheetOpen = !isSheetOpen;
        }
    };
}
