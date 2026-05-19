/**
 * MAIN APP CONTROLLER - SISI CUSTOMER
 * Terkoneksi Supabase & UI Fix (Bottom Sheet)
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

// Gunakan Jembatan Supabase, JANGAN PAKE io() LAMA!
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

if(customerNotifs.length === 0) {
    customerNotifs.push({
        type: 'system', title: 'Selamat Datang di MapelExpress! 🎉',
        message: 'Aplikasi siap digunakan. Bebas pusing, kurir kami yang jemput dan antar paketmu ke ekspedisi manapun.',
        time: new Date().getHours() + ':' + String(new Date().getMinutes()).padStart(2, '0')
    });
    localStorage.setItem('mapel_customer_notif', JSON.stringify(customerNotifs));
}

document.addEventListener("DOMContentLoaded", async () => {
    window.ekspedisiList = JSON.parse(localStorage.getItem('mapel_ekspedisi')) || [];
    if(typeof renderPinEkspedisi === 'function') renderPinEkspedisi();

    // TARIK DATA PROFIL DARI SUPABASE
    if (typeof supabase !== 'undefined') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const fullName = user.user_metadata?.full_name || user.email.split('@')[0];
            const elName = document.getElementById('profile-name-text');
            const elEmail = document.getElementById('profile-email-text');
            const elWa = document.getElementById('profile-wa-text');
            const elGreeting = document.getElementById('header-greeting');
            
            if(elName) elName.innerText = fullName;
            if(elEmail) elEmail.innerText = user.email;
            if(elWa) elWa.innerText = user.user_metadata?.whatsapp || "Google Account";
            if(elGreeting) elGreeting.innerText = `Hai, ${fullName.split(' ')[0]}! 👋`;
        }
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

window.hubungiAdmin = () => {
    const text = encodeURIComponent("Halo Admin MapelExpress, saya butuh bantuan terkait layanan aplikasi nih.");
    window.open(`https://wa.me/${OFFICE.wa}?text=${text}`, '_blank');
};

window.kirimFeedback = () => {
    const text = encodeURIComponent("Halo Admin MapelExpress, saya punya kritik & saran buat aplikasi: \n\n");
    window.open(`https://wa.me/${OFFICE.wa}?text=${text}`, '_blank');
};

let pickingMode = null; 
let pickupMarker = null;  
let targetDestMarker = null; 

// PERBAIKAN BOTTOM SHEET MENU SAAT PILIH LOKASI (Biar gak ribet nutup)
window.exitPickingMode = function() {
    pickingMode = null;
    const card = document.getElementById('set-lokasi-card');
    const overlay = document.getElementById('center-pin-overlay');
    const bs = document.getElementById('bottom-sheet');

    if(card) card.classList.add('opacity-0'); 
    if(overlay) overlay.classList.add('hidden');
    
    setTimeout(() => { 
        if(card) card.classList.add('hidden'); 
        // BIKIN BOTTOM SHEET TETAP TERBUKA SETELAH PILIH LOKASI
        if(bs) {
            bs.style.transform = 'translateY(0)'; 
            isSheetOpen = true; 
        }
    }, 300);
};

const sheetHandle = document.getElementById('sheet-handle');
let isSheetOpen = true;
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
