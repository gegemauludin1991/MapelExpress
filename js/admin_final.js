/**
 * ADMIN ENGINE - MAPEL EXPRESS V2
 * Fokus: Peta Super Ringan, CSS Murni Icon, Integrasi Database Anti Gagal
 */

// 1. CEK KONEKSI SUPABASE DARI db.js
const sb = window.sb || (typeof supabase !== 'undefined' ? supabase : null);

// 2. FUNGSI DESAIN ICON EKSPEDISI (CSS MURNI, GAK BAKAL PECAH)
function getIconEkspedisi(namaCabang) {
    let nama = namaCabang.toLowerCase();
    let iconFile = 'pin.png'; 
    let bgColor = '#ffffff'; // Dasar Putih

    // Logika baca nama ekspedisi
    if (nama.includes('jne')) iconFile = 'jne.png';
    else if (nama.includes('j&t') || nama.includes('jnt')) iconFile = 'jnt.png';
    else if (nama.includes('sicepat')) iconFile = 'sicepat.png';
    else if (nama.includes('shopee') || nama.includes('spx')) iconFile = 'spx.png';
    else if (nama.includes('ninja')) { iconFile = 'ninja.png'; bgColor = '#dc2626'; } // Merah utk Ninja
    else if (nama.includes('anteraja')) iconFile = 'anteraja.png';

    const htmlMarker = `
        <div style="display:flex; align-items:center; justify-content:center; width:40px; height:40px; background-color:${bgColor}; border-radius:50%; box-shadow:0 4px 10px rgba(0,0,0,0.3); border:3px solid white; overflow:hidden;">
            <img src="/assets/icons/${iconFile}" style="width:24px; height:24px; object-fit:contain;" onerror="this.src='/assets/icons/pin.png'" />
        </div>
    `;

    return L.divIcon({ 
        className: '', html: htmlMarker, iconSize: [40, 40], iconAnchor: [20, 20], popupAnchor: [0, -20] 
    });
}

// 3. INISIALISASI PETA LEAFLET
let eksMap = null;
let tempEksMarker = null;
let arrayMarkerEkspedisi = [];
const OFFICE = { lat: -6.977414, lng: 107.555359 }; 

if(document.getElementById('eks-map')) {
    eksMap = L.map('eks-map', { zoomControl: false }).setView([OFFICE.lat, OFFICE.lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(eksMap);
    
    // Pin Basecamp / Kantor Pusat
    const basecampIcon = L.icon({ iconUrl: '/assets/icons/pin.png', iconSize: [40, 40], iconAnchor: [20, 40], popupAnchor: [0, -35] });
    L.marker([OFFICE.lat, OFFICE.lng], { icon: basecampIcon }).addTo(eksMap).bindPopup("<b>Basecamp MapelExpress</b>");
    
    // Logic Tap/Klik Peta
    eksMap.on('click', function(e) {
        document.getElementById('f-eks-lat').value = e.latlng.lat.toFixed(6);
        document.getElementById('f-eks-lng').value = e.latlng.lng.toFixed(6);
        
        // Munculin pin biru sementara biar admin tau posisi yg ditap
        if(tempEksMarker) eksMap.removeLayer(tempEksMarker);
        tempEksMarker = L.marker(e.latlng).addTo(eksMap).bindPopup("<span style='font-size:12px; font-weight:bold;'>Lokasi Dipilih</span>").openPopup();
    });
}

// 4. FUNGSI TARIK DATA DARI DATABASE (TAMPIL DI PETA)
window.loadEkspedisi = async function() {
    if (!sb) {
        console.warn("Menunggu koneksi database...");
        setTimeout(window.loadEkspedisi, 1000);
        return;
    }
    
    try {
        const { data, error } = await sb.from('ekspedisi').select('*');
        if (data) {
            // Hapus pin lama biar ga numpuk
            arrayMarkerEkspedisi.forEach(m => m.remove());
            arrayMarkerEkspedisi = [];

            data.forEach(titik => {
                const iconEks = getIconEkspedisi(titik.nama); 
                
                // Tambah tombol hapus di popup
                const popupHTML = `
                    <div style="text-align:center; min-width:120px; font-family:sans-serif;">
                        <p style="font-weight:900; font-size:14px; margin-bottom:8px; color:#1f2937;">${titik.nama}</p>
                        <button onclick="window.hapusEkspedisi(${titik.id}, '${titik.nama}')" style="background:#fee2e2; color:#dc2626; border:1px solid #fecaca; padding:6px 10px; border-radius:6px; font-weight:bold; cursor:pointer; width:100%; font-size:12px;">🗑️ Hapus Gerai</button>
                    </div>
                `;

                if(eksMap) {
                    let marker = L.marker([titik.lat, titik.lng], { icon: iconEks }).addTo(eksMap).bindPopup(popupHTML);
                    arrayMarkerEkspedisi.push(marker);
                }
            });
        }
    } catch(err) { console.error("Gagal meload titik:", err); }
};

// Eksekusi load data
setTimeout(() => { window.loadEkspedisi(); }, 500);

// 5. FUNGSI SIMPAN KE DATABASE
window.simpanEkspedisi = async function() {
    const nama = document.getElementById('f-eks-nama').value;
    const latStr = document.getElementById('f-eks-lat').value;
    const lngStr = document.getElementById('f-eks-lng').value;
    
    if(!nama || !latStr || !lngStr) {
        alert("⚠️ Mohon isi Nama Cabang dan Tap Peta untuk kordinatnya!");
        return;
    }

    if(!sb) return alert("🚨 Gagal tersambung ke Database (Supabase)!");

    try {
        // Tembak ke Supabase
        const { error } = await sb.from('ekspedisi').insert([{ 
            nama: nama, 
            lat: parseFloat(latStr), 
            lng: parseFloat(lngStr) 
        }]);
        
        if (error) throw error;
        
        alert(`✅ Suksess! Titik "${nama}" berhasil diamankan di Database.`);
        
        // Bersihkan Inputan
        document.getElementById('f-eks-nama').value = '';
        document.getElementById('f-eks-lat').value = '';
        document.getElementById('f-eks-lng').value = '';
        if(tempEksMarker) eksMap.removeLayer(tempEksMarker);
        
        // Refresh pin di peta secara otomatis
        window.loadEkspedisi();
        
    } catch(e) {
        alert("❌ ERROR DATABASE: " + e.message);
    }
};

// 6. FUNGSI HAPUS TITIK DARI DATABASE
window.hapusEkspedisi = async function(id, nama) {
    if(!confirm(`Yakin ingin menghapus gerai "${nama}" secara permanen?`)) return;
    if(!sb) return;

    try {
        const { error } = await sb.from('ekspedisi').delete().eq('id', id);
        if (error) throw error;

        alert(`✅ Gerai ${nama} berhasil dihapus.`);
        window.loadEkspedisi(); // Refresh peta otomatis

    } catch(e) { alert("❌ Gagal Menghapus: " + e.message); }
};
