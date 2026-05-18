// ========================================================================
// FILE: js/db.js (ENGINE DATABASE SUPABASE & AUTH SECURITY)
// ========================================================================

const SUPABASE_URL = 'https://nahgibyegdeioquryfde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5haGdpYnllZ2RlaW9xdXJ5ZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODM3NjksImV4cCI6MjA5NDE1OTc2OX0.NeN2uqRTKEJyc0SOEIV5iUQIIOGf88A46KRJffGUKmQ';

// Sistem Pengaman Inisialisasi Supabase
let supabase;
try {
    if (typeof window.supabase === 'undefined') throw new Error("File Supabase belum selesai didownload oleh browser.");
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log("Supabase berhasil terkoneksi.");
} catch (error) {
    alert("FATAL ERROR: Koneksi ke server gagal. Refresh halaman atau bersihkan cache browser! Detail: " + error.message);
}

let userProfile = null;
let isReady = false;
const path = window.location.pathname;

let requiredRole = null;
if (path.includes('admin.html')) requiredRole = 'admin';
else if (path.includes('driver.html')) requiredRole = 'driver';
else if (path.includes('app.html')) requiredRole = 'customer';

// =====================================================================
// A. LAYANAN AUTENTIKASI (GOOGLE & MANUAL LOGIN)
// =====================================================================

window.loginDenganGoogle = async function() {
    if (!supabase) return alert("Sistem belum siap. Tunggu sebentar lalu coba lagi.");
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/app.html' }
        });
        if (error) alert("Gagal OAuth Google: " + error.message);
    } catch (err) { alert("System Error: " + err.message); }
};

window.registerManual = async function() {
    if (!supabase) return alert("Sistem belum siap.");
    try {
        const name = document.getElementById('reg-name').value;
        const wa = document.getElementById('reg-wa').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        if (!name || !email || !password) return alert("Nama, Email, dan Password wajib diisi bos!");

        const btn = document.getElementById('btn-register');
        btn.innerText = "Mendaftarkan...";
        btn.disabled = true;

        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: { data: { full_name: name, whatsapp: wa } }
        });

        if (error) {
            alert("Gagal Daftar: " + error.message);
            btn.innerText = "Buat Akun";
            btn.disabled = false;
        } else {
            alert("Pendaftaran Berhasil! Anda akan dialihkan otomatis.");
            window.location.replace('/app.html'); 
        }
    } catch (err) { alert("System Error: " + err.message); }
};

window.loginManual = async function() {
    if (!supabase) return alert("Sistem belum siap.");
    try {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        if (!email || !password) return alert("Email dan Password wajib diisi!");

        const btn = document.getElementById('btn-login');
        btn.innerText = "Memeriksa...";
        btn.disabled = true;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            alert("Login Gagal: Cek kembali email & password lu.");
            btn.innerText = "Masuk";
            btn.disabled = false;
        } else {
            window.location.replace('/app.html'); 
        }
    } catch (err) { alert("System Error: " + err.message); }
};

// =====================================================================
// B. SATPAM SISTEM (ANTI BYPASS & SECURITY)
// =====================================================================
async function proteksiHalaman() {
    if (!supabase) return;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const isAuthPage = path === '/' || path.includes('index.html');

        if (!session) {
            if (!isAuthPage) window.location.replace('/index.html');
            return;
        }

        if (session) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
            const role = profile?.role || 'customer'; 
            userProfile = profile;
            isReady = true;

            if (requiredRole && role !== requiredRole) {
                alert(`Akses Ditolak! Akun lu terdaftar sebagai ${role.toUpperCase()}.`);
                if (role === 'admin') window.location.replace('/admin.html');
                else if (role === 'driver') window.location.replace('/driver.html');
                else window.location.replace('/app.html');
                return;
            }

            if (isAuthPage) {
                if (role === 'admin') window.location.replace('/admin.html');
                else if (role === 'driver') window.location.replace('/driver.html');
                else window.location.replace('/app.html');
            }

            if (requiredRole) initRealtimeBridge();
        }
    } catch (err) { console.error("Security Engine Crash: ", err); }
}
proteksiHalaman();

window.handleLogout = async () => {
    if(confirm("Yakin ingin keluar?")) {
        await supabase.auth.signOut();
        localStorage.clear();
        window.location.replace('/index.html');
    }
};

// =====================================================================
// C. MOCK SOCKET.IO INTERFACES
// =====================================================================
window.socketBridge = {
    events: {},
    on: function(eventName, callback) { this.events[eventName] = callback; },
    emit: async function(eventName, data) {
        if (!isReady || !userProfile) return;
        try {
            if (eventName === 'driver_send_location' || eventName === 'updateLocation') {
                await supabase.from('driver_locations').upsert([{ id: userProfile.id, lat: data.lat, lng: data.lng, data: { name: userProfile.full_name, nopol: userProfile.whatsapp }, updated_at: new Date() }]);
            } else if (eventName === 'customer_create_order' || eventName === 'newOrder') {
                const orderId = data.id || 'ORD-' + Math.random().toString(36).substr(2, 7).toUpperCase();
                await supabase.from('orders').insert([{ id: orderId, status: 'pending', data: data }]);
            } else if (eventName === 'driver_accept_order' || eventName === 'update_order_status') {
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
                if (window.socketBridge.events['update_driver_map']) window.socketBridge.events['update_driver_map']({ id: loc.id, lat: loc.lat, lng: loc.lng });
            }).subscribe();
    }
    supabase.channel('public:orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
            if (requiredRole === 'driver' && window.socketBridge.events['new_order_broadcast']) window.socketBridge.events['new_order_broadcast'](payload.new.data);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
            if (requiredRole === 'customer' && window.socketBridge.events['order_status_changed']) window.socketBridge.events['order_status_changed'](payload.new);
        }).subscribe();
}
