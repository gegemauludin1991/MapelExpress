// admin.js (Tambahkan script ini untuk fungsi pembuatan Driver)
import { supabase } from '/js/supabase.js';

window.simpanDriver = async function() {
    const nama = document.getElementById('d-nama').value;
    const wa = document.getElementById('d-wa').value;
    const nopol = document.getElementById('d-nopol').value;
    const tipe = document.getElementById('d-tipe').value;
    const warna = document.getElementById('d-warna').value;
    
    if(!nama || !wa || !nopol) { alert('Isi form dengan lengkap!'); return; }

    // Bikin email dummy otomatis berdasarkan WA atau Nama
    const emailDriver = `driver_${wa}@mapel.com`;
    const defaultPassword = "mapel" + wa.substring(wa.length - 4); // contoh: mapel7890

    alert(`Mendaftarkan Driver...\nEmail: ${emailDriver}\nPassword: ${defaultPassword}\n\nHarap catat dan berikan ke driver!`);

    // 1. Buat akun di Auth Supabase
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email: emailDriver,
        password: defaultPassword,
    });

    if (authError) {
        alert("Gagal bikin akun: " + authError.message);
        return;
    }

    // 2. Simpan identitas ke tabel Profiles dengan role driver
    const { error: profileError } = await supabase.from('profiles').insert([{
        id: authData.user.id,
        full_name: nama,
        whatsapp: wa,
        role: 'driver',
        // Kita bisa simpan data kendaraan di JSON atau kolom lain. 
        // Berhubung lu ga ada kolom khusus di skema, kita bisa simpan di tabel driver_locations sebagai init, 
        // ATAU ubah skema 'profiles' untuk tambah kolom nopol. Saran gue pake tabel app_settings sementara.
    }]);

    if (profileError) {
        console.error("Gagal simpan profil: ", profileError);
    } else {
        alert('Driver Berhasil Dibuat!');
        // Panggil fungsi render driver ulang
        // window.renderTableDriverAdmin();
    }
}
