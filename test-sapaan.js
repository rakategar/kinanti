// test-sapaan.js
// Test untuk memastikan sapaan tidak terdeteksi sebagai kode tugas

console.log("🧪 ========== TEST SAPAAN vs KODE TUGAS ==========\n");

// Daftar kata umum (sama seperti di entities.js)
const COMMON_WORDS = new Set([
  'kumpul', 'kumpulkan', 'mengumpulkan', 'detail', 'info', 'tugas', 'saya', 
  'ingin', 'mau', 'status', 'riwayat', 'lihat', 'cek', 'ada', 'yang', 'apa',
  'tentang', 'untuk', 'dari', 'dengan', 'adalah', 'ini', 'itu', 'guru', 'siswa',
  // Sapaan & nama bot
  'halo', 'hai', 'hey', 'hei', 'kinanti', 'assalamualaikum', 'help', 'bantuan',
  'menu', 'mulai', 'start', 'selamat', 'pagi', 'siang', 'sore', 'malam'
]);

// Regex baru (sama seperti di entities.js)
const R_KODE = /\b([A-Z]{2,15}(?:\d+|[-_][A-Z0-9]+)*)\b/g;

function normalizeKode(raw) {
  return String(raw).toUpperCase().trim();
}

function extractKode(text) {
  const textUpper = text.toUpperCase();
  R_KODE.lastIndex = 0;
  let m;
  while ((m = R_KODE.exec(textUpper)) !== null) {
    const raw = m[1];
    const normalized = normalizeKode(raw);
    
    // Skip jika kata umum
    if (COMMON_WORDS.has(normalized.toLowerCase())) {
      continue;
    }
    
    // Skip jika hanya huruf dan terlalu umum (kurang dari 4 karakter)
    if (!/\d/.test(normalized) && !/[-_]/.test(normalized) && normalized.length < 4) {
      continue;
    }
    
    return normalized;
  }
  return null;
}

// Test cases: sapaan yang TIDAK boleh terdeteksi sebagai kode
const sapaanTests = [
  { input: "hai kinanti", expected: null, desc: "Sapaan 'hai kinanti'" },
  { input: "halo kinanti", expected: null, desc: "Sapaan 'halo kinanti'" },
  { input: "hey kinanti", expected: null, desc: "Sapaan 'hey kinanti'" },
  { input: "KINANTI", expected: null, desc: "Nama bot saja" },
  { input: "hai kinanti !", expected: null, desc: "Sapaan dengan tanda seru" },
  { input: "assalamualaikum kinanti", expected: null, desc: "Sapaan Islam" },
  { input: "help", expected: null, desc: "Keyword help" },
  { input: "bantuan", expected: null, desc: "Keyword bantuan" },
  { input: "menu", expected: null, desc: "Keyword menu" },
  { input: "selamat pagi kinanti", expected: null, desc: "Sapaan waktu" },
  { input: "halo", expected: null, desc: "Sapaan halo saja" },
  // Tetap harus bisa detect kode tugas yang valid
  { input: "hai kinanti, kumpul IPA1", expected: "IPA1", desc: "Sapaan + kode valid" },
  { input: "detail TANAMAN", expected: "TANAMAN", desc: "Kode tugas TANAMAN" },
  { input: "kumpul BIOLOGI", expected: "BIOLOGI", desc: "Kode tugas BIOLOGI" },
];

let passed = 0;
let failed = 0;

console.log("📝 Test Results:\n");

sapaanTests.forEach((t, i) => {
  const result = extractKode(t.input);
  const ok = result === t.expected;
  
  if (ok) {
    console.log(`✅ Test ${i + 1}: ${t.desc}`);
    console.log(`   Input: "${t.input}" → ${result ?? "null"}`);
    passed++;
  } else {
    console.log(`❌ Test ${i + 1}: ${t.desc}`);
    console.log(`   Input: "${t.input}"`);
    console.log(`   Expected: ${t.expected ?? "null"}, Got: ${result ?? "null"}`);
    failed++;
  }
});

console.log(`\n🎯 ========== TEST SUMMARY ==========`);
console.log(`Total: ${sapaanTests.length} tests`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ❌`);

if (failed === 0) {
  console.log("\n🎉 ALL TESTS PASSED!");
} else {
  console.log("\n⚠️  Some tests failed. Please review.");
}
