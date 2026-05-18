/**
 * DATABASE & SECURITY CONTROLLER
 */

// MASUKKAN URL & ANON KEY SUPABASE LU DI SINI
const SUPABASE_URL = 'https://XXXXXXXXXXXXX.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; 

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==========================================
// 1. FITUR LOGIN GOOGLE AUTH
// ==========================================
window.loginDenganGoogle = async function() {
    try {
        const { error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + '/app.html' }
        });
        if (error) alert("Gagal Login Google: " + error.message);
    } catch (err) { console.error("Error:", err); }
};

// ==========================================
// 2. FITUR LOGIN & DAFTAR MANUAL (EMAIL & PASS)
// ==========================================
window.registerManual = async function() {
    const name = document.getElementById('reg-name').value;
    const wa = document.getElementById('reg-wa').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    if (!name || !email || !password) return alert("Nama, Email, dan Password wajib diisi!");

    document.getElementById('btn-register').innerText = "Memproses...";
    
    // Daftar ke Supabase Auth (Otomatis ditangkap oleh Trigger SQL ke tabel profiles)
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: name, whatsapp: wa } }
    });

    if (error) {
        alert("Gagal Daftar: " + error.message);
        document.getElementById('btn-register').innerText = "Buat Akun";
    } else {
        alert("Pendaftaran Berhasil! Silakan Login.");
        window.toggleForm('login');
        document.getElementById('btn-register').innerText = "Buat Akun";
    }
};

window.loginManual = async function() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    if (!email || !password) return alert("Isi email dan password lu bro!");
    
    document.getElementById('btn-login').innerText = "Memeriksa...";

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        alert("Gagal Login: " + error.message);
        document.getElementById('btn-login').innerText = "Masuk";
    } else {
        // Biarkan proteksiHalaman() yang mengatur arah (routing) halamannya
        window.location.reload(); 
    }
};

// ==========================================
// 3. SISTEM SATPAM (ROLE-BASED ACCESS CONTROL)
// ==========================================
async function proteksiHalaman() {
    const path = window.location.pathname;
    const { data: { session } } = await supabase.auth.getSession();

    // SKENARIO A: Belum Login -> Tendang ke Halaman Login (index.html)
    if (!session && path !== '/' && !path.includes('index.html')) {
        window.location.replace('/index.html');
        return;
    }

    // SKENARIO B: Sudah Login
    if (session) {
        // Ambil role ASLI dari tabel profiles
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();

        const role = profile?.role || 'customer'; // Default aman

        // CEGAT PENYUSUP KE HALAMAN ADMIN
        if (path.includes('admin.html') && role !== 'admin') {
            alert('Akses Ditolak! Lu bukan Admin bos.');
            window.location.replace('/app.html');
            return;
        }
        
        // CEGAT PENYUSUP KE HALAMAN DRIVER
        if (path.includes('driver.html') && role !== 'driver') {
            alert('Akses Ditolak! Lu bukan Kurir.');
            window.location.replace('/app.html');
            return;
        }

        // Kalo udah login tapi iseng buka halaman index/login, arahin ke rumah masing-masing
        if (path === '/' || path.includes('index.html')) {
            if (role === 'admin') window.location.replace('/admin.html');
            else if (role === 'driver') window.location.replace('/driver.html');
            else window.location.replace('/app.html');
        }
    }
}

// Jalankan sekuriti
proteksiHalaman();
