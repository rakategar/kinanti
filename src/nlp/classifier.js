// src/nlp/classifier.js
// Klasifier rule-based sederhana + skor confidence.

const { INTENTS } = require("./intents");

/**
 * Hitung skor keyword sederhana.
 */
function scoreKeywords(text, keywords = []) {
  let score = 0;
  for (const k of keywords) {
    if (!k) continue;
    // jika semua kata dalam frasa k ada di text, tambah 1
    const andTerms = k.split(/\s+/g).filter(Boolean);
    const ok = andTerms.every((w) => text.includes(w));
    if (ok) score += 1;
  }
  return score;
}

function classify(text, entities) {
  let best = { intent: "fallback", score: 0 };

  for (const [name, cfg] of Object.entries(INTENTS)) {
    let score = 0;

    // keywords
    score += scoreKeywords(text, cfg.keywords || []);

    // entitas yang disyaratkan - beri skor lebih tinggi jika ada
    if (cfg.needEntities) {
      for (const e of cfg.needEntities) {
        if (entities[e]) score += 1.5;
      }
    }

    // Boost untuk sapaan_help - prioritas tinggi untuk greeting
    if (
      name === "sapaan_help" &&
      /halo|hai|hey|hei|kinanti|help|bantuan|menu|assalamualaikum/.test(text)
    ) {
      score += 3; // Boost kuat untuk sapaan
    }

    // Boost untuk guru_buat_penugasan - prioritas tinggi
    if (
      name === "guru_buat_penugasan" &&
      /buat tugas|penugasan|tugas baru|tambah tugas/.test(text)
    ) {
      score += 4; // Boost kuat untuk buat tugas
    }

    // Boost untuk guru_rekap_excel
    if (name === "guru_rekap_excel" && /rekap/.test(text)) {
      score += 3;
    }

    // Boost untuk guru_list_siswa
    if (
      name === "guru_list_siswa" &&
      /list siswa|daftar siswa|data siswa/.test(text)
    ) {
      score += 3;
    }

    // Boost untuk guru_broadcast_tugas
    if (
      name === "guru_broadcast_tugas" &&
      /kirim tugas|broadcast|sebar tugas|umumkan/.test(text)
    ) {
      score += 3;
    }

    // Boost untuk siswa_kumpul_tugas jika ada keyword kumpul DAN ada kode
    if (name === "siswa_kumpul_tugas" && /kumpul/.test(text)) {
      score += 2; // Boost bahkan tanpa kode
      if (entities.kode || entities.kode_tugas || entities.assignmentCode) {
        score += 2; // Boost tambahan jika ada kode
      }
    }

    // Boost untuk siswa_detail_tugas jika ada keyword detail/info DAN ada kode
    if (name === "siswa_detail_tugas" && /detail|info/.test(text)) {
      if (entities.kode || entities.kode_tugas || entities.assignmentCode) {
        score += 2;
      }
    }

    // heuristik tambahan untuk intent guru lainnya
    if (
      name.startsWith("guru_") &&
      /kirim|penugasan|rekap|broadcast|siswa/.test(text)
    ) {
      score += 0.2;
    }

    if (score > best.score) best = { intent: name, score };
  }

  // Konversi skor → confidence kasar (maks 1)
  const confidence = Math.max(0, Math.min(1, best.score / 3));
  return { intent: best.intent, confidence, score: best.score };
}

module.exports = { classify };
