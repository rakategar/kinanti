// src/nlp/intents.js
// Definisi intent + kata kunci (diperkaya) dan penyesuaian nama intent
// agar selaras dengan siswaController, guruController, dan server.js.

const INTENTS = {
  // =====================
  // UMUM (berlaku untuk semua)
  // =====================
  sapaan_help: {
    keywords: [
      "halo",
      "hai",
      "hai kinanti",
      "halo kinanti",
      "assalamualaikum",
      "assalamu'alaikum kinanti",
      "help",
      "bantuan",
      "menu",
      "mulai",
      "start",
      "kinanti",
      "hei kinanti",
      "hey kinanti",
    ],
  },

  img_to_pdf: {
    keywords: [
      "gambar ke pdf",
      "foto ke pdf",
      "img to pdf",
      "gambar jadi pdf",
      "convert gambar ke pdf",
      "gambar->pdf",
    ],
  },

  // Tambahan agar server.js juga bisa memicu via intent berprefiks guru_
  guru_img_to_pdf: {
    keywords: ["gambar ke pdf guru", "guru gambar ke pdf"],
  },

  // =====================
  // SISWA
  // =====================
  // Lihat daftar tugas yang belum selesai
  siswa_list_tugas: {
    keywords: [
      "tugas saya",
      "daftar tugas",
      "tugas aktif",
      "ada tugas",
      "list tugas",
      "tugas belum",
      "lihat tugas",
      "tugas apa aja",
    ],
  },

  // Cek status/riwayat pengumpulan
  siswa_status: {
    keywords: [
      "status tugas",
      "riwayat tugas",
      "cek status",
      "progress tugas",
      "sudah belum",
      "status",
    ],
    // (opsional: bisa tanpa kode)
  },

  // Detail tugas per kode
  siswa_detail_tugas: {
    keywords: [
      "detail",
      "info tugas",
      "informasi tugas",
      "lihat detail",
      "detail tugas",
    ],
    // dukung berbagai nama entitas agar kompatibel dengan pipeline yang berbeda
    needEntities: ["kode", "kode_tugas", "assignmentCode"],
  },

  // Mulai pengumpulan tugas (butuh kode)
  siswa_kumpul_tugas: {
    keywords: [
      "kumpul",
      "kumpulkan",
      "kumpulkan tugas",
      "upload tugas",
      "kirim tugas",
      "setor tugas",
      "ngumpul",
      "ngumpulin",
      "mau kumpul",
      "mau ngumpul",
      "ingin kumpul",
      "ingin ngumpul",
      "mengumpulkan tugas",
      "mengumpulkan",
      "mau mengumpulkan",
      "ingin mengumpulkan",
      "submit tugas",
      "submit",
    ],
    // HAPUS needEntities agar tetap terdeteksi tanpa kode
    // needEntities: ["kode", "kode_tugas", "assignmentCode"],
  },

  // Batalkan sesi kumpul (hanya aktif saat sesi pengumpulan berjalan)
  siswa_batal_kumpul: {
    keywords: ["batal kumpul", "cancel kumpul", "gak jadi kumpul"],
  },

  // Menu khusus siswa
  siswa_help: {
    keywords: ["bantuan siswa", "menu siswa"],
  },

  // =====================
  // GURU
  // =====================
  // Buat penugasan baru (wizard)
  guru_buat_penugasan: {
    keywords: [
      "penugasan",
      "buat tugas",
      "tambah tugas",
      "assignment",
      "tugas baru",
      "create assignment",
    ],
    // entity "kelas" biasanya diisi saat wizard, jadi tidak dipaksa di sini
  },

  // Broadcast/umumkan tugas ke kelas
  guru_broadcast_tugas: {
    keywords: [
      "kirim tugas",
      "broadcast tugas",
      "sebar tugas",
      "umumkan tugas",
      "bagikan tugas",
    ],
    needEntities: ["kode", "kode_tugas", "kelas"], // minimal butuh kode & kelas tujuan
  },

  // Rekap tugas ke Excel
  guru_rekap_excel: {
    keywords: [
      "rekap",
      "rekapan",
      "rekap excel",
      "excel tugas",
      "export excel",
    ],
  },

  // Lihat daftar siswa / data siswa
  guru_list_siswa: {
    keywords: ["list siswa", "daftar siswa", "lihat siswa", "data siswa"],
    // optional: kelas
  },

  // Menu khusus guru
  guru_help: {
    keywords: ["bantuan guru", "menu guru"],
  },

  // =====================
  // FALLBACK
  // =====================
  fallback: {
    keywords: [],
  },
};

module.exports = { INTENTS };
