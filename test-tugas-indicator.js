// test-tugas-indicator.js
// Test indikator 🟢 untuk tugas dengan kunci jawaban

console.log("🧪 ========== TEST INDIKATOR TUGAS OTOMATIS ==========\n");

// Simulasi data tugas
const mockAssignments = [
  {
    tugas: {
      id: 1,
      kode: "MTK-001",
      judul: "Latihan Aljabar",
      kunciJawaban: "https://example.com/kunci.json", // Ada kunci jawaban
      deadline: new Date("2025-12-01T10:00:00Z"),
      guru: { nama: "Pak Budi" },
    },
  },
  {
    tugas: {
      id: 2,
      kode: "IPA-002",
      judul: "Laporan Praktikum",
      kunciJawaban: null, // Tidak ada kunci jawaban
      deadline: new Date("2025-12-05T15:00:00Z"),
      guru: { nama: "Bu Ani" },
    },
  },
  {
    tugas: {
      id: 3,
      kode: "BHS-003",
      judul: "Essay Bahasa Indonesia",
      kunciJawaban: null, // Tidak ada kunci jawaban
      deadline: new Date("2025-12-10T09:00:00Z"),
      guru: { nama: "Pak Dedi" },
    },
  },
  {
    tugas: {
      id: 4,
      kode: "FIS-004",
      judul: "Quiz Fisika Bab 3",
      kunciJawaban: "https://example.com/fisika-kunci.json", // Ada kunci jawaban
      deadline: new Date("2025-12-15T14:00:00Z"),
      guru: { nama: "Bu Eka" },
    },
  },
];

function fmtDateWIB(dt) {
  try {
    const d = new Date(dt);
    const fmt = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return fmt.format(d);
  } catch {
    return String(dt || "-");
  }
}

// Simulasi pembentukan pesan
const lines = mockAssignments.map((it, i) => {
  const tg = it.tugas;
  // Indikator tugas dinilai otomatis (ada kunci jawaban)
  const autoGradeIndicator = tg.kunciJawaban ? " 🟢" : "";
  return (
    `${i + 1}. *${tg.kode}*${autoGradeIndicator} — ${tg.judul}\n` +
    `   Guru: ${tg.guru?.nama || "-"} | Deadline: ${fmtDateWIB(tg.deadline)}`
  );
});

const message =
  "📚 *Daftar Tugas Kamu* (pilih salah satu kodenya):\n\n" +
  lines.join("\n") +
  "\n\n🟢 = Dinilai otomatis\n" +
  "Ketik *kode tugas* yang ingin direkap. Contoh: _TKJ-09_";

console.log(message);
console.log("\n✅ Test selesai!");
console.log("\n📋 Penjelasan:");
console.log("   - MTK-001 🟢 = Dinilai otomatis (ada kunciJawaban)");
console.log("   - IPA-002 = Manual (tidak ada kunciJawaban)");
console.log("   - BHS-003 = Manual (tidak ada kunciJawaban)");
console.log("   - FIS-004 🟢 = Dinilai otomatis (ada kunciJawaban)");
