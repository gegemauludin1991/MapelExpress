/**
 * MAIN APP CONTROLLER - SISI CUSTOMER (PRODUCTION READY)
 * Fix: Integrasi Tarif Admin, Dropdown Otomatis, Profil Google & GPS Akurat
 */

const OFFICE = { lat: -6.977414, lng: 107.555359, wa: "6281234567890", alamat: "Jl. Raya Margaasih, Kab. Bandung" };
const myMap = typeof DynamicMap !== 'undefined' ? new DynamicMap('map', OFFICE.lat, OFFICE.lng, 14) : null;

if (myMap) {
    if(myMap.driverMarker) myMap.map.removeLayer(myMap.driverMarker);
    const officeIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] });
    L.marker([OFFICE.lat, OFFICE.lng], { icon: officeIcon }).addTo(myMap.map).bindPopup(`
        <div class="font-sans text-center w-48 whitespace-normal">
            <h3 class="font-bold text-blue-800 text-[13px] border-b border-gray-200 pb-1 mb-1">MapelExpress</h3>
            <p class="text-[10px] text-gray-600 leading-tight">Komplek CCM No 105, Desa Mekarrahayu, Kec Margaasih, Kab Bandung</p>
        </div>
    `);
}

function getWaktuSekarang() {
    const now = new Date();
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${now.getDate()} ${bulan[now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

const kurirIcon = typeof L !== 'undefined' ? L.icon({ iconUrl: '/assets/icons/kurir.png', iconSize: [40, 40], iconAnchor: [20, 20] }) : null;

// State Global
let liveDriverMarker = null; 
let isOrderActive = false; 
let currentJenisLayanan = 'personal'; 
let customerNotifs = JSON.parse(localStorage.getItem('mapel_customer_notif')) || [];

let pickingMode = null; 
let pickupMarker = null;  
let targetDestMarker = null; 
let realGpsLatLng = null; 
let realGpsMarker = null;
let reverseGeocodeTimer = null; 

// State Setting Dari Admin
window.appSettings = { jarak_dasar: 5000, jarak_per_km: 5000, kategori_berat: [], kategori_dimensi: [] };
window.currentJarakKm = 0; 
window.totalOngkir = 0;

// ==========================================
// 1. INISIALISASI DATA (SUPABASE FETCHING)
// ==========================================
document.addEventListener("DOMContentLoaded", async () => {
    if (window.supabaseClient) {
        try {
            // 1. CEK SESI & PROFIL (FALLBACK KE GOOGLE NAME)
            const { data: { session } } = await window.supabaseClient.auth.getSession();
            if (session) {
                const { data: profile } = await window.supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
                
                // Cerdas: Tarik nama dari Google kalau nama di Profile kosong
                const googleName = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email.split('@')[0];
                const finalName = profile?.full_name || googleName;

                window.currentUserProfile = profile || { id: session.user.id, full_name: finalName, whatsapp: '' };
                
                // Isi otomatis di Form Profil Modal
                document.getElementById('profile-name-input').value = finalName;
                document.getElementById('profile-email-text').innerText = session.user.email;
                document.getElementById('profile-wa-input').value = profile?.whatsapp || '';

                // Sapaan Header
                document.getElementById('header-greeting').innerText = `Hai, ${finalName.split(' ')[0]}! 👋`;
            }

            // 2. TARIK DATA EKSPEDISI REAL
            const { data: eksData } = await window.supabaseClient.from('ekspedisi').select('*');
            if (eksData) {
                window.ekspedisiList = eksData;
                renderPinEkspedisi();
            }

            // 3. TARIK PENGATURAN TARIF (DYNAMIC PRICING)
            const { data: setttingData } = await window.supabaseClient.from('settings').select('*').eq('id', 1).single();
            if (setttingData && setttingData.data) {
                window.appSettings = setttingData.data;
                ubahInputJadiDropdown(window.appSettings); // Sulap form HTML jadi Dropdown!
            }

        } catch(e) { console.error("Gagal load data awal: ", e); }
    }

    const btnNotif = document.getElementById('btn-notif-customer');
    const btnProfile = document.getElementById('btn-profile');
    if (btnNotif) {
        btnNotif.onclick = () => {
            renderCustomerNotifs();
            window.showModal('modal-cust-notif');
            const dot = document.getElementById('cust-notif-dot');
            if(dot) dot.classList.add('hidden');
        };
    }
    if (btnProfile) btnProfile.onclick = () => window.showModal('modal-cust-profile');
});

// ==========================================
// 2. LOGIC TARIF DINAMIS & UI DROPDOWN
// ==========================================

// Fungsi ini sengaja nyari input 'form-berat' & 'form-dimensi' di HTML lu,
// trus dihapus dan diganti pake elemen <select> (Dropdown) dari data Supabase Admin.
function ubahInputJadiDropdown(settings) {
    const elBerat = document.getElementById('form-berat');
    const elDimensi = document.getElementById('form-dimensi');
    if(!elBerat || !elDimensi) return;

    const wadahBerat = elBerat.parentNode;
    const wadahDimensi = elDimensi.parentNode;

    // Render Dropdown Berat
    let selectBerat = `<select id="form-berat" class="w-full mt-1 bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold text-xs outline-none focus:border-blue-500" onchange="window.hitungTotalOngkir()">`;
    if(settings.kategori_berat.length === 0) selectBerat += `<option value="0">Default (Gratis)</option>`;
    settings.kategori_berat.forEach(b => { selectBerat += `<option value="${b.harga}" data-label="${b.nama}">${b.nama} ${b.harga > 0 ? '(+Rp '+b.harga+')' : ''}</option>`; });
    selectBerat += `</select>`;
    wadahBerat.innerHTML = `<label class="text-[10px] font-bold text-gray-500 uppercase">Kategori Berat</label>` + selectBerat;

    // Render Dropdown Dimensi
    let selectDimensi = `<select id="form-dimensi" class="w-full mt-1 bg-white border border-gray-200 rounded-xl px-4 py-3 font-bold text-xs outline-none focus:border-blue-500" onchange="window.hitungTotalOngkir()">`;
    if(settings.kategori_dimensi.length === 0) selectDimensi += `<option value="0">Default (Gratis)</option>`;
    settings.kategori_dimensi.forEach(d => { selectDimensi += `<option value="${d.harga}" data-label="${d.nama}">${d.nama} ${d.harga > 0 ? '(+Rp '+d.harga+')' : ''}</option>`; });
    selectDimensi += `</select>`;
    wadahDimensi.innerHTML = `<label class="text-[10px] font-bold text-gray-500 uppercase">Dimensi Barang</label>` + selectDimensi;
}

window.hitungTotalOngkir = function() {
    if(!window.appSettings || window.currentJarakKm === 0) return;
    
    let baseFare = window.appSettings.jarak_dasar || 5000;
    let perKmFare = window.appSettings.jarak_per_km || 5000;
    
    // Logika Jarak: 1 KM pertama ikut Tarif Dasar, sisa KM dikali Tarif per KM
    let extraKm = Math.max(0, window.currentJarakKm - 1); 
    let ongkirJarak = baseFare + (extraKm * perKmFare);

    // Ambil nilai dari Dropdown yang baru kita buat
    const valBerat = parseInt(document.getElementById('form-berat')?.value) || 0;
    const valDimensi = parseInt(document.getElementById('form-dimensi')?.value) || 0;

    window.totalOngkir = ongkirJarak + valBerat + valDimensi;

    // Update Text Tombol Order
    const btnPesan = document.getElementById('btn-pesan-kurir');
    if(btnPesan && !btnPesan.disabled) {
        btnPesan.innerHTML = `Order (Rp ${window.totalOngkir.toLocaleString('id-ID')}) <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>`;
    }
}

// ==========================================
// 3. LOGIC PROFIL 
// ==========================================
window.simpanProfilCustomer = async () => {
    const btn = document.getElementById('btn-save-profile');
    const inputNama = document.getElementById('profile-name-input').value;
    const inputWa = document.getElementById('profile-wa-input').value;

    if (!inputNama || !inputWa) return alert("Nama dan WhatsApp wajib diisi bro!");

    btn.innerText = "Menyimpan...";
    btn.disabled = true;

    if (window.supabaseClient && window.currentUserProfile) {
        const { error } = await window.supabaseClient.from('profiles').upsert({
            id: window.currentUserProfile.id,
            full_name: inputNama,
            whatsapp: inputWa,
            role: 'customer'
        });

        if (error) {
            alert("Gagal menyimpan profil: " + error.message);
        } else {
            alert("Mantap, Profil berhasil diperbarui!");
            document.getElementById('header-greeting').innerText = `Hai, ${inputNama.split(' ')[0]}! 👋`;
            window.currentUserProfile.full_name = inputNama;
            window.currentUserProfile.whatsapp = inputWa;
            window.closeAllModals();
        }
    }
    btn.innerText = "Simpan Profil";
    btn.disabled = false;
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

window.hubungiAdmin = () => { window.open(`https://wa.me/${OFFICE.wa}?text=Halo Admin MapelExpress, saya butuh bantuan...`, '_blank'); };
window.kirimFeedback = () => { window.open(`https://wa.me/${OFFICE.wa}?text=Feedback Aplikasi: \n`, '_blank'); };

function renderCustomerNotifs() {
    const list = document.getElementById('cust-notif-list');
    if(!list) return;
    list.innerHTML = '';
    if(customerNotifs.length === 0) { 
        list.innerHTML = `<p class="text-center text-gray-400 font-bold mt-10">Belum ada riwayat notifikasi</p>`; 
        return; 
    }
    
    customerNotifs.forEach(n => {
        list.innerHTML += `
        <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative mb-3">
            <div class="flex justify-between items-center mb-2">
                <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 bg-blue-500 rounded-full"></span><h4 class="font-black text-gray-800 text-sm">${n.title}</h4></div>
                <span class="text-[11px] font-bold text-gray-400">${n.time}</span>
            </div>
            <p class="text-xs text-gray-600 leading-relaxed">${n.message || (n.alamatTujuan ? `Paket ke ${n.alamatTujuan} telah diantar.` : '')}</p>
        </div>`;
    });
}

// ==========================================
// 4. LOGIC ORDER LANGSUNG KE SUPABASE
// ==========================================
function getBtnOrderHTML(type) {
    if(type === 'loading') {
        return `Memproses... <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
    } else {
        return `Order (Rp ${window.totalOngkir.toLocaleString('id-ID')}) <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>`;
    }
}

document.getElementById('btn-pesan-kurir').onclick = async () => {
    if (!pickupMarker || !targetDestMarker) return alert("Titik lokasi belum lengkap!");
    
    // Validasi WA
    if(!window.currentUserProfile?.whatsapp) {
        alert("Kamu wajib melengkapi No WhatsApp di Menu Profil sebelum bisa memesan kurir!");
        return window.showModal('modal-cust-profile');
    }

    const btnPesan = document.getElementById('btn-pesan-kurir');
    btnPesan.innerHTML = getBtnOrderHTML('loading');
    btnPesan.className = "bg-gray-800 text-white text-[13px] font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center gap-2 pointer-events-none shadow-md"; 
    
    // Dapetin Text Murni dari Dropdown buat ditaro di Database Order
    const selBerat = document.getElementById('form-berat');
    const selDimensi = document.getElementById('form-dimensi');
    const textBerat = selBerat ? selBerat.options[selBerat.selectedIndex].getAttribute('data-label') || '-' : '-';
    const textDimensi = selDimensi ? selDimensi.options[selDimensi.selectedIndex].getAttribute('data-label') || '-' : '-';

    const orderId = "ORD-" + Math.floor(Math.random() * 90000);
    const orderDataJSON = {
        jenisLayanan: currentJenisLayanan,
        namaBarang: document.getElementById('form-nama').value || 'Paket Reguler',
        keterangan: document.getElementById('form-keterangan').value || '-',
        berat: textBerat,
        dimensi: textDimensi,
        jarakKm: window.currentJarakKm,
        totalOngkir: window.totalOngkir,
        alamatJemput: document.getElementById('input-jemput').value,
        jemputLat: pickupMarker.getLatLng().lat, jemputLng: pickupMarker.getLatLng().lng,
        alamatTujuan: document.getElementById('input-tujuan').value,
        tujuanLat: targetDestMarker.getLatLng().lat, tujuanLng: targetDestMarker.getLatLng().lng,
        customerName: window.currentUserProfile?.full_name || 'Customer',
        customerWa: window.currentUserProfile?.whatsapp || '',
        tracking: [{ time: getWaktuSekarang(), status: 'Pesanan Dibuat, Mencari Driver...' }]
    };
    
    window.currentOrderData = { id: orderId, ...orderDataJSON };

    // INSERT KE TABEL ORDERS
    if(window.supabaseClient) {
        const { error } = await window.supabaseClient.from('orders').insert({
            id: orderId,
            status: 'pending',
            data: orderDataJSON
        });

        if(error) {
            alert("Gagal membuat orderan: " + error.message);
            btnPesan.innerHTML = getBtnOrderHTML('normal');
            btnPesan.className = "bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 pointer-events-auto cursor-pointer shadow-lg active:scale-95";
        } else {
            isOrderActive = true;
            document.getElementById('section-form-order').innerHTML = `
                <div class="bg-blue-50 border border-blue-100 p-5 rounded-3xl mb-3 shadow-sm text-center">
                    <div class="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm animate-pulse"><span class="text-xl">🛵</span></div>
                    <h4 class="font-black text-blue-800">Sedang Mencari Kurir...</h4>
                    <p class="text-xs text-gray-500 mt-1">Mohon tunggu sebentar, sistem sedang mencarikan mitra terdekat untuk menjemput paketmu.</p>
                </div>
            `;
        }
    }
};

// ==========================================
// 5. LISTENER REALTIME DARI db.js
// ==========================================
if(window.appEvents) {
    window.appEvents.on('order_status_changed', (orderData) => {
        if(!isOrderActive || orderData.id !== window.currentOrderData?.id) return;

        if(orderData.status === 'accepted') {
            const driver = orderData.data.driver; 
            document.getElementById('section-form-order').innerHTML = `
                <div class="bg-white border p-5 rounded-3xl mb-3 shadow-lg">
                    <p id="status-jemput-teks" class="text-[11px] font-black text-blue-600 uppercase mb-3 animate-pulse">Kurir Menuju Lokasi Jemput</p>
                    <div class="flex items-center gap-4">
                        <img src="${driver?.photo || '/assets/icons/kurir.png'}" class="w-14 h-14 rounded-full border border-gray-200 object-cover">
                        <div class="flex-1">
                            <h4 class="font-black text-gray-800">${driver?.name || 'Mitra Driver'}</h4>
                            <p class="text-xs text-gray-500 font-bold">${driver?.nopol || '-'}</p>
                        </div>
                    </div>
                    <a href="https://wa.me/${driver?.wa || OFFICE.wa}" target="_blank" class="mt-4 flex items-center justify-center gap-2 w-full bg-[#25D366] text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg> Hubungi Driver
                    </a>
                </div>
            `;
        } 
        else if (orderData.status === 'picked_up') {
            const statusText = document.getElementById('status-jemput-teks');
            if(statusText) {
                statusText.innerText = "Paket Dalam Perjalanan ke Tujuan";
                statusText.classList.replace('text-blue-600', 'text-orange-500');
            }
        }
        else if (orderData.status === 'completed') {
            isOrderActive = false;
            if (liveDriverMarker && myMap) myMap.map.removeLayer(liveDriverMarker);
            
            customerNotifs.unshift({ 
                title: "Paket Selesai Diantar 🎉", 
                time: getWaktuSekarang(),
                alamatTujuan: window.currentOrderData.alamatTujuan 
            });
            localStorage.setItem('mapel_customer_notif', JSON.stringify(customerNotifs));

            const successHtml = `
                <div id="modal-success-order" class="fixed inset-0 z-[100000] flex items-center justify-center bg-gray-900 bg-opacity-70 backdrop-blur-sm p-5">
                    <div class="bg-white w-full max-w-sm rounded-[2rem] p-8 text-center shadow-2xl transform transition-transform duration-300 scale-100">
                        <div class="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h2 class="text-2xl font-black text-gray-800 mb-1">Paket Terkirim!</h2>
                        <p class="text-[12px] text-gray-500 leading-relaxed px-2">Yey! Kurir sudah berhasil mengantarkan paket kamu ke lokasi tujuan dengan aman.</p>
                        <button onclick="location.reload()" class="w-full mt-6 bg-green-500 hover:bg-green-600 text-white font-black py-4 rounded-xl shadow-[0_4px_15px_rgba(34,197,94,0.3)] transition-all">Tutup & Pesan Lagi</button>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', successHtml);
        }
    });

    window.appEvents.on('update_driver_map', (data) => {
        if (!isOrderActive || !myMap) return; 
        if (!liveDriverMarker) {
            liveDriverMarker = L.marker([data.lat, data.lng], { icon: kurirIcon, zIndexOffset: 99999 }).addTo(myMap.map);
        } else {
            liveDriverMarker.setLatLng([data.lat, data.lng]);
        }
    });
}

// ==========================================
// 6. MAP & GPS LOGIC (PICKING, ROUTING)
// ==========================================
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

function getPinLatLng() {
    if (!myMap) return null;
    const overlay = document.getElementById('svg-pin-overlay'); 
    if(!overlay) return myMap.map.getCenter();
    const rect = overlay.getBoundingClientRect();
    const pinX = rect.left + (rect.width / 2);
    const pinY = rect.bottom;
    return myMap.map.containerPointToLatLng([pinX, pinY]);
}

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
                if(inputJemput && inputJemput.value === 'Mencari GPS...') inputJemput.value = alamat;
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

    myMap.map.on('moveend', function() {
        if(pickingMode) {
            const center = getPinLatLng(); 
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

    const center = getPinLatLng();
    document.getElementById('set-lokasi-title').innerText = "Mencari lokasi...";
    getAddressFromCoords(center.lat, center.lng).then(alamat => {
        if(pickingMode) {
            document.getElementById('set-lokasi-title').innerText = alamat;
            document.getElementById('set-lokasi-dot').classList.remove('animate-pulse');
        }
    });
}

window.exitPickingMode = function() {
    pickingMode = null;
    document.getElementById('set-lokasi-card').classList.add('opacity-0'); 
    document.getElementById('center-pin-overlay').classList.add('hidden');
    
    setTimeout(() => { 
        document.getElementById('set-lokasi-card').classList.add('hidden'); 
        const bs = document.getElementById('bottom-sheet');
        if(bs) { bs.style.transform = 'translateY(0)'; isSheetOpen = true; }
    }, 300);
}

document.getElementById('btn-pick-jemput').onclick = () => { pickingMode = 'jemput'; enterPickingMode("Set Lokasi Jemput", "blue"); };
document.getElementById('btn-pick-tujuan').onclick = () => { pickingMode = 'tujuan'; currentJenisLayanan = 'personal'; enterPickingMode("Set Tujuan Personal", "red"); };

document.getElementById('btn-set-lokasi').onclick = async () => {
    const btn = document.getElementById('btn-set-lokasi');
    const originalText = btn.innerText;
    btn.innerText = "Memproses...";
    btn.disabled = true;

    const center = getPinLatLng(); 
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
    ], (hasil) => {
        document.getElementById('label-jarak-rute').innerText = `Jarak: ${hasil.jarakKm} KM`;
        window.currentJarakKm = hasil.jarakKm; // Simpan jarak
        window.hitungTotalOngkir(); // Re-kalkulasi
    });
};

// ==========================================
// 7. EKSPEDISI & RUTING LOGIC
// ==========================================
function getEkspedisiLogo(nama) {
    if (!nama) return null;
    const n = nama.toLowerCase();
    const ts = new Date().getTime(); // Anti-Cache
    if (n.includes('j&t') || n.includes('jnt')) return `/assets/icons/j%26t.png?v=${ts}`;
    if (n.includes('jne')) return `/assets/icons/jne.png?v=${ts}`;
    if (n.includes('ninja')) return `/assets/icons/ninja.png?v=${ts}`;
    if (n.includes('spx') || n.includes('shopee')) return `/assets/icons/spx.png?v=${ts}`;
    if (n.includes('wahana')) return `/assets/icons/wahana.png?v=${ts}`;
    if (n.includes('sicepat') || n.includes('si cepat')) return `/assets/icons/sicepat.png?v=${ts}`;
    return null;
}

function renderPinEkspedisi() {
    if (!window.ekspedisiList || window.ekspedisiList.length === 0 || !myMap) return;
    window.ekspedisiList.forEach(eks => {
        const logoUrl = getEkspedisiLogo(eks.nama);
        myMap.addMarker(
            eks.lat, eks.lng, 'ekspedisi', 
            `<div class="text-center font-sans"><p class="font-bold text-[13px] text-gray-800 mb-1">${eks.nama}</p>
            <button onclick="window.buatRuteKeTujuan(${eks.lat}, ${eks.lng}, '${eks.nama}')" class="bg-blue-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full w-full shadow-md">PILIH TUJUAN</button></div>`,
            logoUrl
        );
    });
}

window.cariEkspedisiCepat = (brandName) => {
    currentJenisLayanan = 'ekspedisi';
    if (!window.ekspedisiList || window.ekspedisiList.length === 0) return alert("Belum ada ekspedisi!");
    const target = window.ekspedisiList.find(e => e.nama.toUpperCase().includes(brandName.toUpperCase()));
    if (target) window.buatRuteKeTujuan(target.lat, target.lng, target.nama);
    else alert(`Gerai ${brandName} tidak ditemukan.`);
};

window.bukaDaftarEkspedisi = () => {
    currentJenisLayanan = 'ekspedisi';
    const listContainer = document.getElementById('list-semua-ekspedisi');
    listContainer.innerHTML = '';
    
    if(!window.ekspedisiList || window.ekspedisiList.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-xs text-gray-400 font-bold py-4">Belum ada ekspedisi tersedia.</p>`;
    } else {
        window.ekspedisiList.forEach(eks => {
            const logoUrl = getEkspedisiLogo(eks.nama);
            listContainer.innerHTML += `
            <div onclick="window.buatRuteKeTujuan(${eks.lat}, ${eks.lng}, '${eks.nama}')" class="bg-white border border-gray-100 p-3 rounded-2xl flex items-center gap-3 cursor-pointer active:bg-gray-50 mb-2 shadow-sm">
                <div class="w-12 h-12 bg-gray-50 rounded-xl p-1.5 border border-gray-100 flex-shrink-0"><img src="${logoUrl}" class="w-full h-full object-contain" onerror="this.src='/assets/icons/pin.png'"></div>
                <div class="flex-1"><p class="text-[13px] font-black">${eks.nama}</p><p class="text-[10px] text-gray-400 font-bold uppercase">Mitra Terdaftar</p></div>
                <div class="bg-blue-50 text-blue-600 p-2 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg></div>
            </div>`;
        });
    }
    
    listContainer.classList.replace('hidden', 'flex'); listContainer.classList.add('flex-col');
    const bs = document.getElementById('bottom-sheet');
    if(bs) { bs.style.transform = 'translateY(0)'; isSheetOpen = true; }
};

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
        window.currentJarakKm = hasil.jarakKm; // SIMPAN JARAK LALU HITUNG ONGKIR
        window.hitungTotalOngkir();
        
        document.getElementById('section-pilih-ekspedisi').classList.add('hidden');
        document.getElementById('section-form-order').classList.remove('hidden');
        
        const btnPesan = document.getElementById('btn-pesan-kurir');
        btnPesan.disabled = false;
        btnPesan.innerHTML = getBtnOrderHTML('normal');
        btnPesan.className = "bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all flex items-center justify-center gap-2 pointer-events-auto cursor-pointer shadow-lg active:scale-95";
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
    window.currentJarakKm = 0;
};

// UI Handling Bottom Sheet
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
