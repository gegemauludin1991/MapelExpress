/**
 * MAIN APP CONTROLLER - SISI CUSTOMER
 */

const SUPABASE_URL = 'https://nahgibyegdeioquryfde.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5haGdpYnllZ2RlaW9xdXJ5ZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODM3NjksImV4cCI6MjA5NDE1OTc2OX0.NeN2uqRTKEJyc0SOEIV5iUQIIOGf88A46KRJffGUKmQ';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const OFFICE = { lat: -6.977414, lng: 107.555359, wa: "6281234567890", alamat: "Jl. Raya Margaasih, Kab. Bandung" };
const myMap = new DynamicMap('map', OFFICE.lat, OFFICE.lng, 14);

myMap.map.removeLayer(myMap.driverMarker);

const officeIcon = L.icon({ 
    iconUrl: './assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] 
});

L.marker([OFFICE.lat, OFFICE.lng], { icon: officeIcon }).addTo(myMap.map).bindPopup(`
    <div class="font-sans text-center w-48 whitespace-normal">
        <h3 class="font-bold text-blue-800 text-[13px] border-b border-gray-200 pb-1 mb-1">MapelExpress</h3>
        <p class="text-[10px] text-gray-600 leading-tight">Komplek CCM No 105, Desa Mekarrahayu, Kec Margaasih, Kab Bandung</p>
    </div>
`);

function getWaktuSekarang() {
    const now = new Date();
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${now.getDate()} ${bulan[now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

const kurirIcon = L.icon({ iconUrl: './assets/icons/kurir.png', iconSize: [40, 40], iconAnchor: [20, 20] });

let liveDriverMarker = null; 
let isOrderActive = false; 
let currentJenisLayanan = 'personal'; 
window.currentOrderData = null; 

let customerNotifs = JSON.parse(localStorage.getItem('mapel_customer_notif')) || [];
let customerProfile = null;

if(customerNotifs.length === 0) {
    customerNotifs.push({
        type: 'system', title: 'Selamat Datang di MapelExpress! 🎉',
        message: 'Aplikasi siap digunakan. Bebas pusing, kurir kami yang jemput dan antar paketmu ke ekspedisi manapun.',
        time: new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0')
    });
    localStorage.setItem('mapel_customer_notif', JSON.stringify(customerNotifs));
}

async function initSupabaseData() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
        // Ambil data dari tabel profiles yang sesuai dengan schema lu
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (profile) {
            customerProfile = { id: profile.id, name: profile.full_name, email: session.user.email, wa: profile.whatsapp };
            updateProfileUI();
        }
    } else {
        window.location.href = './index.html'; 
    }

    const { data: settings } = await supabase.from('app_settings').select('value').eq('id', 'mapel_ekspedisi').single();
    if (settings && settings.value) {
        window.ekspedisiList = settings.value;
        renderPinEkspedisi();
    }

    supabase.channel('customer_room')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, payload => {
            if (!isOrderActive || !window.currentOrderData) return;
            const data = payload.new.data;
            if (data.id === window.currentOrderData.driverId) {
                if (!liveDriverMarker) {
                    liveDriverMarker = L.marker([data.lat, data.lng], {
                        icon: kurirIcon, rotationAngle: 0, rotationOrigin: 'center center', zIndexOffset: 99999
                    }).addTo(myMap.map);
                } else {
                    const oldPos = liveDriverMarker.getLatLng();
                    if (oldPos.lat !== data.lat || oldPos.lng !== data.lng) {
                        const sudut = myMap.hitungSudutBelok(oldPos.lat, oldPos.lng, data.lat, data.lng);
                        if (typeof liveDriverMarker.setRotationAngle === 'function') liveDriverMarker.setRotationAngle(sudut);
                        const iconElement = liveDriverMarker._icon;
                        if (iconElement) iconElement.style.transition = 'transform 1s linear';
                        liveDriverMarker.setLatLng([data.lat, data.lng]);
                    }
                }
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
            const data = payload.new.data;
            if (window.currentOrderData && data.id === window.currentOrderData.id) {
                if (data.status === 'pending' && data.driverId && !isOrderActive) {
                    isOrderActive = true; 
                    window.currentOrderData = data;
                    if (!liveDriverMarker && data.driverLat && data.driverLng) {
                        liveDriverMarker = L.marker([data.driverLat, data.driverLng], { icon: kurirIcon, zIndexOffset: 99999 }).addTo(myMap.map);
                    }
                    
                    const drvInfo = { photo: './assets/icons/kurir.png', name: data.driverName, nopol: data.driverNopol || '-', wa: data.driverWa || '' };
                    const formOrder = document.getElementById('section-form-order');
                    if(formOrder) {
                        formOrder.innerHTML = `
                            <div class="bg-white border p-5 rounded-3xl mb-3 shadow-lg">
                                <p id="status-jemput-teks" class="text-[11px] font-black text-blue-600 uppercase mb-3">Kurir Menuju Lokasi Jemput</p>
                                <div class="flex items-center gap-4">
                                    <img src="${drvInfo.photo}" class="w-14 h-14 rounded-full border object-cover">
                                    <div class="flex-1">
                                        <h4 class="font-black text-gray-800">${drvInfo.name}</h4>
                                        <p class="text-xs text-gray-500 font-bold">${drvInfo.nopol}</p>
                                    </div>
                                </div>
                                <a href="https://wa.me/${drvInfo.wa}" target="_blank" class="mt-4 flex items-center justify-center gap-2 w-full bg-[#25D366] text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg> Hubungi Driver
                                </a>
                                <div id="live-tracking-container"></div>
                            </div>
                        `;
                    }
                    renderLiveTrackingCard();
                    const btnPesan = document.getElementById('btn-pesan-kurir');
                    if (btnPesan && btnPesan.parentElement) btnPesan.parentElement.classList.add('hidden');
                }

                if (data.status === 'picked_up' && window.currentOrderData.status !== 'picked_up') {
                    window.currentOrderData = data;
                    const labelStatus = document.getElementById('status-jemput-teks');
                    if (labelStatus) {
                        const textLayanan = window.currentOrderData.jenisLayanan === 'ekspedisi' ? "EKSPEDISI" : "TUJUAN";
                        labelStatus.innerText = `KURIR MENUJU ${textLayanan}`;
                        labelStatus.classList.replace('text-blue-600', 'text-orange-500');
                    }
                    renderLiveTrackingCard();
                } 
                
                if (data.status === 'completed' && window.currentOrderData.status !== 'completed') {
                    window.currentOrderData = data;
                    const now = new Date();
                    customerNotifs.unshift({ 
                        type: 'completed', title: "Paket Selesai Diantar", 
                        time: `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`, 
                        ...window.currentOrderData 
                    });
                    localStorage.setItem('mapel_customer_notif', JSON.stringify(customerNotifs));
                    
                    const dot = document.getElementById('cust-notif-dot');
                    if(dot) dot.classList.remove('hidden');

                    if (liveDriverMarker) { myMap.map.removeLayer(liveDriverMarker); liveDriverMarker = null; }
                    isOrderActive = false;

                    const imgTujuanHtml = data.photoDropoff ? `<img src="${data.photoDropoff}" class="w-full h-32 object-cover rounded-xl mt-3 mb-2 shadow-sm border border-gray-200" />` : '';

                    const successHtml = `
                        <div id="modal-success-order" class="fixed inset-0 z-[100000] flex items-center justify-center bg-gray-900 bg-opacity-70 transition-opacity p-5">
                            <div class="bg-white w-full max-w-sm rounded-[2rem] p-8 text-center animate-bounce-in shadow-2xl">
                                <div class="w-20 h-20 bg-green-50 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                                </div>
                                <h2 class="text-2xl font-black text-gray-800 mb-1">Paket Terkirim!</h2>
                                <p class="text-[12px] text-gray-500 leading-relaxed px-2">Yey! Kurir sudah berhasil mengantarkan paket kamu ke lokasi tujuan.</p>
                                ${imgTujuanHtml}
                                <button onclick="document.getElementById('modal-success-order').remove(); location.reload();" class="w-full mt-4 bg-green-500 active:bg-green-600 text-white font-black py-4 rounded-xl shadow-[0_4px_15px_rgba(34,197,94,0.3)] transition-all">Tutup & Selesai</button>
                            </div>
                        </div>
                        <style>
                            @keyframes bounceIn { 0% { transform: scale(0.8); opacity: 0; } 60% { transform: scale(1.05); opacity: 1; } 100% { transform: scale(1); } }
                            .animate-bounce-in { animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
                        </style>
                    `;
                    document.body.insertAdjacentHTML('beforeend', successHtml);
                }
            }
        })
        .subscribe();
}

function updateProfileUI() {
    if(!customerProfile) return;
    const elName = document.getElementById('profile-name-text');
    const elEmail = document.getElementById('profile-email-text');
    const elWa = document.getElementById('profile-wa-text');
    const elGreeting = document.getElementById('header-greeting');
    
    if(elName) elName.innerText = customerProfile.name;
    if(elEmail) elEmail.innerText = customerProfile.email;
    if(elWa) elWa.innerText = customerProfile.wa || "WA Belum Diatur";

    if(elGreeting) {
        const namaDepan = customerProfile.name.split(' ')[0];
        elGreeting.innerText = `Hai, ${namaDepan}! 👋`;
    }
}

function renderLiveTrackingCard() {
    if (!window.currentOrderData || !window.currentOrderData.tracking) return;
    let listStr = window.currentOrderData.tracking.map((t, index) => {
        const isLast = index === window.currentOrderData.tracking.length - 1;
        return `<div class="relative pl-6 pb-3 border-l-2 border-blue-100 last:border-0 last:pb-0"><div class="absolute -left-[5px] top-1 w-2 h-2 rounded-full ${isLast ? 'bg-blue-600 animate-ping' : 'bg-blue-400'}"></div><div class="absolute -left-[5px] top-1 w-2 h-2 rounded-full ${isLast ? 'bg-blue-600' : 'bg-blue-400'}"></div><p class="text-[9px] text-blue-400 font-bold mb-0.5">${t.time}</p><p class="text-[11px] font-bold text-gray-800">${t.status}</p></div>`;
    }).join('');
    const container = document.getElementById('live-tracking-container');
    if(container) container.innerHTML = `<div class="mt-4 pt-4 border-t border-gray-100"><h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Live Tracking</h4><div class="ml-1">${listStr}</div></div>`;
}

document.addEventListener("DOMContentLoaded", () => {
    initSupabaseData(); 
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

window.showModal = (id) => {
    const overlay = document.getElementById('backdrop-overlay');
    if(overlay) overlay.classList.remove('hidden');
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

window.handleLogout = async () => {
    if(confirm("Yakin ingin logout dari aplikasi?")) {
        localStorage.removeItem('mapel_customer_notif');
        await supabase.auth.signOut();
        window.location.href = './index.html'; 
    }
};

window.hubungiAdmin = () => {
    const text = encodeURIComponent("Halo Admin MapelExpress, saya butuh bantuan terkait layanan aplikasi nih.");
    window.open(`https://wa.me/${OFFICE.wa}?text=${text}`, '_blank');
};

window.kirimFeedback = () => {
    const text = encodeURIComponent("Halo Admin MapelExpress, saya punya kritik & saran buat aplikasi: \n\n");
    window.open(`https://wa.me/${OFFICE.wa}?text=${text}`, '_blank');
};

window.swapLokasi = () => {
    if (!pickupMarker || !targetDestMarker) return alert("Tentukan Titik Jemput dan Tujuan terlebih dahulu untuk ditukar!");

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
        const labelRute = document.getElementById('label-jarak-rute');
        if(labelRute) labelRute.innerText = `Jarak: ${hasil.jarakKm} KM`;
    });
};

function renderCustomerNotifs() {
    const list = document.getElementById('cust-notif-list');
    if(!list) return;
    list.innerHTML = '';
    if(customerNotifs.length === 0) {
        list.innerHTML = `<p class="text-center text-gray-400 font-bold mt-10">Belum ada riwayat</p>`; return;
    }
    customerNotifs.forEach(n => {
        if (n.type === 'system') {
            list.innerHTML += `<div class="bg-blue-50 p-5 rounded-3xl border border-blue-100 shadow-sm relative overflow-hidden"><div class="flex justify-between items-center mb-2"><div class="flex items-center gap-2"><div class="bg-blue-500 text-white p-1 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" /></svg></div><h4 class="font-black text-blue-800 text-sm">INFO SISTEM</h4></div><span class="text-[11px] font-bold text-blue-400">${n.time}</span></div><p class="font-bold text-gray-800 text-sm mb-1">${n.title}</p><p class="text-xs text-gray-600 leading-relaxed">${n.message}</p></div>`;
        } else if (n.type === 'cancel') {
            list.innerHTML += `<div class="bg-red-50 p-5 rounded-3xl border border-red-100 shadow-sm relative overflow-hidden"><div class="flex justify-between items-center mb-3"><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 bg-red-500 rounded-full"></span><h4 class="font-black text-red-700 text-sm">ORDER DIBATALKAN</h4></div><span class="text-[11px] font-bold text-red-400">${n.time}</span></div><p class="text-[11px] font-bold text-gray-700 mb-1">Tujuan: ${n.alamatTujuan}</p><p class="text-xs text-red-600 font-bold bg-white px-3 py-2 rounded-xl inline-block mt-2 shadow-sm">Alasan: ${n.reason || 'Dibatalkan oleh Admin/Kurir'}</p></div>`;
        } else {
            let trackingStr = '';
            if (n.tracking && n.tracking.length > 0) {
                trackingStr = `<div class="mt-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100"><p class="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-3">Riwayat Perjalanan</p>${n.tracking.map(t => `<p class="text-[11px] text-gray-800 font-bold mb-1.5"><span class="text-[9px] text-gray-500 mr-2">${t.time}</span><br/>${t.status}</p>`).join('')}</div>`;
            }
            list.innerHTML += `<div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden"><div class="flex justify-between items-center mb-4"><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 bg-green-500 rounded-full"></span><h4 class="font-black text-gray-800 text-sm">SELESAI DIANTAR</h4></div><span class="text-[11px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">${n.time}</span></div><div class="space-y-3 relative before:absolute before:inset-y-0 before:left-2.5 before:w-0.5 before:bg-gray-100 pl-8"><div class="relative"><div class="absolute -left-6 top-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-white"></div><p class="text-[10px] font-bold text-gray-400 uppercase">TITIK JEMPUT</p><p class="text-[12px] font-bold text-gray-800 mt-0.5 leading-tight">${n.alamatJemput}</p></div><div class="relative"><div class="absolute -left-6 top-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></div><p class="text-[10px] font-bold text-gray-400 uppercase">TUJUAN PENGIRIMAN</p><p class="text-[12px] font-bold text-gray-800 mt-0.5 leading-tight">${n.alamatTujuan}</p></div></div><div class="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between"><div class="flex items-center gap-2"><div class="bg-gray-100 p-1.5 rounded-lg text-gray-600"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm4.707 3.707a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 9H10a3 3 0 013 3v1a1 1 0 102 0v-1a5 5 0 00-5-5H8.414l1.293-1.293z" clip-rule="evenodd" /></svg></div><p class="text-xs font-black text-gray-700">${n.namaBarang}</p></div><p class="text-[11px] font-bold text-white bg-gray-800 px-3 py-1.5 rounded-full">${n.berat} KG</p></div>${trackingStr}</div>`;
        }
    });
}

function getEkspedisiLogo(nama) {
    if (!nama) return null;
    const n = nama.toLowerCase();
    if (n.includes('j&t') || n.includes('jnt')) return './assets/icons/j&t.png';
    if (n.includes('jne')) return './assets/icons/jne.png';
    if (n.includes('ninja')) return './assets/icons/ninja.png';
    if (n.includes('spx') || n.includes('shopee')) return './assets/icons/spx.png';
    if (n.includes('wahana')) return './assets/icons/wahana.png';
    if (n.includes('sicepat') || n.includes('si cepat')) return './assets/icons/sicepat.png';
    return null;
}

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

const blueDotIcon = L.divIcon({ className: 'bg-transparent border-0', html: `<div class="w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-[0_0_0_4px_rgba(59,130,246,0.3)]"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });

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

const btnMyLocation = document.getElementById('btn-my-location');
if(btnMyLocation) {
    btnMyLocation.onclick = () => {
        if (realGpsLatLng) {
            myMap.map.setView(realGpsLatLng, 17, { animate: true });
            getAddressFromCoords(realGpsLatLng.lat, realGpsLatLng.lng).then(alamat => document.getElementById('input-jemput').value = alamat);
        }
    };
}

function renderPinEkspedisi() {
    if (typeof window.ekspedisiList === 'undefined' || window.ekspedisiList.length === 0) return;
    window.ekspedisiList.forEach(eks => {
        const logoUrl = getEkspedisiLogo(eks.name);
        myMap.addMarker(
            eks.lat, eks.lng, 'ekspedisi', 
            `<div class="text-center font-sans"><p class="font-bold text-[13px] text-gray-800 mb-1">${eks.name}</p>
            <button onclick="window.buatRuteKeTujuan(${eks.lat}, ${eks.lng}, '${eks.name}')" class="bg-blue-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full w-full shadow-md">PILIH TUJUAN</button></div>`,
            logoUrl
        );
    });
}

window.bukaDaftarEkspedisi = () => {
    currentJenisLayanan = 'ekspedisi';
    const listContainer = document.getElementById('list-semua-ekspedisi');
    if(!listContainer) return;
    listContainer.innerHTML = '';
    
    if(!window.ekspedisiList || window.ekspedisiList.length === 0) {
        listContainer.innerHTML = `<p class="text-center text-xs text-gray-400 font-bold py-4">Belum ada ekspedisi tersedia.</p>`;
    } else {
        window.ekspedisiList.forEach(eks => {
            const logoUrl = getEkspedisiLogo(eks.name);
            listContainer.innerHTML += `
            <div onclick="window.buatRuteKeTujuan(${eks.lat}, ${eks.lng}, '${eks.name}')" class="bg-white border border-gray-100 p-3 rounded-2xl flex items-center gap-3 cursor-pointer active:bg-gray-50 mb-2">
                <div class="w-12 h-12 bg-gray-50 rounded-xl p-1.5 border border-gray-100 flex-shrink-0"><img src="${logoUrl}" class="w-full h-full object-contain"></div>
                <div class="flex-1"><p class="text-[13px] font-black">${eks.name}</p><p class="text-[10px] text-gray-400 font-bold uppercase">Mitra Terdaftar</p></div>
                <div class="bg-blue-50 text-blue-600 p-2 rounded-full"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clip-rule="evenodd" /></svg></div>
            </div>`;
        });
    }
    
    listContainer.classList.replace('hidden', 'flex'); listContainer.classList.add('flex-col');
    const bs = document.getElementById('bottom-sheet');
    if(bs) bs.style.transform = 'translateY(0)'; 
    isSheetOpen = true;
};

window.buatRuteKeTujuan = (targetLat, targetLng, namaTujuan) => {
    myMap.map.closePopup();
    
    if (!pickupMarker) {
        if (!realGpsLatLng) return alert("Tunggu GPS kelock dulu bro!");
        pickupMarker = myMap.addMarker(realGpsLatLng.lat, realGpsLatLng.lng, 'jemput', 'Lokasi Jemput Barang');
        getAddressFromCoords(realGpsLatLng.lat, realGpsLatLng.lng).then(alamat => {
            const inj = document.getElementById('input-jemput');
            if(inj) inj.value = alamat;
        });
    }
    
    const intuj = document.getElementById('input-tujuan');
    if(intuj) intuj.value = namaTujuan;
    
    const labelTujuanForm = document.getElementById('label-tujuan-form');
    if(labelTujuanForm) {
        labelTujuanForm.innerText = namaTujuan;
        labelTujuanForm.previousElementSibling.innerText = currentJenisLayanan === 'ekspedisi' ? 'TUJUAN EKSPEDISI' : 'TUJUAN PERSONAL';
    }
    
    if(targetDestMarker) myMap.map.removeLayer(targetDestMarker);
    const logoUrl = currentJenisLayanan === 'ekspedisi' ? getEkspedisiLogo(namaTujuan) : null;
    const iconType = currentJenisLayanan === 'ekspedisi' ? 'ekspedisi' : 'tujuan_personal';
    
    targetDestMarker = myMap.addMarker(targetLat, targetLng, iconType, `<b>${namaTujuan}</b>`, logoUrl);
    
    const pickupPos = pickupMarker.getLatLng();
    myMap.drawRoute([{ lat: pickupPos.lat, lng: pickupPos.lng }, { lat: targetLat, lng: targetLng }], (hasil) => {
        const labelRute = document.getElementById('label-jarak-rute');
        if(labelRute) labelRute.innerText = `Jarak: ${hasil.jarakKm} KM`;
        
        const sectionPilih = document.getElementById('section-pilih-ekspedisi');
        const sectionForm = document.getElementById('section-form-order');
        if(sectionPilih) sectionPilih.classList.add('hidden');
        if(sectionForm) sectionForm.classList.remove('hidden');
        
        const btnPesan = document.getElementById('btn-pesan-kurir');
        if(btnPesan) {
            btnPesan.disabled = false;
            btnPesan.className = "w-full bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-transform flex justify-center items-center gap-2 cursor-pointer pointer-events-auto";
        }
    });
    
    const bs = document.getElementById('bottom-sheet');
    if(bs) bs.style.transform = 'translateY(0)'; 
    isSheetOpen = true;
};

window.batalPilihEkspedisi = () => {
    const sfo = document.getElementById('section-form-order');
    const spe = document.getElementById('section-pilih-ekspedisi');
    const lse = document.getElementById('list-semua-ekspedisi');
    const itj = document.getElementById('input-tujuan');

    if(sfo) sfo.classList.add('hidden');
    if(spe) spe.classList.remove('hidden');
    if(lse) lse.classList.add('hidden');
    if(itj) itj.value = "";

    if(targetDestMarker) myMap.map.removeLayer(targetDestMarker);
    if(myMap.routingControl) myMap.map.removeControl(myMap.routingControl);
};

let pickingMode = null; 
const btnPickJpt = document.getElementById('btn-pick-jemput');
const btnPickTjn = document.getElementById('btn-pick-tujuan');
if(btnPickJpt) btnPickJpt.onclick = () => { pickingMode = 'jemput'; enterPickingMode("Set Lokasi Jemput", "blue"); };
if(btnPickTjn) btnPickTjn.onclick = () => { pickingMode = 'tujuan'; currentJenisLayanan = 'personal'; enterPickingMode("Set Tujuan Personal", "red"); };

function enterPickingMode(btnText, color) {
    pickingMode = currentJenisLayanan === 'personal' && btnText.includes('Tujuan') ? 'tujuan' : 'jemput';
    
    const bs = document.getElementById('bottom-sheet');
    if(bs) bs.style.transform = 'translateY(150%)'; 
    
    const hexColor = color === 'blue' ? '#2563EB' : '#DC2626';
    const pinBg = document.getElementById('pin-bg');
    if(pinBg) pinBg.setAttribute('fill', hexColor);
    document.querySelectorAll('#svg-pin-overlay path[stroke]').forEach(p => p.setAttribute('stroke', hexColor));

    if(pickupMarker && pickingMode === 'jemput') myMap.map.removeLayer(pickupMarker);
    if(targetDestMarker && pickingMode === 'tujuan') myMap.map.removeLayer(targetDestMarker);

    const dotLoc = document.getElementById('set-lokasi-dot');
    if(dotLoc) dotLoc.className = `absolute -top-1 -right-1 w-3 h-3 rounded-full bg-${color}-500 shadow-lg border-2 border-white animate-pulse`;
    
    const overlay = document.getElementById('center-pin-overlay');
    const cardLoc = document.getElementById('set-lokasi-card');
    const btnSet = document.getElementById('btn-set-lokasi');
    const titleLoc = document.getElementById('set-lokasi-title');
    
    if(overlay) overlay.classList.remove('hidden');
    if(cardLoc) {
        cardLoc.classList.remove('hidden');
        setTimeout(() => { cardLoc.classList.remove('opacity-0'); }, 50);
    }
    if(btnSet) btnSet.innerText = btnText;
    if(titleLoc) titleLoc.innerText = "Mencari lokasi...";
    
    const center = myMap.map.getCenter();
    getAddressFromCoords(center.lat, center.lng).then(alamat => {
        if(pickingMode && titleLoc) {
            titleLoc.innerText = alamat;
            if(dotLoc) dotLoc.classList.remove('animate-pulse');
        }
    });
}

myMap.map.on('moveend', function() {
    if(pickingMode) {
        const center = myMap.map.getCenter();
        const titleLoc = document.getElementById('set-lokasi-title');
        const dotLoc = document.getElementById('set-lokasi-dot');
        
        if(titleLoc) titleLoc.innerText = "Mencari lokasi...";
        if(dotLoc) dotLoc.classList.add('animate-pulse');
        
        clearTimeout(reverseGeocodeTimer);
        reverseGeocodeTimer = setTimeout(() => {
            getAddressFromCoords(center.lat, center.lng).then(alamat => {
                if (pickingMode) {
                    if(titleLoc) titleLoc.innerText = alamat;
                    if(dotLoc) dotLoc.classList.remove('animate-pulse');
                }
            });
        }, 800); 
    }
});

const btnSetLoc = document.getElementById('btn-set-lokasi');
if(btnSetLoc) {
    btnSetLoc.onclick = async () => {
        const btn = document.getElementById('btn-set-lokasi');
        const originalText = btn.innerText;
        btn.innerText = "Memproses...";
        btn.disabled = true;

        const center = myMap.map.getCenter();
        const titleLoc = document.getElementById('set-lokasi-title');
        let alamat = titleLoc ? titleLoc.innerText : '';
        
        if (alamat === "Geser peta untuk menentukan titik" || alamat === "Mencari lokasi...") {
            alamat = await getAddressFromCoords(center.lat, center.lng);
        }
        
        if (pickingMode === 'jemput') {
            const inJemput = document.getElementById('input-jemput');
            if(inJemput) inJemput.value = alamat;
            if (!pickupMarker) pickupMarker = myMap.addMarker(center.lat, center.lng, 'jemput', 'Lokasi Jemput Barang');
            else pickupMarker.setLatLng(center); 
        } else if (pickingMode === 'tujuan') { 
            window.buatRuteKeTujuan(center.lat, center.lng, alamat); 
        }
        
        window.exitPickingMode();
        btn.innerText = originalText;
        btn.disabled = false;
    };
}

window.exitPickingMode = function() {
    pickingMode = null;
    const cardLoc = document.getElementById('set-lokasi-card');
    const overlay = document.getElementById('center-pin-overlay');
    const bs = document.getElementById('bottom-sheet');
    
    if(cardLoc) cardLoc.classList.add('opacity-0'); 
    if(overlay) overlay.classList.add('hidden');
    setTimeout(() => { 
        if(cardLoc) cardLoc.classList.add('hidden'); 
        if(bs) bs.style.transform = 'translateY(calc(100% - 35px))'; 
        isSheetOpen = false; 
    }, 300);
}

const btnPesanKurir = document.getElementById('btn-pesan-kurir');
if(btnPesanKurir) {
    btnPesanKurir.onclick = async () => {
        if (!pickupMarker || !targetDestMarker) return alert("Titik belum lengkap!");
        if (!customerProfile) return alert("Tunggu sistem sync profil kamu ya!");
        
        const fnNama = document.getElementById('form-nama');
        const fnBerat = document.getElementById('form-berat');
        
        const orderData = {
            id: "ORD-" + Math.floor(Math.random() * 90000),
            customerId: customerProfile.id,
            jenisLayanan: currentJenisLayanan,
            namaBarang: fnNama ? fnNama.value : "Paket",
            berat: fnBerat ? fnBerat.value : 1,
            alamatJemput: document.getElementById('input-jemput').value,
            jemputLat: pickupMarker.getLatLng().lat, jemputLng: pickupMarker.getLatLng().lng,
            alamatTujuan: document.getElementById('input-tujuan').value,
            tujuanLat: targetDestMarker.getLatLng().lat, tujuanLng: targetDestMarker.getLatLng().lng,
            tracking: [{ time: getWaktuSekarang(), status: 'Pesanan Dibuat, Mencari Driver...' }]
        };
        
        window.currentOrderData = orderData;
        
        const btn = document.getElementById('btn-pesan-kurir');
        btn.innerText = "Mencari Driver...";
        btn.className = "w-full bg-gray-800 text-white font-bold py-4 rounded-2xl pointer-events-none animate-pulse flex justify-center items-center gap-2";
        
        // PUSH KE SUPABASE
        const { error } = await supabase.from('orders').insert([{ id: orderData.id, status: 'pending', data: orderData }]);

        if(error) {
            alert("Gagal mengirim pesanan: " + error.message);
            btn.innerHTML = `Pesan Kurir Sekarang <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>`;
            btn.className = "w-full bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg active:scale-95 transition-transform flex justify-center items-center gap-2 cursor-pointer pointer-events-auto";
        }
    };
}

const sheetHandle = document.getElementById('sheet-handle');
let isSheetOpen = true;
if(sheetHandle) {
    sheetHandle.onclick = () => {
        if (pickingMode) return; 
        const bs = document.getElementById('bottom-sheet');
        if(bs) {
            if (isSheetOpen) bs.style.transform = 'translateY(calc(100% - 35px))'; 
            else bs.style.transform = 'translateY(0)'; 
            isSheetOpen = !isSheetOpen;
        }
    };
}
