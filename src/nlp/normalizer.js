// src/nlp/normalizer.js
// Normalisasi teks WA: lowercase, hilangkan tanda baca, mapping slang umum.

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
  // lowercase
  let s = String(text).toLowerCase();

  // hilangkan emoji & karakter non huruf/angka kecuali spasi - _ /
  s = s.replace(/[^\p{L}\p{N}\s\-_\/]/gu, " ");

  // normalisasi spasi
  s = s.replace(/\s+/g, " ").trim();

  // mapping slang
  s = s
    .split(" ")
    .map((w) => SLANG[w] || w)
    .join(" ");

  return s;
}

module.exports = { normalize };
