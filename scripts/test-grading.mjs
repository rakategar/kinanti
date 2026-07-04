// scripts/test-grading.mjs
//
// Integration test untuk dataflow penilaian tugas otomatis (src/utils/grading.js).
// Jalankan: `pnpm test:grading`  (atau `node scripts/test-grading.mjs`)
//
// Mencakup:
//   A. n8n online (2xx)         -> penilaian native TIDAK dipanggil
//   B. Tanpa kunci jawaban      -> native skip, DB tidak ditulis
//   C. n8n offline -> native    -> Gemini menilai & TERSIMPAN ke Supabase (live DB),
//                                  diverifikasi dengan baca ulang dari DB, lalu cleanup.
//
// Test C butuh GEMINI_API_KEY + DATABASE_URL di .env. Lewati dengan SKIP_DB=1.
import "dotenv/config";
import assert from "node:assert";
import http from "node:http";
import { jsPDF } from "jspdf";
import { PrismaClient } from "@prisma/client";

let passed = 0;
let failed = 0;
const results = [];
function ok(name) {
  passed++;
  results.push(`  ✅ ${name}`);
}
function bad(name, err) {
  failed++;
  results.push(`  ❌ ${name}\n     ${err?.message || err}`);
}

function makePdf(text) {
  const d = new jsPDF();
  d.setFontSize(12);
  d.text(d.splitTextToSize(text, 180), 10, 20);
  return Buffer.from(d.output("arraybuffer"));
}

async function listen(server) {
  await new Promise((r) => server.listen(0, r));
  return server.address().port;
}

const { dispatchGrading, gradeSubmissionNative } = await import(
  "../src/utils/grading.js"
);

// ---------- Test A: n8n online -> native tidak dipanggil ----------
async function testN8nOnline() {
  const n8n = http.createServer((req, res) => {
    res.statusCode = 200;
    res.end("ok");
  });
  const port = await listen(n8n);
  process.env.WEBHOOK_TUGAS_URL = `http://127.0.0.1:${port}/webhook`;

  let nativeUpdateCalled = false;
  const prisma = {
    assignmentSubmission: {
      update: async () => {
        nativeUpdateCalled = true;
      },
    },
  };
  try {
    await dispatchGrading(prisma, {
      id: 1,
      siswaId: 1,
      tugasId: 1,
      pdfUrl: "http://x/a.pdf",
      answerKeyUrl: "http://x/k.pdf",
    });
    assert.strictEqual(nativeUpdateCalled, false, "native seharusnya tidak dipanggil saat n8n online");
    ok("A. n8n online -> native tidak dipanggil");
  } catch (e) {
    bad("A. n8n online -> native tidak dipanggil", e);
  } finally {
    n8n.close();
  }
}

// ---------- Test B: tanpa kunci jawaban -> skip ----------
async function testNoKey() {
  let updateCalled = false;
  const prisma = {
    assignmentSubmission: {
      update: async () => {
        updateCalled = true;
      },
    },
  };
  try {
    await gradeSubmissionNative(prisma, {
      id: 2,
      pdfUrl: "http://x/a.pdf",
      answerKeyUrl: null,
    });
    assert.strictEqual(updateCalled, false, "tanpa kunci, DB tidak boleh ditulis");
    ok("B. Tanpa kunci jawaban -> native skip (DB tidak ditulis)");
  } catch (e) {
    bad("B. Tanpa kunci jawaban -> native skip (DB tidak ditulis)", e);
  }
}

// ---------- Test C: native -> tersimpan ke Supabase (live) ----------
async function testNativeLive() {
  if (process.env.SKIP_DB === "1") {
    results.push("  ⏭️  C. (dilewati: SKIP_DB=1)");
    return;
  }
  if (!process.env.GEMINI_API_KEY) {
    results.push("  ⏭️  C. (dilewati: GEMINI_API_KEY tidak ada)");
    return;
  }

  const prisma = new PrismaClient();
  const tag = `ITEST_${Date.now()}`;
  const ids = {};

  const studentPdf = makePdf(
    "Jawaban Siswa - Siklus Air. Air laut menguap karena panas matahari (evaporasi), uap naik dan mengembun jadi awan (kondensasi), lalu turun sebagai hujan (presipitasi), mengalir kembali ke laut.",
  );
  const keyPdf = makePdf(
    "Kunci Jawaban - Siklus Air. Tahapan: (1) Evaporasi: penguapan air oleh panas matahari. (2) Kondensasi: uap mengembun membentuk awan. (3) Presipitasi: turun sebagai hujan/salju. (4) Air kembali ke sungai/laut (run off).",
  );
  const server = http.createServer((req, res) => {
    res.setHeader("Content-Type", "application/pdf");
    res.end(req.url.includes("student") ? studentPdf : keyPdf);
  });
  const port = await listen(server);
  const base = `http://127.0.0.1:${port}`;

  // Paksa native: arahkan webhook n8n ke port mati.
  process.env.WEBHOOK_TUGAS_URL = "http://127.0.0.1:9/dead";

  try {
    const guru = await prisma.user.create({
      data: { nama: `${tag}_guru`, phone: `${tag}_g`, role: "guru" },
    });
    const siswa = await prisma.user.create({
      data: { nama: `${tag}_siswa`, phone: `${tag}_s`, role: "siswa" },
    });
    const tugas = await prisma.assignment.create({
      data: {
        kode: tag,
        guruId: guru.id,
        kelas: "XTKJ1",
        judul: "UH Siklus Air",
        deskripsi: "Jelaskan tahapan siklus air",
        kunciJawaban: `${base}/key.pdf`,
      },
    });
    const sub = await prisma.assignmentSubmission.create({
      data: {
        siswaId: siswa.id,
        tugasId: tugas.id,
        pdfUrl: `${base}/student.pdf`,
        status: "SELESAI",
      },
    });
    ids.subId = sub.id;
    ids.tugasId = tugas.id;
    ids.userIds = [guru.id, siswa.id];

    // Pra-syarat: belum dinilai
    assert.strictEqual(sub.score, null, "sebelum dinilai, score harus null");

    await dispatchGrading(prisma, {
      id: sub.id,
      siswaId: siswa.id,
      tugasId: tugas.id,
      pdfUrl: sub.pdfUrl,
      answerKeyUrl: tugas.kunciJawaban,
    });

    // Baca ULANG dari DB (bukti tersimpan ke Supabase)
    const after = await prisma.assignmentSubmission.findUnique({
      where: { id: sub.id },
    });

    assert.ok(after, "row submission harus ada");
    assert.ok(
      Number.isInteger(after.score) && after.score >= 0 && after.score <= 100,
      `score harus integer 0-100, dapat: ${after.score}`,
    );
    assert.ok(
      ["A", "B", "C", "D"].includes(after.grade),
      `grade harus A/B/C/D, dapat: ${after.grade}`,
    );
    assert.ok(
      typeof after.evaluation === "string" && after.evaluation.length > 0,
      "evaluation harus terisi",
    );
    ok(
      `C. Native -> tersimpan ke Supabase (score=${after.score}, grade=${after.grade})`,
    );
  } catch (e) {
    bad("C. Native -> tersimpan ke Supabase", e);
  } finally {
    // Cleanup selalu jalan
    try {
      if (ids.subId)
        await prisma.assignmentSubmission.deleteMany({ where: { id: ids.subId } });
      if (ids.tugasId)
        await prisma.assignment.deleteMany({ where: { id: ids.tugasId } });
      if (ids.userIds)
        await prisma.user.deleteMany({ where: { id: { in: ids.userIds } } });
    } catch (cleanupErr) {
      results.push(`     ⚠️  cleanup gagal: ${cleanupErr.message}`);
    }
    server.close();
    await prisma.$disconnect();
  }
}

// ---------- Runner ----------
console.log("== Test dataflow penilaian otomatis ==\n");
await testN8nOnline();
await testNoKey();
await testNativeLive();

console.log(results.join("\n"));
console.log(`\nHasil: ${passed} lulus, ${failed} gagal.`);
process.exit(failed > 0 ? 1 : 0);
