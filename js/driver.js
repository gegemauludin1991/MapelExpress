/**
 * DRIVER CONTROLLER - FULL SUPABASE INTEGRATION
 */
const SUPABASE_URL = 'https://nahgibyegdeioquryfde.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5haGdpYnllZ2RlaW9xdXJ5ZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODM3NjksImV4cCI6MjA5NDE1OTc2OX0.NeN2uqRTKEJyc0SOEIV5iUQIIOGf88A46KRJffGUKmQ';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const OFFICE = { lat: -6.977414, lng: 107.555359 };
const myMap = new DynamicMap('map', OFFICE.lat, OFFICE.lng, 15);
L.marker([OFFICE.lat, OFFICE.lng], { icon: L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [45, 45] }) }).addTo(myMap.map);

let driverProfile = JSON.parse(localStorage.getItem('mapel_driver_profile'));
let notifications = [];
let isOnline = false;

async function initDriverServer() {
    if(!driverProfile) return alert("Akses Ditolak! Harap login via halaman utama.");

    // Tarik notif/tugas lama dari DB
    const { data: ords } = await supabase.from('orders').select('*');
    if(ords) {
        notifications = ords.map(o => o.data).filter(o => o.status === 'pending' || o.driverId === driverProfile.id);
        renderNotifications();
    }

    // 🔥 SUBSCRIBE REALTIME ORDER 🔥
    supabase.channel('driver_live_feed')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
            const oData = payload.new.data;
            // Kalo ada order pending baru atau orderan milik driver ini
            if (oData.status === 'pending' || oData.driverId === driverProfile.id) {
                const idx = notifications.findIndex(n => n.id === oData.id);
                if(idx === -1) notifications.unshift(oData); else notifications[idx] = oData;
                renderNotifications();
                if(oData.status === 'pending' && isOnline) {
                    if(window.navigator.vibrate) navigator.vibrate([500, 110, 500]);
                    munculinPopupOrderBaru(oData);
                }
            }
        }).subscribe();
}

// Pancarkan GPS ke Supabase
myMap.map.locate({ watch: true, enableHighAccuracy: true });
myMap.map.on('locationfound', async (e) => {
    myMap.updateDriverPosition(e.latlng.lat, e.latlng.lng);
    if (isOnline) {
        driverProfile.lat = e.latlng.lat; driverProfile.lng = e.latlng.lng;
        // PUSH KE SUPABASE
        await supabase.from('driver_locations').upsert({ id: driverProfile.id, lat: e.latlng.lat, lng: e.latlng.lng, data: driverProfile, updated_at: new Date().toISOString() });
    }
});

function munculinPopupOrderBaru(orderData) {
    document.getElementById('order-jemput').innerText = orderData.alamatJemput;
    document.getElementById('order-tujuan').innerText = orderData.alamatTujuan;
    document.getElementById('order-barang').innerText = `${orderData.berat} KG - ${orderData.namaBarang}`;
    
    document.getElementById('btn-terima').onclick = () => { 
        document.getElementById('popup-order').classList.add('hidden'); 
        prosesTerimaOrder(orderData.id); 
    };
    document.getElementById('popup-order').classList.remove('hidden');
}

async function prosesTerimaOrder(orderId) {
    const orderIndex = notifications.findIndex(n => n.id === orderId);
    if (orderIndex === -1) return;

    let actOrder = notifications[orderIndex];
    actOrder.status = 'picked_up';
    actOrder.driverId = driverProfile.id;
    actOrder.driverName = driverProfile.name;
    if(!actOrder.tracking) actOrder.tracking = [];
    actOrder.tracking.push({ time: new Date().toLocaleTimeString(), status: 'Driver Menuju Lokasi Jemput' });

    // UPDATE KE SUPABASE DB
    await supabase.from('orders').upsert({ id: actOrder.id, status: 'picked_up', data: actOrder });

    alert("Tugas diterima! Silakan jemput barang.");
    // (Lanjut rute jemput mapel spt biasa)
}

initDriverServer();
