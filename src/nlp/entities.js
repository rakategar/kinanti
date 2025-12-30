// src/nlp/entities.js
// Ekstraksi entitas dasar: kode tugas, kelas, tanggal relatif (placeholder).

// Daftar kata umum yang BUKAN kode tugas
const COMMON_WORDS = new Set([
  "kumpul",
  "kumpulkan",
  "mengumpulkan",
  "detail",
  "info",
  "tugas",
  "saya",
  "ingin",
  "mau",
  "status",
  "riwayat",
  "lihat",
  "cek",
  "ada",
  "yang",
  "apa",
  "tentang",
  "untuk",
  "dari",
  "dengan",
  "adalah",
  "ini",
  "itu",
  "guru",
  "siswa",
  // Sapaan & nama bot
  "halo",
  "hai",
  "hey",
  "hei",
  "kinanti",
  "assalamualaikum",
  "help",
  "bantuan",
  "menu",
  "mulai",
  "start",
  "selamat",
  "pagi",
  "siang",
  "sore",
  "malam",
  // Kata kerja umum fitur
  "buat",
  "tambah",
  "kirim",
  "rekap",
  "broadcast",
  "sebar",
  "umumkan",
  "bagikan",
  "list",
  "daftar",
  "data",
  "gambar",
  "foto",
  "convert",
  "ubah",
  // Perintah wizard
  "simpan",
  "batal",
  "cancel",
  "lewati",
  "skip",
  "selesai",
  "done",
  "ya",
  "tidak",
  // Kata umum dari nama file
  "soal",
  "jawaban",
  "kunci",
  "ujian",
  "latihan",
  "materi",
  "modul",
  "buku",
  "uraian",
  "pilihan",
  "ganda",
  "essay",
  "dokumen",
  "file",
  "lampiran",
  // Kata umum lainnya (bisa dari nama file)
  "bunga",
  "hewan",
  "tumbuhan",
  "manusia",
  "alam",
  "dunia",
  "indonesia",
  "bahasa",
  "contoh",
  "hasil",
  "nilai",
  "test",
  "quiz",
  "ulangan",
  "praktik",
  "teori",
]);

// Regex untuk menangkap kode tugas apa adanya (dengan atau tanpa dash dan angka)
// Pattern yang lebih spesifik:
// 1. Kode dengan angka langsung: MTK001, IPA1, TKJ2
// 2. Kode dengan dash/underscore: IPA-1, TKJ_2, IPA-SALINAN
// 3. Kode uppercase minimal 4 huruf tanpa kata umum: TANAMAN, BIOLOGI
const R_KODE = /\b([A-Z]{2,15}(?:\d+|[-_][A-Z0-9]+)*)\b/g;

// Contoh kelas: X TKJ 1, XI RPL 2, XII PPLG 3, tanpa spasi juga boleh: XTKJ1
const R_KELAS = /\b(x|xi|xii)\s*([a-z]{2,6})\s*(\d{1,2})\b/gi;

function normalizeKode(raw) {
  // Uppercase saja, JANGAN ubah format dash
  return String(raw).toUpperCase().trim();
}

/**
 * Normalisasi kelas jadi bentuk X/Tingkat + JURUSAN + NO tanpa spasi, e.g., XIITKJ2
 */
function normalizeKelas(tingkat, jurusan, nomor) {
  const t = String(tingkat).toUpperCase().replace(/\s+/g, "");
  const j = String(jurusan).toUpperCase().replace(/\s+/g, "");
  const n = String(nomor).replace(/\s+/g, "");
  return `${t}${j}${n}`;
}

/**
 * Placeholder parser tanggal relatif (Bisa dikembangkan kemudian)
 * Kembalikan null untuk MVP; atau mapping sederhana "besok", "lusa", "hari ini".
 */
function parseRelativeDate(text, now = new Date()) {
  const s = text;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  if (/\bbesok\b/.test(s)) return new Date(now.getTime() + ONE_DAY);
  if (/\blusa\b/.test(s)) return new Date(now.getTime() + 2 * ONE_DAY);
  if (/\bhari ini\b/.test(s)) return now;
  return null;
}

function extractEntities(text) {
  const entities = {
    kode_tugas: null,
    kode: null, // alias untuk kompatibilitas
    assignmentCode: null, // alias lain
    kelas: null,
    tanggal: null, // Date jika berhasil parse
  };

  // KODE TUGAS - uppercase dulu karena regex kita uppercase-only
  const textUpper = text.toUpperCase();
  R_KODE.lastIndex = 0; // Reset regex state
  let m;
  while ((m = R_KODE.exec(textUpper)) !== null) {
    const raw = m[1];
    const normalized = normalizeKode(raw);

    // Skip jika kata umum
    if (COMMON_WORDS.has(normalized.toLowerCase())) {
      continue;
    }

    // Skip jika hanya huruf dan terlalu umum (kurang dari 4 karakter)
    if (
      !/\d/.test(normalized) &&
      !/[-_]/.test(normalized) &&
      normalized.length < 4
    ) {
      continue;
    }

    entities.kode_tugas = normalized;
    entities.kode = normalized;
    entities.assignmentCode = normalized;
    break;
  }

  // KELAS
  R_KELAS.lastIndex = 0; // Reset regex state
  while ((m = R_KELAS.exec(text)) !== null) {
    const tingkat = m[1];
    const jurusan = m[2];
    const nomor = m[3];
    entities.kelas = normalizeKelas(tingkat, jurusan, nomor);
    break;
  }

  // TANGGAL RELATIF (sederhana)
  entities.tanggal = parseRelativeDate(text);

  return entities;
}

module.exports = { extractEntities, parseRelativeDate };
