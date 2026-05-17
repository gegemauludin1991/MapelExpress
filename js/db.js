// ========================================================================
// FILE: js/db.js (ENGINE DATABASE SUPABASE & AUTH)
// VERSI: Vercel Production Ready (Anti Race-Condition)
// ========================================================================

const SUPABASE_URL = 'https://nahgibyegdeioquryfde.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5haGdpYnllZ2RlaW9xdXJ5ZmRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODM3NjksImV4cCI6MjA5NDE1OTc2OX0.NeN2uqRTKEJyc0SOEIV5iUQIIOGf88A46KRJffGUKmQ';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let userProfile = null;
let isReady = false; 
const path = window.location.pathname;

// Deteksi Role berdasarkan nama halaman
let requiredRole = null;
if (path.includes('admin.html')) requiredRole = 'admin';
else if (path.includes('driver.html')) requiredRole = 'driver';
else if (path.includes('app.html')) requiredRole = 'customer';

// 1. SISTEM PROTEKSI & LOGIN
async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Tendang ke halaman login kalau belum masuk
    if (!session && requiredRole) {
        window.location.replace('/index.html');
        return;
    }

    if (session) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (profile) {
            userProfile = profile;
            
            // Satpam Role (Driver dilarang masuk Admin, dst)
            if (requiredRole && profile.role !== requiredRole) {
                if (profile.role === 'admin') window.location.replace('/admin.html');
                else if (profile.role === 'driver') window.location.replace('/driver.html');
                else window.location.replace('/app.html');
                return;
            }
            
            isReady = true; 
            if (requiredRole) initRealtimeBridge();
        } else {
            await supabase.auth.signOut();
            window.location.replace('/index.html');
        }
    }
}
checkAuth();

window.handleLogout = async () => {
    if(confirm("Yakin ingin keluar?")) {
        await supabase.auth.signOut();
        window.location.replace('/index.html');
    }
};

// 2. MOCK SOCKET.IO (JEMBATAN AJAIB KE KODE LAMA)
window.socketBridge = {
    events: {},
    on: function(eventName, callback) {
        this.events[eventName] = callback;
    },
    emit: async function(eventName, data) {
        if (!isReady || !userProfile) return; 

        try {
            // Memancarkan GPS ke Radar Admin/Customer
            if (eventName === 'updateLocation') {
                await supabase.from('driver_locations').upsert([{
                    id: userProfile.id, lat: data.lat, lng: data.lng,
                    data: { name: userProfile.full_name, nopol: userProfile.whatsapp },
                    updated_at: new Date()
                }]);
            }
            // Customer Membuat Order
            else if (eventName === 'newOrder') {
                const orderId = 'ORD-' + Math.random().toString(36).substr(2, 9).toUpperCase();
                data.customer_id = userProfile.id;
                data.customer_name = userProfile.full_name;
                data.customer_wa = userProfile.whatsapp;

                await supabase.from('orders').insert([{
                    id: orderId, status: 'pending', data: data
                }]);
            }
            // Driver Terima/Selesaikan Order
            else if (eventName === 'updateOrderStatus' || eventName === 'updateOrder') {
                const targetId = data.orderId || data.id;
                await supabase.from('orders').update({ status: data.status }).eq('id', targetId);
            }
        } catch(err) {
            console.error("[Bridge Error]:", err);
        }
    }
};

// 3. RECEIVER SUPABASE (Nangkap Perubahan Database Live)
function initRealtimeBridge() {
    // Pantau GPS (Khusus Customer & Admin)
    if (requiredRole === 'customer' || requiredRole === 'admin') {
        supabase.channel('public:driver_locations')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'driver_locations' }, payload => {
                const loc = payload.new;
                if (window.socketBridge.events['driverMoved']) {
                    window.socketBridge.events['driverMoved']({
                        id: loc.id, lat: loc.lat, lng: loc.lng, ...loc.data
                    });
                }
            }).subscribe();
    }

    // Pantau Orderan (Driver terima pop-up, Customer terima update status)
    supabase.channel('public:orders')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
            if (requiredRole === 'driver' && window.socketBridge.events['incomingOrder']) {
                window.socketBridge.events['incomingOrder'](payload.new);
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
            const updatedOrder = payload.new;
            if (requiredRole === 'customer' && updatedOrder.data.customer_id === userProfile.id) {
                if (window.socketBridge.events['orderUpdated']) {
                    window.socketBridge.events['orderUpdated'](updatedOrder);
                }
            }
        }).subscribe();
}
