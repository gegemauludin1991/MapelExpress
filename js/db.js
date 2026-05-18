// ========================================================================
// FILE: js/db.js (ENGINE DATABASE SUPABASE & AUTH SECURITY)
// VERSI: FULL HARDCODED CREDENTIALS - ANTI BYPASS SECURITY & ANTI BENTROK ROLE
// ========================================================================

const SUPABASE_URL = 'https://nahgibyegdeioquryfde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5haGdpYnllZ2RlaW9xdXJ5ZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODM3NjksImV4cCI6MjA5NDE1OTc2OX0.NeN2uqRTKEJyc0SOEIV5iUQIIOGf88A46KRJffGUKmQ';

// Inisialisasi client Supabase secara global
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let userProfile = null;
let isReady = false;
const path = window.location.pathname;

// Deteksi target halaman berdasarkan URL aktif
let requiredRole = null;
if (path.includes('admin.html')) requiredRole = 'admin';
else if (path.includes('driver.html')) requiredRole = 'driver';
else if (path.includes('app.html')) requiredRole = 'customer';

// =====================================================================
// A. LAYANAN AUTENTIKASI (GOOGLE & MANUAL LOGIN)
// =====================================================================

// 1. Login Dengan Google
window.loginDenganGoogle = async function() {
    try {
        console.log("[Supabase] Memicu Google OAuth...");
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/app.html' }
        });
        if (error) alert("Gagal OAuth Google: " + error.message);
    } catch (err) { console.error("OAuth Error:", err); }
};

// 2. Registrasi Akun Manual (Customer)
window.registerManual = async function() {
    const name = document.getElementById('reg-name').value;
    const wa = document.getElementById('reg-wa').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    if (!name || !email || !password) return alert("Nama, Email, dan Password wajib diisi bos!");

    const btn = document.getElementById('btn-register');
    btn.innerText = "Mendaftarkan...";

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: name, whatsapp: wa } }
    });

    if (error) {
        alert("Gagal Daftar: " + error.message);
    } else {
        alert("Pendaftaran Berhasil! Silakan masuk menggunakan email terdaftar.");
        window.toggleForm('login');
    }
    btn.innerText = "Buat Akun";
};

// 3. Login Manual (Email & Password - Untuk Customer & Akun Driver Buatan Admin)
window.loginManual = async function() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) return alert("Email dan Password wajib diisi!");

    const btn = document.getElementById('btn-login');
    btn.innerText = "Memeriksa...";

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Login Gagal: Periksa kembali email & password anda.");
        btn.innerText = "Masuk";
    } else {
        // Refresh halaman, biarkan fungsi proteksiHalaman() yang membaca role dan melakukan redirect
        window.location.reload();
    }
};

// =====================================================================
// B. SATPAM SISTEM (ANTI BYPASS LINK BELAKANG & ANTI LOGOUT MACET)
// =====================================================================
async function proteksiHalaman() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const isAuthPage = path === '/' || path.includes('index.html');

        // Skenario 1: Mencoba akses halaman dalam tanpa login -> Blokir dan tendang ke depan
        if (!session) {
            if (!isAuthPage) {
                window.location.replace('/index.html');
            }
            return;
        }

        // Skenario 2: Jika user terdeteksi sudah login, cek role dari tabel profiles
        if (session) {
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            const role = profile?.role || 'customer'; // Default fallback aman
            userProfile = profile;
            isReady = true;

            // VALIDASI ANTI BYPASS: Jika role tidak sesuai dengan halaman yang dibuka, tendang paksa!
            if (requiredRole && role !== requiredRole) {
                alert(`Akses Ditolak! Akun anda terdaftar sebagai ${role.toUpperCase()}.`);
                if (role === 'admin') window.location.replace('/admin.html');
                else if (role === 'driver') window.location.replace('/driver.html');
                else window.location.replace('/app.html');
                return;
            }

            // Jika user nekat buka halaman login padahal statusnya sudah login, langsung arahkan ke jalurnya
            if (isAuthPage) {
                if (role === 'admin') window.location.replace('/admin.html');
                else if (role === 'driver') window.location.replace('/driver.html');
                else window.location.replace('/app.html');
            }

            // Jika semua lolos, aktifkan jembatan realtime data mapel
            if (requiredRole) initRealtimeBridge();
        }
    } catch (err) {
        console.error("Security Engine Crash: ", err);
    }
}
proteksiHalaman();

// Fungsi Logout Total Bersihkan Semua Sesi Server & Browser
window.handleLogout = async () => {
    if(confirm("Yakin ingin keluar dari aplikasi?")) {
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.replace('/index.html');
    }
};

// =====================================================================
// C. MOCK SOCKET.IO INTERFACES (JEMBATAN GAIB UNTUK APP.JS & DRIVER.JS)
// =====================================================================
window.socketBridge = {
    events: {},
    on: function(eventName, callback) { this.events[eventName] = callback; },
    emit: async function(eventName, data) {
        if (!isReady || !userProfile) return;
        try {
            if (eventName === 'driver_send_location' || eventName === 'updateLocation') {
                await supabase.from('driver_locations').upsert([{
                    id: userProfile.id, lat: data.lat, lng: data.lng,
                    data: { name: userProfile.full_name, nopol: userProfile.whatsapp },
                    updated_at: new Date()
                }]);
            }
            else if (eventName === 'customer_create_order' || eventName === 'newOrder') {
                const orderId = data.id || 'ORD-' + Math.random().toString(36).substr(2, 7).toUpperCase();
                await supabase.from('orders').insert([{ id: orderId, status: 'pending', data: data }]);
            }
            else if (eventName === 'driver_accept_order' || eventName === 'update_order_status') {
                await supabase.from('orders').update({ status: data.status }).eq('id', data.orderId);
            }
        } catch(err) { console.error("[Bridge Send Error]:", err); }
    }
};

window.io = function() { return window.socketBridge; };

function initRealtimeBridge() {
    if (requiredRole === 'customer' || requiredRole === 'admin') {
        supabase.channel('public:driver_locations')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'driver_locations' }, payload => {
                const loc = payload.new;
                if (window.socketBridge.events['update_driver_map']) {
                    window.socketBridge.events['update_driver_map']({ id: loc.id, lat: loc.lat, lng: loc.lng });
                }
            }).subscribe();
    }

    supabase.channel('public:orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
            if (requiredRole === 'driver' && window.socketBridge.events['new_order_broadcast']) {
                window.socketBridge.events['new_order_broadcast'](payload.new.data);
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
            if (requiredRole === 'customer' && window.socketBridge.events['order_status_changed']) {
                window.socketBridge.events['order_status_changed'](payload.new);
            }
        }).subscribe();
}
