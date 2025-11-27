// Test script untuk siswa controller
const { normalize } = require("./src/nlp/normalizer");
const { extractEntities } = require("./src/nlp/entities");
const { classify } = require("./src/nlp/classifier");

console.log("🧪 ========== TEST SISWA CONTROLLER ==========\n");

// Mock data
const testCases = [
  {
    name: "Test 1: Kumpul dengan kode langsung",
    input: "saya ingin mengumpulkan tugas MTK-003",
    expectedIntent: "siswa_kumpul_tugas",
    expectedKode: "MTK-003",
  },
  {
    name: "Test 2: Kumpul tanpa kode",
    input: "kumpulkan tugas",
    expectedIntent: "siswa_kumpul_tugas",
    expectedKode: null,
  },
  {
    name: "Test 3: Jawaban kode saja",
    input: "MTK-003",
    expectedIntent: "fallback or siswa_detail_tugas",
    expectedKode: "MTK-003",
  },
  {
    name: "Test 4: Kumpul IPA1",
    input: "kumpul IPA1",
    expectedIntent: "siswa_kumpul_tugas",
    expectedKode: "IPA1",
  },
];

testCases.forEach((test, idx) => {
  console.log(`\n${idx + 1}. ${test.name}`);
  console.log(`   Input: "${test.input}"`);

  const normalized = normalize(test.input);
  console.log(`   Normalized: "${normalized}"`);

  const entities = extractEntities(normalized);
  console.log(`   Entities:`, entities);

  const { intent, score } = classify(normalized, entities);
  console.log(`   Intent: ${intent} (score: ${score})`);
  console.log(`   Expected: ${test.expectedIntent}`);

  // Simulasi ekstraksi kode seperti di controller
  let kumpulKode = null;
  if (intent === "siswa_kumpul_tugas") {
    const rawKode =
      entities?.kode || entities?.kode_tugas || entities?.assignmentCode;
    if (rawKode) {
      kumpulKode = String(rawKode).trim();
    }
  }

  // Fallback regex
  if (!kumpulKode) {
    const m = test.input.toLowerCase().match(/kumpul\s+([a-z0-9_-]+)/i);
    if (m) kumpulKode = m[1].toUpperCase();
  }

  console.log(`   Extracted kode: ${kumpulKode || "null"}`);
  console.log(`   Expected: ${test.expectedKode || "null"}`);
  console.log(
    `   ✅ Result: ${kumpulKode === test.expectedKode ? "PASS" : "FAIL"}`
  );
});

console.log("\n\n🔍 ========== DETAILED ENTITY EXTRACTION TEST ==========\n");

const detailTests = [
  "MTK-003",
  "mtk-003",
  "IPA1",
  "ipa1",
  "kumpul MTK-003",
  "kumpulkan tugas MTK-003",
];

detailTests.forEach((input) => {
  const normalized = normalize(input);
  const entities = extractEntities(normalized);
  console.log(
    `"${input}" → normalized: "${normalized}" → kode: ${
      entities.kode || "null"
    }`
  );
});

console.log("\n🎯 ========== TEST COMPLETE ==========\n");
