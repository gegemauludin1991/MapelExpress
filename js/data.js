/**
 * SIMULASI DATABASE INTERNAL MAPEL EXPRESS
 * (Menggantikan sistem radar Overpass API / OSM)
 */

// Koordinat Basecamp MapelExpress
const BASECAMP = {
    lat: -6.977414, 
    lng: 107.555359,
    name: "Kantor MapelExpress"
};

// 1. Ini simulasi data yang nantinya ditarik dari Database Server lu (MySQL/Firebase)
const databaseInternal = [
    { 
        id: 'db_jnt_1', 
        name: 'J&T Express Margaasih', 
        lat: -6.976414,  // Posisi dibikin deket kantor
        lng: 107.554359 
    },
    { 
        id: 'db_jne_1', 
        name: 'JNE Cabang Margaasih', 
        lat: -6.978414, 
        lng: 107.556359 
    },
    { 
        id: 'db_ninja_1', 
        name: 'Ninja Xpress Taman Kopo', 
        lat: -6.974414, 
        lng: 107.558359 
    },
    { 
        id: 'db_sicepat_1', 
        name: 'SiCepat Ekspres', 
        lat: -6.979414, 
        lng: 107.552359 
    }
];

// Kosongkan list awal biar ngga ada duplikat pin pas peta dimuat
let ekspedisiList = [];

// 2. Fungsi ini sekarang bertugas murni narik data dari "Database" lu
async function scanEkspedisiSekitar() {
    console.log("Memuat data dari Database Internal MapelExpress...");
    
    // Tarik data dari database (Simulasi)
    ekspedisiList = [...databaseInternal];
    
    // Kita hapus cache lama biar bersih, dan simpan data baru
    localStorage.removeItem('mapel_ekspedisi');
    localStorage.setItem('mapel_ekspedisi', JSON.stringify(ekspedisiList));
    
    // Kembalikan jumlah data biar app.js tau ada data baru dan langsung ngerender pin
    return ekspedisiList.length;
}
