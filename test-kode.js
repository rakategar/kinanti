// test-kode.js
// Test regex kode tugas untuk berbagai format (UPDATED)

console.log("🧪 ========== TEST KODE TUGAS REGEX ==========\n");

// Daftar kata umum (sama seperti di entities.js)
const COMMON_WORDS = new Set([
  'kumpul', 'kumpulkan', 'mengumpulkan', 'detail', 'info', 'tugas', 'saya', 
  'ingin', 'mau', 'status', 'riwayat', 'lihat', 'cek', 'ada', 'yang', 'apa',
  'tentang', 'untuk', 'dari', 'dengan', 'adalah', 'ini', 'itu', 'guru', 'siswa'
]);

// Regex baru (sama seperti di entities.js)
const R_KODE = /\b([A-Z]{2,15}(?:\d+|[-_][A-Z0-9]+)*)\b/g;

function normalizeKode(raw) {
  return String(raw).toUpperCase().trim();
}

function extractKode(text) {
  const textUpper = text.toUpperCase(); // Uppercase dulu seperti di entities.js
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
    if (!/\d/.test(normalized) && !/[-_]/.test(normalized) && normalized.length < 4) {
      continue;
    }
    
    return normalized;
  }
  return null;
}

// Test cases
const testCases = [
  // Format standar dengan angka
  { input: "kumpul IPA1", expected: "IPA1", description: "Huruf + angka (tanpa dash)" },
  { input: "kumpul MTK-003", expected: "MTK-003", description: "Huruf + dash + angka" },
  { input: "kumpul FIS_02", expected: "FIS_02", description: "Huruf + underscore + angka" },
  
  // Format tanpa angka (PENTING - BUG FIX!)
  { input: "kumpul TANAMAN", expected: "TANAMAN", description: "Huruf saja (tanpa angka)" },
  { input: "kumpul BIOLOGI", expected: "BIOLOGI", description: "Huruf panjang" },
  { input: "TANAMAN", expected: "TANAMAN", description: "Kode saja (tanpa kata kumpul)" },
  
  // Format dengan salinan/suffix
  { input: "kumpul IPA1-SALINAN1", expected: "IPA1-SALINAN1", description: "Kode + dash + suffix" },
  { input: "kumpul MTK-003-COPY", expected: "MTK-003-COPY", description: "Kode + dash + text suffix" },
  
  // Format campuran
  { input: "kumpul TKJ2", expected: "TKJ2", description: "3 huruf + 1 angka" },
  { input: "kumpul RPL20", expected: "RPL20", description: "3 huruf + 2 angka" },
  { input: "kumpul MTK192", expected: "MTK192", description: "3 huruf + 3 angka" },
  
  // Case sensitive test
  { input: "kumpul tanaman", expected: "TANAMAN", description: "Lowercase → uppercase" },
  { input: "kumpul TANAMAN", expected: "TANAMAN", description: "Uppercase → uppercase" },
  
  // Dalam kalimat penuh
  { input: "saya ingin mengumpulkan tugas TANAMAN", expected: "TANAMAN", description: "Dalam kalimat panjang" },
  
  // Edge cases
  { input: "kumpul A", expected: null, description: "Terlalu pendek (1 huruf)" },
  { input: "kumpul AB", expected: "AB", description: "Minimal 2 huruf OK" },
];

// Run tests
let passed = 0;
let failed = 0;

console.log("📝 Test Results:\n");

testCases.forEach((test, index) => {
  const result = extractKode(test.input);
  const isPass = result === test.expected;
  
  if (isPass) {
    passed++;
    console.log(`✅ Test ${index + 1}: ${test.description}`);
    console.log(`   Input: "${test.input}" → ${result}`);
  } else {
    failed++;
    console.log(`❌ Test ${index + 1}: ${test.description}`);
    console.log(`   Input: "${test.input}"`);
    console.log(`   Expected: ${test.expected}, Got: ${result}`);
  }
});

console.log();
console.log("🎯 ========== TEST SUMMARY ==========");
console.log(`Total: ${testCases.length} tests`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ${failed > 0 ? "❌" : ""}`);

if (failed === 0) {
  console.log("\n🎉 ALL TESTS PASSED!");
}

// Bug fix verification
console.log("\n🐛 ========== BUG FIX VERIFICATION ==========");
console.log("Original Bug: 'kumpul TANAMAN' tidak terdeteksi\n");

const bugTests = ["kumpul TANAMAN", "TANAMAN", "saya ingin mengumpulkan tugas TANAMAN"];
let allFixed = true;

bugTests.forEach((input) => {
  const result = extractKode(input);
  const fixed = result === "TANAMAN";
  console.log(`${fixed ? "✅" : "❌"} "${input}" → ${result || "NULL"}`);
  if (!fixed) allFixed = false;
});

console.log(`\n${allFixed ? "✅ BUG FIXED!" : "❌ BUG STILL EXISTS!"}`);

console.log("\n📚 Pattern: [a-z]{2,15}(?:[-_]\\d{0,4})?(?:[-_][a-z0-9]+)?");
console.log("   ✅ Supports: IPA1, MTK-003, TANAMAN, IPA1-SALINAN1");
