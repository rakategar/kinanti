// Debug extraction for MTK-003

const { normalize } = require("./src/nlp/normalizer");
const { extractEntities } = require("./src/nlp/entities");

const testInputs = [
  "MTK-003",
  "mtk-003",
  "saya ingin mengumpulkan tugas MTK-003",
  "kumpulkan tugas",
];

console.log("=== Testing Normalization and Entity Extraction ===\n");

testInputs.forEach((input) => {
  console.log(`Input: "${input}"`);
  const normalized = normalize(input);
  console.log(`  Normalized: "${normalized}"`);
  const entities = extractEntities(normalized);
  console.log(`  Entities:`, entities);
  console.log();
});
