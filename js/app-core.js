// ========================================================================
// FILE: js/app-core.js
// FUNGSI: Menggantikan Socket.io & LocalStorage dengan Supabase Realtime
// ========================================================================

import { supabase, checkSession, logoutUser } from '/js/supabase.js';

// Menunggu UI dan Map selesai di-load oleh browser
document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. SATPAM HALAMAN (Proteksi Keamanan)
    // Akan otomatis melempar user ke index.html jika belum login, 
    // atau melempar ke dashboard driver/admin jika rolenya salah.
    const authData = await checkSession('customer');
    if (!authData) return; 

    const profile = authData.profile;

    // 2. TIMPA DATA PROFIL DI UI
    // Mengganti data dummy di localStorage dengan data asli dari database
    const nameText = document.getElementById('profile-name-text');
    const waText = document.getElementById('profile-wa-text');
    const emailText = document.getElementById('profile-email-text');
    const greeting = document.getElementById('header-greeting');

    if (nameText) nameText.innerText = profile.full_name;
    if (waText) waText.innerText = profile.whatsapp || '-';
    if (emailText) emailText.innerText = authData.session.user.email;
    
    if (greeting) {
        const namaDepan = profile.full_name.split(' ')[0];
        greeting.innerText = `Hai, ${namaDepan}! 👋`;
    }

    // 3. AMBIL ALIH FUNGSI LOGOUT
    // Menimpa fungsi handleLogout() bawaan dari app.js
    window.handleLogout = async () => {
        // Tampilkan konfirmasi, lalu eksekusi dari supabase.js
        if (confirm("Yakin ingin logout dari aplikasi?")) {
            await logoutUser();
        }
    };

    // 4. MATIKAN SOCKET.IO & GANTI SUPABASE REALTIME
    // "const socket = io()" di app.js akan otomatis mati/error di Vercel, 
    // jadi kita ambil alih data pergerakan driver dan order di sini.
    
    // Memantau pergerakan lokasi driver secara live
    supabase.channel('public:driver_locations')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'driver_locations' }, payload => {
            const data = payload.new;
            
            // Asumsi window.myMap dari MapEngine.js lu sudah tereksekusi global
            if (window.myMap && typeof window.myMap.updateDriverPosition === 'function') {
                window.myMap.updateDriverPosition(data.lat, data.lng);
            } else if (window.liveDriverMarker) {
                window.liveDriverMarker.setLatLng([data.lat, data.lng]);
            }
        }).subscribe();

    // Memantau update status pesanan (Misal: dari 'pending' jadi 'diproses' oleh driver)
    supabase.channel('public:orders')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
            const orderData = payload.new;
            
            // Filter: Pastikan notifikasi ini hanya untuk order milik customer ini
            if (orderData.data && orderData.data.customer_id === profile.id) {
                console.log("Status Order Terupdate:", orderData.status);
                
                // Update global data dan trigger ulang render tracking di UI lu
                window.currentOrderData = orderData.data;
                if (typeof window.renderLiveTrackingCard === 'function') {
                    window.renderLiveTrackingCard();
                }
                
                // Jika order selesai, munculkan alert
                if (orderData.status === 'completed') {
                    alert("Pesananmu telah selesai diantar! Terima kasih.");
                }
            }
        }).subscribe();

    // 5. FUNGSI BARU UNTUK INSERT ORDER (Kirim Data ke Supabase)
    // Lu tinggal panggil fungsi ini di dalam logika tombol pesan lu di app.js
    window.submitOrderToSupabase = async (orderDetails) => {
        const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
        
        const payload = {
            id: orderId,
            status: 'pending', 
            data: {
                customer_id: profile.id,
                customer_name: profile.full_name,
                customer_wa: profile.whatsapp,
                ...orderDetails // Kumpulan titik jemput, tujuan, dll dari app.js
            }
        };

        const { error } = await supabase.from('orders').insert([payload]);
        
        if (error) {
            alert("Gagal membuat pesanan: " + error.message);
        } else {
            alert("Pesanan berhasil dibuat! Sedang mencari kurir terdekat...");
            window.isOrderActive = true;
            window.currentOrderData = payload.data;
        }
    };
});
