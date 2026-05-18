// ========================================================================
// FILE: js/db.js (SUPER ENGINE DATABASE SUPABASE & AUTHENTICATION)
// ========================================================================

const SUPABASE_URL = 'https://nahgibyegdeioquryfde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5haGdpYnllZ2RlaW9xdXJ5ZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODM3NjksImV4cCI6MjA5NDE1OTc2OX0.NeN2uqRTKEJyc0SOEIV5iUQIIOGf88A46KRJffGUKmQ';

// 1. Inisialisasi Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================================
// A. MASTER ROUTING LOGIC (Sistem Satpam Otomatis)
// =====================================================================
// Fungsi ini akan mengecek profil user dan melemparnya ke halaman yang benar
async function routeUserBasedOnRole(session) {
    const path = window.location.pathname;
    const isAuthPage = path === '/' || path.includes('index.html');

    // Jika user mencoba buka halaman app/admin/driver tanpa login
    if (!session) {
        if (!isAuthPage) window.location.replace('/index.html');
        return;
    }

    // Ambil role dari tabel profiles
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

    const role = profile?.role || 'customer'; // Default aman
    window.currentUserRole = role; // Simpan di memori sementara

    // Jika user yang sudah login iseng buka halaman login (index.html)
    if (isAuthPage) {
        if (role === 'admin') window.location.replace('/admin.html');
        else if (role === 'driver') window.location.replace('/driver.html');
        else window.location.replace('/app.html');
        return;
    }

    // Keamanan ketat untuk URL bypass
    if (path.includes('admin.html') && role !== 'admin') {
        alert("Akses Ditolak! Anda bukan admin.");
        window.location.replace('/app.html');
    } else if (path.includes('driver.html') && role !== 'driver') {
        alert("Akses Ditolak! Anda bukan kurir.");
        window.location.replace('/app.html');
    } else {
        // Lolos dari semua penjagaan, nyalakan fitur Realtime Socket
        initRealtimeBridge();
    }
}

// 2. LISTENER OTOMATIS: Ini yang bikin proses login/logout lancar anti-freeze!
supabase.auth.onAuthStateChange((event, session) => {
    console.log("Status Auth Berubah:", event);
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        routeUserBasedOnRole(session);
    } else if (event === 'SIGNED_OUT') {
        const path = window.location.pathname;
        if (path !== '/' && !path.includes('index.html')) {
            window.location.replace('/index.html');
        }
    }
});


// =====================================================================
// B. FUNGSI TOMBOL LOGIN & REGISTER
// =====================================================================

window.loginDenganGoogle = async function() {
    try {
        const btn = document.querySelector('button[onclick="window.loginDenganGoogle()"]');
        btn.innerHTML = `<span class="animate-pulse">Menghubungkan ke Google...</span>`;
        btn.disabled = true;

        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/app.html' }
        });
        
        if (error) throw error;
    } catch (err) {
        alert("Gagal Login Google: " + err.message);
        window.location.reload();
    }
};

window.loginManual = async function() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) return alert("Harap isi Email dan Password!");

    const btn = document.getElementById('btn-login');
    btn.innerText = "Memverifikasi...";
    btn.disabled = true;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Login Gagal: " + error.message);
        btn.innerText = "Masuk";
        btn.disabled = false;
    }
    // Jika sukses, onAuthStateChange di atas akan otomatis mengambil alih dan melempar halaman.
};

window.registerManual = async function() {
    const name = document.getElementById('reg-name').value;
    const wa = document.getElementById('reg-wa').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    if (!name || !email || !password) return alert("Harap lengkapi semua data pendaftaran!");

    const btn = document.getElementById('btn-register');
    btn.innerText = "Mendaftarkan...";
    btn.disabled = true;

    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: name, whatsapp: wa } }
    });

    if (error) {
        alert("Gagal Mendaftar: " + error.message);
        btn.innerText = "Buat Akun";
        btn.disabled = false;
    } else {
        alert("Pendaftaran Berhasil! Mohon tunggu sebentar...");
        // Biarkan onAuthStateChange yang mengatur redirect
    }
};

window.handleLogout = async () => {
    if(confirm("Yakin ingin keluar dari aplikasi?")) {
        await supabase.auth.signOut();
        localStorage.clear();
        // Redirect akan diurus otomatis oleh onAuthStateChange
    }
};


// =====================================================================
// C. MOCK SOCKET.IO INTERFACES (Untuk Komunikasi Realtime Map)
// =====================================================================
window.socketBridge = {
    events: {},
    on: function(eventName, callback) { this.events[eventName] = callback; },
    emit: async function(eventName, data) {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            if (eventName === 'driver_send_location') {
                await supabase.from('driver_locations').upsert([{ 
                    id: session.user.id, lat: data.lat, lng: data.lng, updated_at: new Date() 
                }]);
            } else if (eventName === 'customer_create_order') {
                const orderId = data.id || 'ORD-' + Math.random().toString(36).substr(2, 7).toUpperCase();
                await supabase.from('orders').insert([{ id: orderId, status: 'pending', data: data }]);
            } else if (eventName === 'update_order_status' || eventName === 'driver_accept_order') {
                await supabase.from('orders').update({ status: data.status }).eq('id', data.orderId);
            }
        } catch(err) { console.error("[Bridge Send Error]:", err); }
    }
};

window.io = function() { return window.socketBridge; };

function initRealtimeBridge() {
    const role = window.currentUserRole;
    
    if (role === 'customer' || role === 'admin') {
        supabase.channel('public:driver_locations')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'driver_locations' }, payload => {
                if (window.socketBridge.events['update_driver_map']) {
                    window.socketBridge.events['update_driver_map']({ id: payload.new.id, lat: payload.new.lat, lng: payload.new.lng });
                }
            }).subscribe();
    }
    supabase.channel('public:orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
            if (role === 'driver' && window.socketBridge.events['new_order_broadcast']) {
                window.socketBridge.events['new_order_broadcast'](payload.new.data);
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
            if (role === 'customer' && window.socketBridge.events['order_status_changed']) {
                window.socketBridge.events['order_status_changed'](payload.new);
            }
        }).subscribe();
}
