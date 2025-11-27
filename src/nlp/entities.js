// src/nlp/entities.js
// Ekstraksi entitas dasar: kode tugas, kelas, tanggal relatif (placeholder).

// Regex untuk menangkap kode tugas apa adanya (dengan atau tanpa dash)
// Pattern: 2-8 huruf + optional dash/underscore + 1-4 digit
const R_KODE = /\b([a-z]{2,8}[-_]?\d{1,4})\b/gi;

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

  // KODE TUGAS - ambil apa adanya
  R_KODE.lastIndex = 0; // Reset regex state
  let m;
  while ((m = R_KODE.exec(text)) !== null) {
    // ambil match pertama, normalize hanya uppercase
    const raw = m[1];
    const normalized = normalizeKode(raw);
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
