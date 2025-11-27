const R_KODE = /\b([a-z]{2,8}[-_]?\d{1,4})\b/gi;

const tests = ["MTK-003", "mtk-003", "MTK003", "mtk003", "IPA1", "ipa1"];

tests.forEach((test) => {
  R_KODE.lastIndex = 0; // reset
  const match = R_KODE.exec(test);
  console.log(`"${test}" -> ${match ? match[1] : "NO MATCH"}`);
});
