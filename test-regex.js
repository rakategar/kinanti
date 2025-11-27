const text = "IPA1";
const R_KODE = /\b([a-z]{2,8})[-_]?(\d{1,4})\b/gi;
let m;
console.log("Testing:", text);
while ((m = R_KODE.exec(text)) !== null) {
  console.log("Match found:", m);
  console.log("Seri:", m[1]);
  console.log("Num:", m[2]);
}

const text2 = "kumpul IPA1";
const R_KODE2 = /\b([a-z]{2,8})[-_]?(\d{1,4})\b/gi;
let m2;
console.log("\nTesting:", text2);
while ((m2 = R_KODE2.exec(text2)) !== null) {
  console.log("Match found:", m2);
  console.log("Seri:", m2[1]);
  console.log("Num:", m2[2]);
}
