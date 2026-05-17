/**
 * MAIN APP CONTROLLER - SISI KURIR / DRIVER
 * (Fix: Menampilkan Pin Ekspedisi dari DB Admin ke Map Driver)
 */

const OFFICE = { lat: -6.977414, lng: 107.555359 };
const myMap = new DynamicMap('map', OFFICE.lat, OFFICE.lng, 15);

const officeIcon = L.icon({
    iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] 
});
L.marker([OFFICE.lat, OFFICE.lng], { icon: officeIcon }).addTo(myMap.map)
    .bindPopup("<div class='font-bold text-center text-blue-800 text-xs'>Pusat Operasional<br>MapelExpress</div>");

const socket = io();

function getWaktuSekarang() {
    const now = new Date();
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    return `${now.getDate()} ${bulan[now.getMonth()]} ${now.getFullYear()}, ${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`;
}

let driverStats = JSON.parse(localStorage.getItem('mapel_driver_stats')) || { saldo: 0, totalOrder: 0 };
let driverProfile = JSON.parse(localStorage.getItem('mapel_driver_profile')) || {
    id: "MAPEL-" + Math.floor(1000 + Math.random() * 9000), 
    name: "Driver Mapel", role: "Kurir Reguler", wa: "08123456789", nopol: "D 1234 ABC", kendaraan: "Motor", warna: "Hitam", photo: "/assets/icons/kurir.png" 
};
let notifications = JSON.parse(localStorage.getItem('mapel_driver_notif')) || [];

// FIX ICON J&T & Wahana
function getEkspedisiLogo(nama) {
    if (!nama) return '/assets/icons/kurir.png';
    const n = nama.toLowerCase();
    if (n.includes('j&t') || n.includes('jnt')) return '/assets/icons/j&t.png'; // Fix J&T
    if (n.includes('jne')) return '/assets/icons/jne.png';
    if (n.includes('ninja')) return '/assets/icons/ninja.png';
    if (n.includes('spx') || n.includes('shopee')) return '/assets/icons/spx.png';
    if (n.includes('wahana')) return '/assets/icons/wahana.png'; // Fix Wahana
    if (n.includes('sicepat') || n.includes('si cepat')) return '/assets/icons/sicepat.png';
    return '/assets/icons/kurir.png'; 
}

// FIX: Tarik data titik ekspedisi buatan admin ke map Driver
let adminEkspedisiList = JSON.parse(localStorage.getItem('mapel_ekspedisi')) || [];
function renderPinEkspedisiDiDriver() {
    adminEkspedisiList.forEach(eks => {
        const logoUrl = getEkspedisiLogo(eks.name);
        myMap.addMarker(
            eks.lat, eks.lng, 'ekspedisi', 
            `<div class="text-center font-sans font-bold text-gray-800 text-xs">${eks.name}</div>`,
            logoUrl
        );
    });
}

function renderDashboard() {
    const dashName = document.getElementById('dash-name');
    const dashId = document.getElementById('dash-id');
    const dashPhoto = document.getElementById('dash-photo');
    if(dashName) dashName.innerText = driverProfile.name;
    if(dashId) dashId.innerText = `ID: ${driverProfile.id}`;
    if(dashPhoto) dashPhoto.src = driverProfile.photo;
    
    const elSaldo = document.querySelector('.text-3xl.font-black.text-gray-900');
    if(elSaldo) elSaldo.innerText = `Rp ${driverStats.saldo.toLocaleString('id-ID')}`;
    const elOrderStats = document.querySelectorAll('.text-2xl.font-black.text-gray-800')[1];
    if(elOrderStats) elOrderStats.innerText = driverStats.totalOrder;

    const lastOrderContainer = document.getElementById('last-order-container');
    if(!lastOrderContainer) return;
    
    const completedOrders = notifications.filter(n => n.status === 'completed');
    
    if (completedOrders.length === 0) {
        lastOrderContainer.innerHTML = `<div id="last-order-empty" class="bg-white rounded-xl border border-dashed border-gray-300 p-8 text-center"><p class="text-[11px] text-gray-400 font-bold uppercase tracking-widest">Belum ada riwayat order</p></div>`;
        return;
    }

    let historyHTML = '';
    completedOrders.forEach(o => {
        let timeline = '';
        if (o.tracking && o.tracking.length > 0) {
            timeline = o.tracking.map((t, index) => {
                const isLast = index === o.tracking.length - 1;
                return `
                    <div class="relative pl-5 pb-3 border-l-2 border-blue-100 last:border-0 last:pb-0">
                        <div class="absolute -left-[5px] top-1 w-2 h-2 rounded-full ${isLast ? 'bg-blue-600' : 'bg-blue-400'}"></div>
                        <p class="text-[9px] text-blue-400 font-bold mb-0.5">${t.time}</p>
                        <p class="text-[11px] font-bold text-gray-800">${t.status}</p>
                    </div>
                `;
            }).join('');
        }

        let photos = '';
        if (o.photoPickup || o.photoDropoff) {
            photos = `<div class="flex gap-2 mt-3 pt-3 border-t border-gray-100 overflow-x-auto">`;
            if (o.photoPickup) photos += `<div class="w-16 h-20 rounded-md overflow-hidden border border-gray-200 flex-shrink-0 relative"><img src="${o.photoPickup}" class="w-full h-full object-cover"><div class="absolute bottom-0 w-full bg-black/60 text-[8px] text-white text-center py-0.5">Jemput</div></div>`;
            if (o.photoDropoff) photos += `<div class="w-16 h-20 rounded-md overflow-hidden border border-gray-200 flex-shrink-0 relative"><img src="${o.photoDropoff}" class="w-full h-full object-cover"><div class="absolute bottom-0 w-full bg-black/60 text-[8px] text-white text-center py-0.5">Tujuan</div></div>`;
            photos += `</div>`;
        }

        historyHTML += `
            <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm relative overflow-hidden mb-3">
                <div class="absolute right-0 top-0 bg-green-500 text-white text-[9px] font-bold px-3 py-1 rounded-bl-xl">SELESAI</div>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Order: ${o.id}</p>
                <div class="ml-1">${timeline}</div>
                ${photos}
            </div>
        `;
    });
    
    lastOrderContainer.innerHTML = historyHTML;
}

function renderNotifications() {
    const list = document.getElementById('notif-list');
    if(!list) return;
    list.innerHTML = '';
    
    if (notifications.length === 0) {
        list.innerHTML = `<div class="flex flex-col items-center justify-center mt-20 opacity-50"><p class="text-xs font-bold text-gray-500">Belum ada order masuk.</p></div>`;
        return;
    }

    notifications.forEach(n => {
        const isPending = n.status === 'pending';
        const logoUrl = getEkspedisiLogo(n.alamatTujuan); 
        
        list.innerHTML += `
            <div onclick="window.bukaDetailOrder('${n.id}')" class="bg-white p-4 rounded-2xl border ${isPending ? 'border-blue-400 shadow-md cursor-pointer active:scale-95 transition-transform' : 'border-gray-100 opacity-60'} mb-3">
                <div class="flex justify-between items-start mb-2 border-b border-gray-50 pb-2">
                    <div class="flex items-center gap-2">
                        <span class="flex h-3 w-3 relative">
                          ${isPending ? `<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>` : ''}
                          <span class="relative inline-flex rounded-full h-3 w-3 ${isPending ? 'bg-blue-500' : 'bg-green-500'}"></span>
                        </span>
                        <h4 class="font-black ${isPending ? 'text-blue-600' : 'text-gray-800'} text-[13px] uppercase">${isPending ? 'Order Tersedia' : 'Order Selesai'}</h4>
                    </div>
                    <span class="text-[9px] text-gray-400 font-bold uppercase">${n.waktuMasuk}</span>
                </div>
                
                <div class="flex gap-3 items-center">
                    <div class="w-12 h-12 bg-gray-50 rounded-xl border border-gray-100 p-1.5 flex-shrink-0 flex items-center justify-center">
                        <img src="${logoUrl}" class="w-full h-full object-contain">
                    </div>
                    <div class="flex-1 overflow-hidden">
                        <p class="text-[11px] font-bold text-gray-800 truncate mb-1">📦 ${n.berat} KG - ${n.namaBarang}</p>
                        <p class="text-[10px] text-gray-500 truncate mb-0.5"><span class="font-bold text-gray-700">Jemput:</span> ${n.alamatJemput}</p>
                        <p class="text-[10px] text-gray-500 truncate"><span class="font-bold text-blue-600">Tujuan:</span> ${n.alamatTujuan}</p>
                    </div>
                </div>
            </div>
        `;
    });
}

window.bukaDetailOrder = (orderId) => {
    const order = notifications.find(n => n.id === orderId);
    if (!order) return;

    const custName = "Customer " + order.id.substring(order.id.length - 4);
    const custWa = "0812XXXXXXXX";
    const logoUrl = getEkspedisiLogo(order.alamatTujuan);

    let actionButton = '';
    if (order.status === 'pending') {
        actionButton = `
            <div class="flex gap-2 mt-5">
                <button onclick="window.tolakDariNotif('${order.id}')" class="w-1/3 bg-red-50 text-red-600 font-bold py-3.5 rounded-xl active:bg-red-100">TOLAK</button>
                <button onclick="window.terimaDariNotif('${order.id}')" class="w-2/3 bg-blue-600 active:bg-blue-800 text-white font-black py-3.5 rounded-xl shadow-lg">AMBIL ORDER</button>
            </div>
        `;
    } else {
        actionButton = `<button disabled class="w-full mt-5 bg-gray-200 text-gray-500 font-black py-3.5 rounded-xl cursor-not-allowed">ORDER SUDAH SELESAI</button>`;
    }

    let historyHtml = '';
    let photoHtml = '';
    if (order.tracking && order.tracking.length > 0) {
        let listStr = order.tracking.map(t => `
            <div class="relative pl-6 pb-4 border-l-2 border-blue-100 last:border-0 last:pb-0">
                <div class="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-500"></div>
                <p class="text-[10px] text-blue-400 font-bold mb-0.5">${t.time}</p>
                <p class="text-[12px] font-bold text-gray-800">${t.status}</p>
            </div>
        `).join('');

        historyHtml = `
            <div class="mt-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <h4 class="text-[10px] font-bold text-blue-600 uppercase mb-3 tracking-widest">Riwayat Perjalanan</h4>
                <div class="ml-2">${listStr}</div>
            </div>
        `;

        if (order.photoPickup || order.photoDropoff) {
            photoHtml = `
                <div class="mt-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                    <h4 class="text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-widest">Bukti Pengiriman</h4>
                    <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        ${order.photoPickup ? `<div class="flex-shrink-0 w-24 h-32 rounded-lg overflow-hidden border border-gray-200 shadow-sm relative"><img src="${order.photoPickup}" class="w-full h-full object-cover"><div class="absolute bottom-0 w-full bg-black/50 text-[8px] text-white text-center py-1">Jemput</div></div>` : ''}
                        ${order.photoDropoff ? `<div class="flex-shrink-0 w-24 h-32 rounded-lg overflow-hidden border border-gray-200 shadow-sm relative"><img src="${order.photoDropoff}" class="w-full h-full object-cover"><div class="absolute bottom-0 w-full bg-black/50 text-[8px] text-white text-center py-1">Tujuan</div></div>` : ''}
                    </div>
                </div>
            `;
        }
    }

    const modalHtml = `
        <div id="modal-detail-order" class="fixed inset-0 z-[9999] flex items-end justify-center bg-gray-900 bg-opacity-60 transition-opacity">
            <div class="bg-white w-full max-w-md rounded-t-[30px] p-6 pb-24 animate-slide-up shadow-2xl overflow-y-auto max-h-[90vh]">
                <div class="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
                    <h3 class="font-black text-gray-800 text-lg">Detail Order</h3>
                    <button onclick="document.getElementById('modal-detail-order').remove()" class="bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full p-1.5 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
                
                <div class="space-y-4">
                    <div class="flex items-center gap-3">
                        <div class="bg-blue-100 p-2.5 rounded-full text-blue-600">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd" /></svg>
                        </div>
                        <div>
                            <p class="text-[10px] font-bold text-gray-400 uppercase">PENGORDER</p>
                            <p class="text-sm font-black text-gray-800">${custName} <span class="text-xs font-normal text-gray-500 ml-1">(${custWa})</span></p>
                        </div>
                    </div>

                    <div class="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                        <p class="text-[10px] font-bold text-gray-400 uppercase mb-1">ALAMAT JEMPUT (TOKO)</p>
                        <p class="text-[13px] font-bold text-gray-800">${order.alamatJemput}</p>
                    </div>

                    <div class="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center gap-4">
                        <div class="w-14 h-14 bg-white rounded-xl shadow-sm p-2 flex-shrink-0 flex items-center justify-center">
                            <img src="${logoUrl}" class="w-full h-full object-contain">
                        </div>
                        <div>
                            <p class="text-[10px] font-bold text-blue-500 uppercase mb-1">TUJUAN (EKSPEDISI)</p>
                            <p class="text-[13px] font-black text-blue-800">${order.alamatTujuan}</p>
                        </div>
                    </div>
                </div>
                ${historyHtml}
                ${photoHtml}
                ${actionButton}
            </div>
        </div>
        <style>
            @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            .animate-slide-up { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        </style>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.tolakDariNotif = (orderId) => {
    notifications = notifications.filter(n => n.id !== orderId);
    localStorage.setItem('mapel_driver_notif', JSON.stringify(notifications));
    document.getElementById('modal-detail-order').remove();
    renderNotifications();
};

const navNotif = document.getElementById('nav-notif');
if(navNotif) {
    navNotif.addEventListener('click', () => {
        const dot = document.getElementById('notif-dot');
        if(dot) dot.classList.add('hidden');
    });
}

const tabs = { dashboard: document.getElementById('view-dashboard'), map: document.getElementById('view-map'), notif: document.getElementById('view-notif'), settings: document.getElementById('view-settings') };
const navBtns = { dashboard: document.getElementById('nav-dashboard'), map: document.getElementById('nav-map'), notif: document.getElementById('nav-notif'), settings: document.getElementById('nav-settings') };

function switchTab(target) {
    Object.keys(tabs).forEach(k => { 
        if(tabs[k]) tabs[k].classList.add('hidden', 'opacity-0'); 
        if(navBtns[k]) { navBtns[k].classList.remove('text-blue-600'); navBtns[k].classList.add('text-gray-400'); }
    });
    if(tabs[target]) { tabs[target].classList.remove('hidden'); setTimeout(() => tabs[target].classList.remove('opacity-0'), 50); }
    if(navBtns[target]) { navBtns[target].classList.remove('text-gray-400'); navBtns[target].classList.add('text-blue-600'); }
    if (target === 'map') setTimeout(() => myMap.map.invalidateSize(), 300);
    if (target === 'notif') renderNotifications();
}

if(navBtns.dashboard) navBtns.dashboard.onclick = () => switchTab('dashboard');
if(navBtns.map) navBtns.map.onclick = () => switchTab('map');
if(navBtns.notif) navBtns.notif.onclick = () => switchTab('notif');
if(navBtns.settings) navBtns.settings.onclick = () => switchTab('settings');

const toggleStatus = document.getElementById('toggle-status');
const statusText = document.getElementById('status-text');
const mapEl = document.getElementById('map');

let isOnline = localStorage.getItem('mapel_driver_is_online') === 'true';
let currentGpsLatLng = null;
let lastLat = null, lastLng = null;

if(toggleStatus) toggleStatus.checked = isOnline;
updateOnlineUI(isOnline);

function updateOnlineUI(status) {
    if(!statusText || !mapEl) return;
    if (status) {
        statusText.innerText = "ONLINE"; statusText.classList.replace('text-gray-400', 'text-green-500'); mapEl.style.filter = "brightness(1)";
    } else {
        statusText.innerText = "OFFLINE"; statusText.classList.replace('text-green-500', 'text-gray-400'); mapEl.style.filter = "brightness(0.7) grayscale(0.5)";
    }
}

myMap.map.locate({ watch: true, enableHighAccuracy: true });

myMap.map.on('locationfound', (e) => {
    if (lastLat && Math.abs(e.latlng.lat - lastLat) < 0.00005 && Math.abs(e.latlng.lng - lastLng) < 0.00005) return;
    lastLat = e.latlng.lat; lastLng = e.latlng.lng;
    currentGpsLatLng = e.latlng;
    myMap.updateDriverPosition(e.latlng.lat, e.latlng.lng);
    if (isOnline) {
        myMap.map.panTo(e.latlng, { animate: true, duration: 1.0 });
        socket.emit('driver_send_location', { id: driverProfile.id, lat: e.latlng.lat, lng: e.latlng.lng });
    }
});

if(toggleStatus) {
    toggleStatus.addEventListener('change', (e) => {
        isOnline = e.target.checked;
        localStorage.setItem('mapel_driver_is_online', isOnline);
        updateOnlineUI(isOnline);
        if (isOnline) {
            if(currentGpsLatLng) myMap.map.setView(currentGpsLatLng, 17);
            socket.emit('driver_check_pending_orders');
        }
    });
}

const btnMyLocation = document.getElementById('btn-my-location');
if(btnMyLocation) btnMyLocation.onclick = () => { if (currentGpsLatLng) myMap.map.setView(currentGpsLatLng, 17); };

let activeOrder = null;

socket.on('connect', () => { if (isOnline) socket.emit('driver_check_pending_orders'); });

socket.on('new_order_broadcast', (orderData) => {
    if (notifications.find(n => n.id === orderData.id)) return;
    
    orderData.status = 'pending';
    orderData.tracking = [{ time: getWaktuSekarang(), status: 'Order Dibuat Customer' }];
    orderData.waktuMasuk = `${new Date().getHours().toString().padStart(2,'0')}:${new Date().getMinutes().toString().padStart(2,'0')}`;
    
    notifications.unshift(orderData);
    localStorage.setItem('mapel_driver_notif', JSON.stringify(notifications));
    
    if(window.navigator.vibrate) navigator.vibrate([500, 110, 500]);
    const dot = document.getElementById('notif-dot');
    if(dot) dot.classList.remove('hidden');
    
    if(tabs.notif && !tabs.notif.classList.contains('hidden')) renderNotifications();

    if (!activeOrder && isOnline) {
        const btnTutup = document.getElementById('btn-tolak');
        if (btnTutup) { btnTutup.innerText = "Nanti Saja"; btnTutup.onclick = () => closePopupOrder(); }

        const btnTerima = document.getElementById('btn-terima');
        if(btnTerima) btnTerima.onclick = () => { closePopupOrder(); prosesTerimaOrder(orderData.id); };

        const elJemput = document.getElementById('order-jemput');
        const elTujuan = document.getElementById('order-tujuan');
        const elBarang = document.getElementById('order-barang');
        
        if(elJemput) elJemput.innerText = orderData.alamatJemput;
        if(elTujuan) elTujuan.innerText = orderData.alamatTujuan;
        if(elBarang) elBarang.innerText = `${orderData.berat} KG - ${orderData.namaBarang}`;

        const popup = document.getElementById('popup-order');
        const card = document.getElementById('order-card');
        if(popup && card) {
            popup.classList.remove('hidden');
            setTimeout(() => { popup.classList.remove('opacity-0'); card.classList.remove('scale-95'); }, 50);
        }
    }
});

function closePopupOrder() {
    const popup = document.getElementById('popup-order');
    const card = document.getElementById('order-card');
    if(popup && card) {
        popup.classList.add('opacity-0'); card.classList.add('scale-95');
        setTimeout(() => popup.classList.add('hidden'), 300);
    }
}

window.terimaDariNotif = (orderId) => {
    if (activeOrder) return alert("Selesaikan dulu tugas yang aktif bro!");
    const modal = document.getElementById('modal-detail-order');
    if(modal) modal.remove();
    prosesTerimaOrder(orderId);
};

function prosesTerimaOrder(orderId) {
    if (!currentGpsLatLng) return alert("Tunggu GPS kelock dulu bro!");
    const orderIndex = notifications.findIndex(n => n.id === orderId);
    if (orderIndex === -1) return;

    activeOrder = notifications[orderIndex];
    if(!activeOrder.tracking) activeOrder.tracking = [];
    activeOrder.tracking.push({ time: getWaktuSekarang(), status: 'Driver Menuju Lokasi Jemput' });
    localStorage.setItem('mapel_driver_notif', JSON.stringify(notifications));

    socket.emit('driver_accept_order', { orderId: activeOrder.id, driverProfile: driverProfile });

    if(window.destMarker) myMap.map.removeLayer(window.destMarker);
    if(window.pickupMarkerDriver) myMap.map.removeLayer(window.pickupMarkerDriver);
    
    window.pickupMarkerDriver = myMap.addMarker(activeOrder.jemputLat, activeOrder.jemputLng, 'jemput', 'Lokasi Jemput Barang');

    myMap.drawRoute([{ lat: currentGpsLatLng.lat, lng: currentGpsLatLng.lng }, { lat: activeOrder.jemputLat, lng: activeOrder.jemputLng }], () => {
        const tugasAlamat = document.getElementById('tugas-alamat');
        const sheetTugas = document.getElementById('sheet-tugas');
        if(tugasAlamat) tugasAlamat.innerText = activeOrder.alamatJemput;
        if(sheetTugas) sheetTugas.classList.remove('translate-y-[120%]');
    });
    switchTab('map');
}

let isSheetTugasOpen = true;
const toggleSheetTugas = document.createElement('div');
toggleSheetTugas.className = "w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-3 cursor-pointer";
toggleSheetTugas.onclick = () => {
    const sheetContent = document.getElementById('sheet-tugas');
    if(sheetContent) {
        isSheetTugasOpen = !isSheetTugasOpen;
        sheetContent.style.transform = isSheetTugasOpen ? 'translateY(0)' : 'translateY(65%)';
    }
};
const headerSheet = document.querySelector('#sheet-tugas .flex.justify-between.items-center.mb-3');
if(headerSheet) headerSheet.parentNode.insertBefore(toggleSheetTugas, headerSheet);

let pendingActionStatus = null; 
let currentEvidentPhoto = null; 

window.actionPickUp = () => {
    pendingActionStatus = 'picked_up';
    bukaLayarKamera('Bukti Ambil Paket', 'Foto paket saat diambil dari lokasi jemput', 'bg-blue-600');
};

window.actionDropOff = () => {
    pendingActionStatus = 'completed';
    bukaLayarKamera('Bukti Pengiriman', 'Foto paket di lokasi tujuan / penerima', 'bg-green-600');
};

function bukaLayarKamera(title, subtitle, headerColorClass) {
    document.getElementById('kamera-title').innerText = title;
    document.getElementById('kamera-subtitle').innerText = subtitle;
    
    const header = document.getElementById('kamera-header');
    header.className = `p-4 text-white text-center transition-colors flex-shrink-0 ${headerColorClass}`;
    
    const btnSubmit = document.getElementById('btn-submit-foto');
    btnSubmit.className = `flex-[1.5] py-3 text-white font-bold rounded-xl opacity-50 cursor-not-allowed transition-all shadow-md ${headerColorClass}`;

    document.getElementById('photo-preview').classList.add('hidden');
    document.getElementById('camera-placeholder').classList.remove('hidden');
    document.getElementById('input-kamera').value = '';
    currentEvidentPhoto = null;
    
    btnSubmit.disabled = true;

    document.getElementById('modal-kamera').classList.remove('hidden');
    document.getElementById('modal-kamera').classList.add('flex');
}

window.tutupKamera = () => {
    document.getElementById('modal-kamera').classList.add('hidden');
    document.getElementById('modal-kamera').classList.remove('flex');
    pendingActionStatus = null;
    currentEvidentPhoto = null;
};

document.getElementById('input-kamera').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    document.getElementById('camera-placeholder').innerHTML = `<span class="text-xs font-bold text-gray-500 animate-pulse">Memproses Foto...</span>`;

    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            let scaleSize = 1;
            
            if (img.width > MAX_WIDTH) scaleSize = MAX_WIDTH / img.width;
            
            canvas.width = img.width * scaleSize;
            canvas.height = img.height * scaleSize;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            currentEvidentPhoto = canvas.toDataURL('image/jpeg', 0.7); 
            
            const preview = document.getElementById('photo-preview');
            preview.src = currentEvidentPhoto;
            preview.classList.remove('hidden');
            document.getElementById('camera-placeholder').classList.add('hidden');

            const btnSubmit = document.getElementById('btn-submit-foto');
            btnSubmit.disabled = false;
            btnSubmit.classList.remove('opacity-50', 'cursor-not-allowed');
            btnSubmit.classList.add('active:scale-95');
        }
        img.src = event.target.result;
    }
    reader.readAsDataURL(file);
});

document.getElementById('btn-submit-foto').addEventListener('click', function() {
    if (!currentEvidentPhoto || !pendingActionStatus || !activeOrder) return;

    const btn = this;
    const originalText = btn.innerText;
    btn.innerText = "Mengupload...";
    btn.disabled = true;

    const btnActionTugas = document.getElementById('btn-action-tugas');
    const orderIndex = notifications.findIndex(n => n.id === activeOrder.id);

    if (pendingActionStatus === 'picked_up') {
        
        if(orderIndex !== -1) {
            if(!notifications[orderIndex].tracking) notifications[orderIndex].tracking = [];
            notifications[orderIndex].tracking.push({ time: getWaktuSekarang(), status: 'Barang Telah Diambil oleh Kurir' });
            notifications[orderIndex].photoPickup = currentEvidentPhoto;
            localStorage.setItem('mapel_driver_notif', JSON.stringify(notifications));
        }

        btnActionTugas.innerText = "SELESAIKAN ORDER";
        btnActionTugas.classList.replace('bg-gray-900', 'bg-green-600');
        
        const textTujuan = activeOrder.jenisLayanan === 'ekspedisi' ? "MENUJU EKSPEDISI" : "MENUJU TUJUAN";
        const badge = document.getElementById('tugas-badge');
        const alamat = document.getElementById('tugas-alamat');
        if(badge) badge.innerText = textTujuan;
        if(alamat) alamat.innerText = activeOrder.alamatTujuan;

        socket.emit('update_order_status', { 
            orderId: activeOrder.id, 
            status: 'picked_up', 
            driverData: driverProfile,
            photoBase64: currentEvidentPhoto
        });

        if(window.pickupMarkerDriver) myMap.map.removeLayer(window.pickupMarkerDriver);
        const logoUrl = activeOrder.jenisLayanan === 'ekspedisi' ? getEkspedisiLogo(activeOrder.alamatTujuan) : null;
        const iconType = activeOrder.jenisLayanan === 'ekspedisi' ? 'ekspedisi' : 'tujuan_personal';
        window.destMarker = myMap.addMarker(activeOrder.tujuanLat, activeOrder.tujuanLng, iconType, 'Tujuan Pengiriman', logoUrl);

        myMap.drawRoute([{ lat: currentGpsLatLng.lat, lng: currentGpsLatLng.lng }, { lat: activeOrder.tujuanLat, lng: activeOrder.tujuanLng }], () => {});
        isSheetTugasOpen = true; 
        const sheet = document.getElementById('sheet-tugas');
        if(sheet) sheet.style.transform = 'translateY(0)'; 

    } else if (pendingActionStatus === 'completed') {
        
        driverStats.saldo += 5000; driverStats.totalOrder += 1;
        localStorage.setItem('mapel_driver_stats', JSON.stringify(driverStats));
        
        if (orderIndex !== -1) {
            notifications[orderIndex].status = 'completed';
            if(!notifications[orderIndex].tracking) notifications[orderIndex].tracking = [];
            notifications[orderIndex].tracking.push({ time: getWaktuSekarang(), status: 'Paket Telah Tiba di Tujuan' });
            notifications[orderIndex].photoDropoff = currentEvidentPhoto;
            localStorage.setItem('mapel_driver_notif', JSON.stringify(notifications));
        }

        socket.emit('update_order_status', { 
            orderId: activeOrder.id, 
            status: 'completed',
            photoBase64: currentEvidentPhoto
        });
        
        renderDashboard(); 
        renderNotifications();

        const sheet = document.getElementById('sheet-tugas');
        if(sheet) {
            sheet.classList.add('translate-y-[120%]');
            sheet.style.transform = ''; 
        }
        if (myMap.routingControl) { myMap.map.removeControl(myMap.routingControl); myMap.routingControl = null; }
        if (window.destMarker) myMap.map.removeLayer(window.destMarker);
        if (window.pickupMarkerDriver) myMap.map.removeLayer(window.pickupMarkerDriver);

        btnActionTugas.innerText = "PAKET SUDAH DIAMBIL";
        btnActionTugas.classList.replace('bg-green-600', 'bg-gray-900');
        const badge = document.getElementById('tugas-badge');
        if(badge) badge.innerText = "MENUJU PENJEMPUTAN";
        
        activeOrder = null; 
    }

    setTimeout(() => {
        window.tutupKamera();
        btn.innerText = originalText;
    }, 500);
});

const btnTugasAct = document.getElementById('btn-action-tugas');
if(btnTugasAct) {
    btnTugasAct.onclick = function() {
        if (this.innerText === "PAKET SUDAH DIAMBIL") {
            window.actionPickUp();
        } else {
            window.actionDropOff();
        }
    };
}

document.addEventListener('DOMContentLoaded', () => {
    renderDashboard(); 
    renderNotifications();
    renderPinEkspedisiDiDriver(); // INIT RENDER TITIK EKS
});
