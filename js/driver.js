/**
 * MAIN APP CONTROLLER - SISI KURIR / DRIVER
 */

const OFFICE = { lat: -6.977414, lng: 107.555359 };
const myMap = new DynamicMap('map', OFFICE.lat, OFFICE.lng, 15);

const officeIcon = L.icon({
    iconUrl: '/assets/icons/pin.png', iconSize: [45, 45], iconAnchor: [22.5, 45], popupAnchor: [0, -40] 
});
L.marker([OFFICE.lat, OFFICE.lng], { icon: officeIcon }).addTo(myMap.map)
    .bindPopup("<div class='font-bold text-center text-blue-800 text-xs'>Pusat Operasional<br>MapelExpress</div>");

const socket = window.socketBridge || { on: function(){}, emit: function(){} };

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

function getEkspedisiLogo(nama) {
    if (!nama) return '/assets/icons/kurir.png';
    const n = nama.toLowerCase();
    if (n.includes('j&t') || n.includes('jnt')) return '/assets/icons/j&t.png'; 
    if (n.includes('jne')) return '/assets/icons/jne.png';
    if (n.includes('ninja')) return '/assets/icons/ninja.png';
    if (n.includes('spx') || n.includes('shopee')) return '/assets/icons/spx.png';
    if (n.includes('wahana')) return '/assets/icons/wahana.png'; 
    if (n.includes('sicepat') || n.includes('si cepat')) return '/assets/icons/sicepat.png';
    return '/assets/icons/kurir.png'; 
}

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

// ==========================================
// FIX BUG NAVBAR & TABS SYSTEM DRIVER
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const tabs = { dashboard: document.getElementById('view-dashboard'), map: document.getElementById('view-map'), notif: document.getElementById('view-notif'), settings: document.getElementById('view-settings') };
    const navBtns = { dashboard: document.getElementById('nav-dashboard'), map: document.getElementById('nav-map'), notif: document.getElementById('nav-notif'), settings: document.getElementById('nav-settings') };

    window.switchTab = function(target) {
        Object.keys(tabs).forEach(k => { 
            if(tabs[k]) tabs[k].classList.add('hidden', 'opacity-0'); 
            if(navBtns[k]) { navBtns[k].classList.remove('text-blue-600'); navBtns[k].classList.add('text-gray-400'); }
        });
        if(tabs[target]) { tabs[target].classList.remove('hidden'); setTimeout(() => tabs[target].classList.remove('opacity-0'), 50); }
        if(navBtns[target]) { navBtns[target].classList.remove('text-gray-400'); navBtns[target].classList.add('text-blue-600'); }
        if (target === 'map') setTimeout(() => myMap.map.invalidateSize(), 300);
        if (target === 'notif') renderNotifications();
    };

    if(navBtns.dashboard) navBtns.dashboard.onclick = () => window.switchTab('dashboard');
    if(navBtns.map) navBtns.map.onclick = () => window.switchTab('map');
    if(navBtns.notif) navBtns.notif.onclick = () => window.switchTab('notif');
    if(navBtns.settings) navBtns.settings.onclick = () => window.switchTab('settings');
    
    renderDashboard(); 
    renderNotifications();
    renderPinEkspedisiDiDriver();
});
