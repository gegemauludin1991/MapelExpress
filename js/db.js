// ========================================================================
// FILE: js/db.js (ENGINE DATABASE SUPABASE & SECURITY GATEKEEPER)
// ========================================================================

const path = window.location.pathname;
const isAuthPage = path === '/' || path.includes('index.html');

// ANTI-JEBOL: Jika Supabase belum terpasang di HTML, langsung tendang keluar!
if (typeof window.supabase === 'undefined') {
    if (!isAuthPage) {
        window.location.replace('/index.html');
    }
} else {
    // INISIALISASI DATABASE
    const SUPABASE_URL = 'https://nahgibyegdeioquryfde.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5haGdpYnllZ2RlaW9xdXJ5ZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODM3NjksImV4cCI6MjA5NDE1OTc2OX0.NeN2uqRTKEJyc0SOEIV5iUQIIOGf88A46KRJffGUKmQ';
    
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    let userProfile = null;
    let isReady = false;
    
    let requiredRole = null;
    if (path.includes('admin.html')) requiredRole = 'admin';
    else if (path.includes('driver.html')) requiredRole = 'driver';
    else if (path.includes('app.html')) requiredRole = 'customer';
    
    // SATPAM KEAMANAN (Cek Role User)
    async function proteksiHalaman() {
        try {
            const { data: { session } } = await supabase.auth.getSession();
    
            if (!session) {
                if (!isAuthPage) window.location.replace('/index.html');
                return;
            }
    
            if (session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
    
                const role = profile?.role || 'customer'; 
                userProfile = profile;
                isReady = true;
    
                // CEGAH BYPASS URL: Tendang ke tempat yang benar!
                if (requiredRole && role !== requiredRole) {
                    alert(`Akses Ditolak! Akun anda terdaftar sebagai ${role.toUpperCase()}.`);
                    if (role === 'admin') window.location.replace('/admin.html');
                    else if (role === 'driver') window.location.replace('/driver.html');
                    else window.location.replace('/app.html');
                    return;
                }
    
                if (requiredRole) initRealtimeBridge(role);
            }
        } catch (err) {
            console.error("Security Engine Crash: ", err);
        }
    }
    
    proteksiHalaman();
    
    window.handleLogout = async () => {
        if(confirm("Yakin ingin keluar dari aplikasi?")) {
            await supabase.auth.signOut();
            localStorage.clear();
            window.location.replace('/index.html');
        }
    };
    
    // MOCK SOCKET.IO INTERFACES (Jembatan Realtime Data Map & Order)
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
    
    function initRealtimeBridge(role) {
        if (role === 'customer' || role === 'admin') {
            supabase.channel('public:driver_locations')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'driver_locations' }, payload => {
                    const loc = payload.new;
                    if (window.socketBridge.events['update_driver_map']) window.socketBridge.events['update_driver_map']({ id: loc.id, lat: loc.lat, lng: loc.lng });
                }).subscribe();
        }
        supabase.channel('public:orders')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
                if (role === 'driver' && window.socketBridge.events['new_order_broadcast']) window.socketBridge.events['new_order_broadcast'](payload.new.data);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
                if (role === 'customer' && window.socketBridge.events['order_status_changed']) window.socketBridge.events['order_status_changed'](payload.new);
            }).subscribe();
    }
}
