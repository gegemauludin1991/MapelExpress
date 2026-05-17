/**
 * MAIN APP CONTROLLER - SISI CUSTOMER
 * (Fix Bug Teks Alamat Jemput Ngaco - Stabil Tanpa Merusak Map)
 */

const OFFICE = { lat: -6.977414, lng: 107.555359, wa: "6281234567890", alamat: "Jl. Raya Margaasih, Kab. Bandung" };
const myMap = new DynamicMap('map', OFFICE.lat, OFFICE.lng, 14);

myMap.map.removeLayer(myMap.driverMarker);

const officeIcon = L.icon({ 
    iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] 
});

L.marker([OFFICE.lat, OFFICE.lng], { icon: officeIcon }).addTo(myMap.map).bindPopup(`
    <div class="font-sans text-center w-48 whitespace-normal">
        <h3 class="font-bold text-blue-800 text-[13px] border-b border-gray-200 pb-1 mb-1">MapelExpress</h3>
        <p class="text-[10px] text-gray-600 leading-tight">Komplek CCM No 105, Desa Mekarrahayu, Kec Margaasih, Kab Bandung</p>
    </div>
`);

const socket = io();

function getWaktuSekarang() {
    const now = new Date();
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${now.getDate()} ${bulan[now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

const kurirIcon = L.icon({
    iconUrl: '/assets/icons/kurir.png', iconSize: [40, 40], iconAnchor: [20, 20] 
});

let liveDriverMarker = null; 
let isOrderActive = false; 
let currentJenisLayanan = 'personal'; 

let customerNotifs = JSON.parse(localStorage.getItem('mapel_customer_notif')) || [];
let customerProfile = JSON.parse(localStorage.getItem('mapel_customer_profile')) || {
    name: "Gungun M", email: "gungun@example.com", wa: "081234567890"
};

if(customerNotifs.length === 0) {
    customerNotifs.push({
        type: 'system', title: 'Selamat Datang di MapelExpress! 🎉',
        message: 'Aplikasi siap digunakan. Bebas pusing, kurir kami yang jemput dan antar paketmu ke ekspedisi manapun.',
        time: new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0')
    });
    localStorage.setItem('mapel_customer_notif', JSON.stringify(customerNotifs));
}

function renderLiveTrackingCard() {
    if (!window.currentOrderData || !window.currentOrderData.tracking) return;
    
    let listStr = window.currentOrderData.tracking.map((t, index) => {
        const isLast = index === window.currentOrderData.tracking.length - 1;
        return `
            <div class="relative pl-6 pb-3 border-l-2 border-blue-100 last:border-0 last:pb-0">
                <div class="absolute -left-[5px] top-1 w-2 h-2 rounded-full ${isLast ? 'bg-blue-600 animate-ping' : 'bg-blue-400'}"></div>
                <div class="absolute -left-[5px] top-1 w-2 h-2 rounded-full ${isLast ? 'bg-blue-600' : 'bg-blue-400'}"></div>
                <p class="text-[9px] text-blue-400 font-bold mb-0.5">${t.time}</p>
                <p class="text-[11px] font-bold text-gray-800">${t.status}</p>
            </div>
        `;
    }).join('');

    const container = document.getElementById('live-tracking-container');
    if(container) {
        container.innerHTML = `
            <div class="mt-4 pt-4 border-t border-gray-100">
                <h4 class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Live Tracking</h4>
                <div class="ml-1">${listStr}</div>
            </div>
        `;
    }
}

socket.on('update_driver_map', (data) => {
    if (!isOrderActive) return; 
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
});

document.addEventListener("DOMContentLoaded", () => {
    window.ekspedisiList = JSON.parse(localStorage.getItem('mapel_ekspedisi')) || [];
    renderPinEkspedisi();

    document.getElementById('profile-name-text').innerText = customerProfile.name;
    document.getElementById('profile-email-text').innerText = customerProfile.email;
    document.getElementById('profile-wa-text').innerText = customerProfile.wa;

    const namaDepan = customerProfile.name.split(' ')[0];
    document.getElementById('header-greeting').innerText = `Hai, ${namaDepan}! 👋`;

    const btnNotif = document.getElementById('btn-notif-customer');
    const btnProfile = document.getElementById('btn-profile');

    if (btnNotif) {
        btnNotif.onclick = () => {
            renderCustomerNotifs();
            window.showModal('modal-cust-notif');
            document.getElementById('cust-notif-dot').classList.add('hidden');
        };
    }
    if (btnProfile) btnProfile.onclick = () => window.showModal('modal-cust-profile');
});

window.showModal = (id) => {
    document.getElementById('backdrop-overlay').classList.remove('hidden');
    setTimeout(() => { 
        const el = document.getElementById(id);
        if(id === 'modal-cust-profile') el.classList.remove('translate-x-full');
        else el.classList.remove('translate-y-full'); 
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

window.handleLogout = () => {
    if(confirm("Yakin ingin logout dari aplikasi?")) {
        localStorage.removeItem('mapel_customer_notif');
        localStorage.removeItem('mapel_customer_profile'); 
        alert("Logout Berhasil!"); location.reload();
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
    if (!pickupMarker || !targetDestMarker) {
        return alert("Tentukan Titik Jemput dan Tujuan terlebih dahulu untuk ditukar!");
    }

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
    });
};

function renderCustomerNotifs() {
    const list = document.getElementById('cust-notif-list');
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
                trackingStr = `<div class="mt-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                    <p class="text-[9px] font-bold text-blue-500 uppercase tracking-widest mb-3">Riwayat Perjalanan</p>
                    ${n.tracking.map(t => `<p class="text-[11px] text-gray-800 font-bold mb-1.5"><span class="text-[9px] text-gray-500 mr-2">${t.time}</span><br/>${t.status}</p>`).join('')}
                </div>`;
            }

            let photoHtml = '';
            if (n.photoDropoff || n.photoPickup) {
                photoHtml = `
                    <div class="mt-4 bg-gray-50 p-3 rounded-2xl border border-gray-100">
                        <p class="text-[9px] font-bold text-gray-400 uppercase mb-2 tracking-wider">Bukti Pengiriman</p>
                        <div class="flex gap-2 overflow-x-auto scrollbar-hide">
                            ${n.photoPickup ? `<div class="w-16 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 relative"><img src="${n.photoPickup}" class="w-full h-full object-cover"><div class="absolute bottom-0 w-full bg-black/60 text-[7px] text-white text-center">Jemput</div></div>` : ''}
                            ${n.photoDropoff ? `<div class="w-16 h-20 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 relative"><img src="${n.photoDropoff}" class="w-full h-full object-cover"><div class="absolute bottom-0 w-full bg-black/60 text-[7px] text-white text-center">Tujuan</div></div>` : ''}
                        </div>
                    </div>
                `;
            }

            list.innerHTML += `<div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm relative overflow-hidden"><div class="flex justify-between items-center mb-4"><div class="flex items-center gap-2"><span class="w-2.5 h-2.5 bg-green-500 rounded-full"></span><h4 class="font-black text-gray-800 text-sm">SELESAI DIANTAR</h4></div><span class="text-[11px] font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-md">${n.time}</span></div><div class="space-y-3 relative before:absolute before:inset-y-0 before:left-2.5 before:w-0.5 before:bg-gray-100 pl-8"><div class="relative"><div class="absolute -left-6 top-1 w-2 h-2 bg-blue-500 rounded-full border-2 border-white"></div><p class="text-[10px] font-bold text-gray-400 uppercase">TITIK JEMPUT</p><p class="text-[12px] font-bold text-gray-800 mt-0.5 leading-tight">${n.alamatJemput}</p></div><div class="relative"><div class="absolute -left-6 top-1 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></div><p class="text-[10px] font-bold text-gray-400 uppercase">TUJUAN PENGIRIMAN</p><p class="text-[12px] font-bold text-gray-800 mt-0.5 leading-tight">${n.alamatTujuan}</p></div></div><div class="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between"><div class="flex items-center gap-2"><div class="bg-gray-100 p-1.5 rounded-lg text-gray-600"><svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm4.707 3.707a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L8.414 9H10a3 3 0 013 3v1a1 1 0 102 0v-1a5 5 0 00-5-5H8.414l1.293-1.293z" clip-rule="evenodd" /></svg></div><p class="text-xs font-black text-gray-700">${n.namaBarang}</p></div><p class="text-[11px] font-bold text-white bg-gray-800 px-3 py-1.5 rounded-full">${n.berat} KG</p></div>${trackingStr}${photoHtml}</div>`;
        }
    });
}

function getEkspedisiLogo(nama) {
    if (!nama) return null;
    const n = nama.toLowerCase();
    if (n.includes('j&t') || n.includes('jnt')) return '/assets/icons/j&t.png';
    if (n.includes('jne')) return '/assets/icons/jne.png';
    if (n.includes('ninja')) return '/assets/icons/ninja.png';
    if (n.includes('spx') || n.includes('shopee')) return '/assets/icons/spx.png';
    if (n.includes('wahana')) return '/assets/icons/wahana.png';
    if (n.includes('sicepat') || n.includes('si cepat')) return '/assets/icons/sicepat.png';
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
    
    if (!realGpsMarker) {
        realGpsMarker = L.marker(e.latlng, { icon: blueDotIcon, zIndexOffset: 1000 }).addTo(myMap.map);
    } else {
        realGpsMarker.setLatLng(e.latlng);
    }

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

window.cariEkspedisiCepat = (brandName) => {
    currentJenisLayanan = 'ekspedisi';
    if (!window.ekspedisiList || window.ekspedisiList.length === 0) return alert("Belum ada ekspedisi!");
    const target = window.ekspedisiList.find(e => e.name.toUpperCase().includes(brandName.toUpperCase()));
    if (target) window.buatRuteKeTujuan(target.lat, target.lng, target.name);
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
    document.getElementById('bottom-sheet').style.transform = 'translateY(0)'; 
    isSheetOpen = true;
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
        document.getElementById('section-pilih-ekspedisi').classList.add('hidden');
        document.getElementById('section-form-order').classList.remove('hidden');
        const btnPesan = document.getElementById('btn-pesan-kurir');
        btnPesan.disabled = false;
        btnPesan.className = "bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl flex items-center justify-center pointer-events-auto cursor-pointer shadow-lg active:scale-95 transition-transform";
    });
    
    document.getElementById('bottom-sheet').style.transform = 'translateY(0)'; 
    isSheetOpen = true;
};

window.batalPilihEkspedisi = () => {
    document.getElementById('section-form-order').classList.add('hidden');
    document.getElementById('section-pilih-ekspedisi').classList.remove('hidden');
    document.getElementById('list-semua-ekspedisi').classList.add('hidden');
    document.getElementById('input-tujuan').value = "";
    if(targetDestMarker) myMap.map.removeLayer(targetDestMarker);
    if(myMap.routingControl) myMap.map.removeControl(myMap.routingControl);
};

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

// FIX BUG ALAMAT NGACO: Cuma ini yang gue benerin di fungsi ini biar map ga blank!
document.getElementById('btn-set-lokasi').onclick = async () => {
    const btn = document.getElementById('btn-set-lokasi');
    const originalText = btn.innerText;
    btn.innerText = "Memproses...";
    btn.disabled = true;

    const center = myMap.map.getCenter();
    let alamat = document.getElementById('set-lokasi-title').innerText;
    
    // Gembok Anti Ngaco: Pastiin bukan text loading
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

window.exitPickingMode = function() {
    pickingMode = null;
    document.getElementById('set-lokasi-card').classList.add('opacity-0'); 
    document.getElementById('center-pin-overlay').classList.add('hidden');
    setTimeout(() => { 
        document.getElementById('set-lokasi-card').classList.add('hidden'); 
        document.getElementById('bottom-sheet').style.transform = 'translateY(calc(100% - 35px))'; 
        isSheetOpen = false; 
    }, 300);
}

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

socket.on('order_status_changed', (data) => {
    const labelStatus = document.getElementById('status-jemput-teks');
    
    if (data.status === 'picked_up' && labelStatus) {
        const textLayanan = window.currentOrderData.jenisLayanan === 'ekspedisi' ? "EKSPEDISI" : "TUJUAN";
        labelStatus.innerText = `KURIR MENUJU ${textLayanan}`;
        labelStatus.classList.replace('text-blue-600', 'text-orange-500');
        
        window.currentOrderData.tracking.push({ time: getWaktuSekarang(), status: 'Barang telah diambil. Menuju lokasi tujuan.' });
        if(data.photoBase64) window.currentOrderData.photoPickup = data.photoBase64;
        renderLiveTrackingCard();

    } else if (data.status === 'completed') {
        const now = new Date();
        window.currentOrderData.tracking.push({ time: getWaktuSekarang(), status: 'Paket telah sampai di tujuan.' });
        if(data.photoBase64) window.currentOrderData.photoDropoff = data.photoBase64;
        
        customerNotifs.unshift({ 
            type: 'completed',
            title: "Paket Selesai Diantar", 
            time: `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`, 
            ...window.currentOrderData 
        });
        localStorage.setItem('mapel_customer_notif', JSON.stringify(customerNotifs));
        
        document.getElementById('cust-notif-dot').classList.remove('hidden');

        if (liveDriverMarker) {
            myMap.map.removeLayer(liveDriverMarker);
            liveDriverMarker = null;
        }
        isOrderActive = false;

        const imgTujuanHtml = data.photoBase64 ? `<img src="${data.photoBase64}" class="w-full h-32 object-cover rounded-xl mt-3 mb-2 shadow-sm border border-gray-200" />` : '';

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
});

socket.on('order_accepted_by_driver', (driverData) => {
    isOrderActive = true; 
    
    window.currentOrderData.tracking.push({ time: getWaktuSekarang(), status: 'Driver Menuju Lokasi Penjemputan.' });

    if (!liveDriverMarker && driverData.lat && driverData.lng) {
        liveDriverMarker = L.marker([driverData.lat, driverData.lng], {
            icon: kurirIcon, zIndexOffset: 99999
        }).addTo(myMap.map);
    }

    document.getElementById('section-form-order').innerHTML = `
        <div class="bg-white border p-5 rounded-3xl mb-3 shadow-lg">
            <p id="status-jemput-teks" class="text-[11px] font-black text-blue-600 uppercase mb-3">Kurir Menuju Lokasi Jemput</p>
            <div class="flex items-center gap-4">
                <img src="${driverData.photo}" class="w-14 h-14 rounded-full border object-cover">
                <div class="flex-1">
                    <h4 class="font-black text-gray-800">${driverData.name}</h4>
                    <p class="text-xs text-gray-500 font-bold">${driverData.nopol}</p>
                </div>
            </div>
            <a href="https://wa.me/${driverData.wa}" target="_blank" class="mt-4 flex items-center justify-center gap-2 w-full bg-[#25D366] text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-transform shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" /></svg> Hubungi Driver
            </a>
            <div id="live-tracking-container"></div>
        </div>
    `;
    
    renderLiveTrackingCard();
    
    const btnPesan = document.getElementById('btn-pesan-kurir');
    if (btnPesan && btnPesan.parentElement) {
        btnPesan.parentElement.classList.add('hidden');
    }
});

const sheetHandle = document.getElementById('sheet-handle');
let isSheetOpen = true;
sheetHandle.onclick = () => {
    if (pickingMode) return; 
    const bs = document.getElementById('bottom-sheet');
    
    if (isSheetOpen) {
        bs.style.transform = 'translateY(calc(100% - 35px))'; 
    } else {
        bs.style.transform = 'translateY(0)'; 
    }
    isSheetOpen = !isSheetOpen;
};
