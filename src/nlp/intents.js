// src/nlp/intents.js
// Definisi intent + kata kunci minimal (bisa kamu kembangkan).

const INTENTS = {
  // *** SISWA ***
  siswa_kumpul_tugas: {
    keywords: ["kumpul", "upload tugas", "kirim tugas", "setor tugas"],
    needEntities: ["kode_tugas"],
  },
  siswa_tanya_tugas_aktif: {
    keywords: [
      "tugas apa",
      "tugas aktif",
      "ada tugas",
      "list tugas",
      "daftar tugas",
    ],
  },
  siswa_tanya_deadline: {
    keywords: [
      "deadline",
      "batas pengumpulan",
      "kapan terakhir",
      "kapan ngumpul",
    ],
    needEntities: ["kode_tugas"],
  },
  siswa_status_tugas: {
    keywords: ["status tugas", "sudah belum", "progress tugas", "cek status"],
    // optional kode_tugas
  },
  siswa_batal_kumpul: {
    keywords: ["batal kumpul", "cancel kumpul", "gak jadi kumpul"],
  },

  // *** GURU ***
  guru_buat_penugasan: {
    keywords: ["penugasan", "buat tugas", "tambah tugas", "assignment"],
    needEntities: ["kelas"], // opsional di tahap wizard
  },
  guru_broadcast_tugas: {
    keywords: ["kirim tugas", "broadcast tugas", "sebar tugas"],
    needEntities: ["kode_tugas", "kelas"],
  },
  guru_rekap_excel: {
    keywords: ["rekap", "rekapan", "rekap excel", "excel tugas"],
  },
  guru_list_siswa: {
    keywords: ["list siswa", "daftar siswa"],
    // optional kelas
  },

  // *** UMUM ***
  sapaan_help: {
    keywords: ["halo", "hai", "assalamualaikum", "help", "bantuan", "menu"],
  },
  fallback: {
    keywords: [],
  },
};

module.exports = { INTENTS };
