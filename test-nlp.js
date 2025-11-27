// Test normalization and intent detection

const SLANG = {
  gmn: "gimana",
  gmna: "gimana",
  gmnya: "gimana",
  ngumpulin: "kumpul",
  ngumpul: "kumpul",
  kumpulin: "kumpul",
  kumpulkan: "kumpul",
  mengumpulkan: "kumpul",
  uplod: "upload",
  uplot: "upload",
  uploud: "upload",
  tgskah: "tugas",
  tgs: "tugas",
  tg: "tugas",
  mapel: "mata pelajaran",
  pelajaran: "mata pelajaran",
  besuk: "besok",
  mau: "ingin",
  pengen: "ingin",
};

function normalize(text) {
  if (!text) return "";
  let s = String(text).toLowerCase();
  s = s.replace(/[^\p{L}\p{N}\s\-_\/]/gu, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s
    .split(" ")
    .map((w) => SLANG[w] || w)
    .join(" ");
  return s;
}

const keywords = [
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
];

function scoreKeywords(text, keywords = []) {
  let score = 0;
  for (const k of keywords) {
    if (!k) continue;
    const andTerms = k.split(/\s+/g).filter(Boolean);
    const ok = andTerms.every((w) => text.includes(w));
    if (ok) score += 1;
  }
  return score;
}

const testCases = [
  "kumpulkan tugas",
  "saya ingin mengumpulkan tugas",
  "mau kumpul tugas",
  "ngumpulin tugas",
  "kumpul IPA1",
];

console.log("Testing normalization and intent detection:\n");
testCases.forEach((text) => {
  const normalized = normalize(text);
  const score = scoreKeywords(normalized, keywords);
  console.log(`Input: "${text}"`);
  console.log(`  Normalized: "${normalized}"`);
  console.log(`  Score: ${score}`);
  console.log(`  Intent: ${score > 0 ? "siswa_kumpul_tugas" : "fallback"}\n`);
});
