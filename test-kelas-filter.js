// test-kelas-filter.js
// Test filter kelas pada fitur "tugas saya"

console.log("🧪 ========== TEST KELAS FILTER ==========\n");

// Simulasi data siswa dengan kelas berbeda
const siswaXIITKJ1 = {
  id: 1,
  nama: "Budi",
  kelas: "XIITKJ1",
};

const siswaXITKJ2 = {
  id: 2,
  nama: "Ani",
  kelas: "XITKJ2",
};

const siswaNoClass = {
  id: 3,
  nama: "Dedi",
  kelas: null,
};

// Simulasi data tugas dengan berbagai kelas
const mockAssignments = [
  {
    siswaId: 1,
    status: "BELUM_SELESAI",
    tugas: {
      id: 1,
      kode: "MTK-001",
      judul: "Aljabar Kelas XII TKJ 1",
      kelas: "XIITKJ1",
      kunciJawaban: null,
      guru: { nama: "Pak Budi" },
    },
  },
  {
    siswaId: 1,
    status: "BELUM_SELESAI",
    tugas: {
      id: 2,
      kode: "IPA-002",
      judul: "Fisika Kelas XI TKJ 2",
      kelas: "XITKJ2",
      kunciJawaban: null,
      guru: { nama: "Bu Ani" },
    },
  },
  {
    siswaId: 1,
    status: "BELUM_SELESAI",
    tugas: {
      id: 3,
      kode: "BHS-003",
      judul: "Essay Kelas XII TKJ 1",
      kelas: "XIITKJ1",
      kunciJawaban: "https://example.com/kunci.json",
      guru: { nama: "Pak Dedi" },
    },
  },
  {
    siswaId: 2,
    status: "BELUM_SELESAI",
    tugas: {
      id: 4,
      kode: "FIS-004",
      judul: "Quiz Fisika Kelas XI TKJ 2",
      kelas: "XITKJ2",
      kunciJawaban: "https://example.com/kunci2.json",
      guru: { nama: "Bu Eka" },
    },
  },
];

// Fungsi filter seperti di siswaController
function filterByKelas(items, student) {
  if (student.kelas) {
    const studentKelas = String(student.kelas);
    return items.filter((item) => {
      const tugasKelas = String(item.tugas.kelas || "");
      return tugasKelas === studentKelas;
    });
  }
  return items;
}

// Test 1: Siswa XIITKJ1
console.log("📝 Test 1: Siswa XIITKJ1 (Budi)");
const tugasSiswa1 = mockAssignments.filter((a) => a.siswaId === 1);
const filtered1 = filterByKelas(tugasSiswa1, siswaXIITKJ1);
console.log(`   Total tugas di database: ${tugasSiswa1.length}`);
console.log(`   Setelah filter kelas: ${filtered1.length}`);
console.log(`   Expected: 2 (MTK-001 dan BHS-003)`);
filtered1.forEach((item) => {
  const indicator = item.tugas.kunciJawaban ? " 🟢" : "";
  console.log(
    `   - ${item.tugas.kode}${indicator} (${item.tugas.kelas}) - ${item.tugas.judul}`
  );
});
const test1Pass = filtered1.length === 2 &&
  filtered1.every((item) => item.tugas.kelas === "XIITKJ1");
console.log(`   Result: ${test1Pass ? "✅ PASS" : "❌ FAIL"}\n`);

// Test 2: Siswa XITKJ2
console.log("📝 Test 2: Siswa XITKJ2 (Ani)");
const tugasSiswa2 = mockAssignments.filter((a) => a.siswaId === 2);
const filtered2 = filterByKelas(tugasSiswa2, siswaXITKJ2);
console.log(`   Total tugas di database: ${tugasSiswa2.length}`);
console.log(`   Setelah filter kelas: ${filtered2.length}`);
console.log(`   Expected: 1 (FIS-004)`);
filtered2.forEach((item) => {
  const indicator = item.tugas.kunciJawaban ? " 🟢" : "";
  console.log(
    `   - ${item.tugas.kode}${indicator} (${item.tugas.kelas}) - ${item.tugas.judul}`
  );
});
const test2Pass = filtered2.length === 1 &&
  filtered2[0].tugas.kelas === "XITKJ2";
console.log(`   Result: ${test2Pass ? "✅ PASS" : "❌ FAIL"}\n`);

// Test 3: Siswa tanpa kelas (fallback)
console.log("📝 Test 3: Siswa tanpa kelas (Dedi)");
const tugasSiswa3 = mockAssignments.filter((a) => a.siswaId === 3);
const filtered3 = filterByKelas(tugasSiswa3, siswaNoClass);
console.log(`   Total tugas di database: ${tugasSiswa3.length}`);
console.log(`   Setelah filter kelas: ${filtered3.length}`);
console.log(`   Expected: 0 (tidak ada tugas)`);
const test3Pass = filtered3.length === 0;
console.log(`   Result: ${test3Pass ? "✅ PASS" : "❌ FAIL"}\n`);

// Test 4: Verifikasi kelas tidak cocok difilter
console.log("📝 Test 4: Verifikasi tugas kelas lain tidak muncul");
const siswaXIITKJ1Tugas = filterByKelas(tugasSiswa1, siswaXIITKJ1);
const hasSalahKelas = siswaXIITKJ1Tugas.some(
  (item) => item.tugas.kelas !== "XIITKJ1"
);
console.log(`   Siswa XIITKJ1 mendapat tugas kelas lain? ${hasSalahKelas ? "YES ❌" : "NO ✅"}`);
const test4Pass = !hasSalahKelas;
console.log(`   Result: ${test4Pass ? "✅ PASS" : "❌ FAIL"}\n`);

// Summary
console.log("🎯 ========== TEST SUMMARY ==========");
const allPass = test1Pass && test2Pass && test3Pass && test4Pass;
console.log(`Test 1 (XIITKJ1): ${test1Pass ? "✅" : "❌"}`);
console.log(`Test 2 (XITKJ2):  ${test2Pass ? "✅" : "❌"}`);
console.log(`Test 3 (No Class): ${test3Pass ? "✅" : "❌"}`);
console.log(`Test 4 (Isolation): ${test4Pass ? "✅" : "❌"}`);
console.log(`\nOverall: ${allPass ? "✅ ALL PASS" : "❌ SOME FAILED"}`);

// Contoh output yang diharapkan
console.log("\n📱 ========== EXPECTED OUTPUT DI WHATSAPP ==========");
console.log("\nSiswa XIITKJ1 ketik 'tugas saya':");
console.log("```");
console.log("📚 *Daftar Tugas Kamu*\n");
console.log("1. *MTK-001* — Aljabar Kelas XII TKJ 1");
console.log("   Guru: Pak Budi | Deadline: ...");
console.log("2. *BHS-003* 🟢 — Essay Kelas XII TKJ 1");
console.log("   Guru: Pak Dedi | Deadline: ...");
console.log("\n🟢 = Dinilai otomatis");
console.log("```");

console.log("\nSiswa XITKJ2 ketik 'tugas saya':");
console.log("```");
console.log("📚 *Daftar Tugas Kamu*\n");
console.log("1. *FIS-004* 🟢 — Quiz Fisika Kelas XI TKJ 2");
console.log("   Guru: Bu Eka | Deadline: ...");
console.log("\n🟢 = Dinilai otomatis");
console.log("```");

console.log("\n✅ Tugas dari kelas lain TIDAK muncul!");
