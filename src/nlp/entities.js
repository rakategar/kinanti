// src/nlp/entities.js
// Ekstraksi entitas dasar: kode tugas, kelas, tanggal relatif (placeholder).

// GANTI R_KODE lama dengan ini:
// huruf 2-8 + opsional '-' + angka 1-4. (huruf saja di grup1, angka di grup2)
const R_KODE = /\b([a-z]{2,8})[-_]?(\d{1,4})\b/gi;

// Contoh kelas: X TKJ 1, XI RPL 2, XII PPLG 3, tanpa spasi juga boleh: XTKJ1
const R_KELAS = /\b(x|xi|xii)\s*([a-z]{2,6})\s*(\d{1,2})\b/gi;

function normalizeKode(seri, num) {
  const s = String(seri)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  const n = String(num).replace(/\D/g, "");
  // Tidak padding paksa: MTK123 tetap MTK-123 (kalau mau pad 2 digit, aktifkan padStart)
  return `${s}-${n}`;
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
    kelas: null,
    tanggal: null, // Date jika berhasil parse
  };

  // KODE TUGAS
  let m;
  while ((m = R_KODE.exec(text)) !== null) {
    // ambil match pertama yang "masuk akal"
    const seri = m[1];
    const num = m[2];
    entities.kode_tugas = normalizeKode(seri, num);
    break;
  }

  // KELAS
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
