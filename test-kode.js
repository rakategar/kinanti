const R_KODE = /\b([a-z]{2,8}[-_]?\d{1,4})\b/gi;

function normalizeKode(raw) {
  return String(raw).toUpperCase().trim();
}

const testCases = [
  "kumpul IPA1",
  "kumpul mtk-003",
  "detail RPL20",
  "IPA1",
  "MTK-003",
  "kumpul TKJ2",
];

testCases.forEach((text) => {
  console.log(`\nTest: "${text}"`);
  const m = R_KODE.exec(text);
  if (m) {
    console.log("  Match:", m[1]);
    console.log("  Normalized:", normalizeKode(m[1]));
  } else {
    console.log("  NO MATCH");
  }
  R_KODE.lastIndex = 0; // reset regex
});
