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

    // entitas yang disyaratkan
    if (cfg.needEntities) {
      for (const e of cfg.needEntities) {
        if (entities[e]) score += 1.5;
      }
    }

    // heuristik tambahan
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
