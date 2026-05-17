/**
 * DATABASE & SECURITY CONTROLLER
 * Menghubungkan Supabase dan Mengamankan Halaman
 */

// MASUKKAN URL & ANON KEY SUPABASE LU DI SINI
const SUPABASE_URL = 'https://XXXXXXXXXXXXX.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; 

// Inisialisasi Supabase
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 1. FITUR LOGIN GOOGLE AUTH
// ==========================================
window.loginDenganGoogle = async function() {
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                // Habis login berhasil, langsung tendang ke halaman Customer
                redirectTo: window.location.origin + '/app.html' 
            }
        });
        if (error) alert("Gagal Login: " + error.message);
    } catch (err) {
        console.error("Error Google Auth:", err);
    }
};

// ==========================================
// 2. SISTEM SATPAM (ROLE-BASED ACCESS CONTROL)
// ==========================================
async function proteksiHalaman() {
    const path = window.location.pathname;
    const { data: { session } } = await supabase.auth.getSession();

    // Skenario A: Belum Login tapi maksa masuk halaman dalam -> Tendang ke index.html
    if (!session && path !== '/' && !path.includes('index.html')) {
        window.location.replace('/index.html');
        return;
    }

    // Skenario B: Sudah Login
    if (session) {
        // Ambil role (Kalo login dari Google, defaultnya kita anggap 'customer')
        const role = session.user.user_metadata?.role || 'customer';

        // Cegah penyusup masuk ke halaman Admin
        if (path.includes('admin.html') && role !== 'admin') {
            alert('Akses Ditolak! Ini Halaman Khusus Admin.');
            window.location.replace('/app.html');
            return;
        }
        
        // Cegah penyusup masuk ke halaman Driver
        if (path.includes('driver.html') && role !== 'driver') {
            alert('Akses Ditolak! Ini Halaman Khusus Driver.');
            window.location.replace('/app.html');
            return;
        }

        // Kalo udah login tapi iseng buka ulang halaman index/login -> Arahin ke dashboard masing-masing
        if (path === '/' || path.includes('index.html')) {
            if (role === 'admin') window.location.replace('/admin.html');
            else if (role === 'driver') window.location.replace('/driver.html');
            else window.location.replace('/app.html');
        }
    }
}

// Langsung jalankan satpamnya sesaat setelah file JS ini dipanggil oleh browser
proteksiHalaman();
