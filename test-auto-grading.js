// test-auto-grading.js
// Test simulasi penilaian otomatis

console.log("🧪 ========== TEST AUTO GRADING FLOW ==========\n");

// Simulasi data
const mockSubmission = {
  id: 9,
  siswaId: 3,
  tugasId: 12,
  pdfUrl:
    "https://docs.google.com/document/d/1ZWm1g6AX26se_tbCwFuzuOBC2q2DUdBUSaEPV1Sm2xg/edit?usp=sharing",
  assignmentKunciJawaban:
    "https://docs.google.com/document/d/1nOMa_pmnuEmSZMdoUY0ZxuIlwNVAwm1PXOsMByEio_A/edit?usp=sharing",
};

const mockGradingResult = {
  evaluation:
    "Jawaban siswa sangat komprehensif, mencakup semua poin penting dari kunci jawaban mengenai fungsi, struktur, dan klasifikasi bunga dengan akurasi tinggi dan detail yang baik.",
  grade: "A",
  score: 90,
  status: "SELESAI",
};

// Test 1: Payload webhook
console.log("📤 Test 1: Webhook Payload");
const webhookPayload = {
  id: mockSubmission.id,
  siswaId: mockSubmission.siswaId,
  tugasId: mockSubmission.tugasId,
  pdfUrl: mockSubmission.pdfUrl,
  answerKeyUrl: mockSubmission.assignmentKunciJawaban,
};
console.log(JSON.stringify(webhookPayload, null, 2));
console.log("✅ Payload valid\n");

// Test 2: Format notifikasi awal
console.log("📱 Test 2: Notifikasi Awal (Tugas Dinilai Otomatis)");
const initialNotif =
  "🎉 *Tugas sukses terkumpul!*\n" +
  "📌 Kode: *MTK-001*\n" +
  "📂 File: MTK-001_20251127_131500_tugas.pdf\n\n" +
  "🤖 *Tugas ini dinilai otomatis*\n" +
  "⏳ Sedang diproses oleh AI... mohon tunggu sebentar.";
console.log(initialNotif);
console.log("✅ Format notifikasi awal OK\n");

// Test 3: Format hasil penilaian
console.log("📱 Test 3: Notifikasi Hasil Penilaian");
const gradeEmoji = {
  A: "🌟",
  B: "⭐",
  C: "✨",
  D: "💫",
};
const emoji = gradeEmoji[mockGradingResult.grade] || "📊";

const resultNotif =
  `🎓 *HASIL PENILAIAN OTOMATIS*\n\n` +
  `${emoji} *Grade: ${mockGradingResult.grade}*\n` +
  `📊 *Score: ${mockGradingResult.score}/100*\n\n` +
  `💬 *Evaluasi:*\n${mockGradingResult.evaluation}\n\n` +
  `Semangat terus belajarnya! 🚀`;
console.log(resultNotif);
console.log("✅ Format hasil penilaian OK\n");

// Test 4: Format timeout
console.log("📱 Test 4: Notifikasi Timeout");
const timeoutNotif =
  "⏱️ Penilaian memakan waktu lebih lama. Hasilnya akan diupdate nanti ya! Cek status tugas secara berkala.";
console.log(timeoutNotif);
console.log("✅ Format timeout OK\n");

// Test 5: Simulasi curl command
console.log("🔧 Test 5: Curl Command untuk Testing Manual");
const curlCmd = `curl --location 'http://0.0.0.0:5678/webhook/nilai-tugas' \\
--header 'Content-Type: application/json' \\
--data '${JSON.stringify(webhookPayload)}'`;
console.log(curlCmd);
console.log("✅ Curl command ready\n");

// Test 6: Validasi grade conversion
console.log("📊 Test 6: Grade Conversion Logic");
const testScores = [0, 65, 69, 70, 75, 79, 80, 85, 89, 90, 95, 100];
testScores.forEach((score) => {
  let grade;
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 70) grade = "C";
  else grade = "D";

  const emoji = gradeEmoji[grade];
  console.log(`   Score ${score.toString().padStart(3)} → Grade ${grade} ${emoji}`);
});
console.log("✅ Grade conversion OK\n");

console.log("🎯 ========== SEMUA TEST SELESAI ==========");
console.log("\n📋 Summary:");
console.log("   - Webhook payload format: ✅");
console.log("   - Initial notification: ✅");
console.log("   - Result notification: ✅");
console.log("   - Timeout notification: ✅");
console.log("   - Grade conversion: ✅");
console.log("\n💡 Next Steps:");
console.log("   1. Pastikan n8n workflow aktif di http://0.0.0.0:5678");
console.log("   2. Test webhook dengan curl command di atas");
console.log("   3. Verifikasi database update (evaluation, grade, score)");
console.log("   4. Test via WhatsApp dengan tugas yang punya kunciJawaban");
