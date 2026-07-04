// src/utils/grading.js
// Penilaian tugas otomatis. Alur: coba kirim ke n8n dulu; jika n8n gagal
// (offline / timeout / non-2xx) → fallback ke penilaian native (Gemini) di kode ini.
import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_WEBHOOK_URL = "http://0.0.0.0:5678/webhook/nilai-tugas";

const N8N_TIMEOUT_MS = 4000;
const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15MB per dokumen (batas aman inline data Gemini)

// Prompt validator — verbatim dari workflow n8n "Analyze document".
const VALIDATOR_PROMPT = `Anda adalah Validator Akademik Kritis. Tugas Anda membandingkan Kunci Jawaban vs Jawaban Siswa.

INPUT:
1. [URL_KUNCI_JAWABAN] = SUMBER KEBENARAN (GROUND TRUTH).
2. [URL_JAWABAN_SISWA] = JAWABAN SISWA.

PROTOKOL PENILAIAN LANGKAH DEMI LANGKAH:
1. CEK TOPIK/DOMAIN:
   - Identifikasi topik Kunci Jawaban (misal: Astronomi).
   - Identifikasi topik Jawaban Siswa (misal: Kalender/Waktu).
   - Hati-hati dengan HOMONIM (kata sama, arti beda). Contoh: "Bulan" (Satelit) vs "Bulan" (30 Hari).
   - JIKA TOPIK BERBEDA/SALAH KONTEKS: Tetapkan Score = 0.

2. HITUNG SCORE (0-100):
   - Jika topik salah = 0.
   - Jika topik benar, nilai berdasarkan kelengkapan poin kunci.

3. TENTUKAN GRADE (WAJIB HURUF):
   Gunakan aturan konversi ini secara KAKU:
   - Score 0 s.d 69 = "D"
   - Score 70 s.d 79 = "C"
   - Score 80 s.d 89 = "B"
   - Score 90 s.d 100 = "A"

   PENTING: Field "grade" HANYA BOLEH berisi satu huruf kapital (A, B, C, atau D).

OUTPUT JSON:
{
  "score": (Integer),
  "grade": "A|B|C|D",
  "topic_check": "...",
  "matchConfidence": (Float),
  "summary": "..." (gunakan bahasa indonesia, jangan sebutkan kata kunci jawaban)
}`;

// Catatan urutan dokumen agar Gemini tahu mana yang mana
// (di n8n documentUrls = pdfUrl,answerKeyUrl).
const DOC_NOTE =
  "\n\nCATATAN DOKUMEN: Dokumen ke-1 yang dilampirkan adalah JAWABAN SISWA. " +
  "Dokumen ke-2 adalah KUNCI JAWABAN (sumber kebenaran).";

async function fetchPdfAsInline(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Gagal mengunduh PDF (${res.status}): ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_PDF_BYTES) {
    throw new Error(
      `PDF terlalu besar (${buf.byteLength} bytes) untuk inline: ${url}`,
    );
  }
  return {
    inlineData: { mimeType: "application/pdf", data: buf.toString("base64") },
  };
}

function parseJudged(rawText) {
  let text = String(rawText || "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  return JSON.parse(text);
}

/**
 * Penilaian native (replika node n8n: Analyze document + Pre Processing + Update row).
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ id:number, pdfUrl:string, answerKeyUrl:string|null }} payload
 */
export async function gradeSubmissionNative(prisma, { id, pdfUrl, answerKeyUrl }) {
  if (!process.env.GEMINI_API_KEY) {
    console.warn("[grading native] GEMINI_API_KEY tidak ada — skip.");
    return;
  }
  if (!answerKeyUrl) {
    console.warn(
      `[grading native] Tugas tanpa kunci jawaban (submission ${id}) — skip, biarkan dinilai manual.`,
    );
    return;
  }
  if (!pdfUrl) {
    console.warn(`[grading native] pdfUrl kosong (submission ${id}) — skip.`);
    return;
  }

  try {
    const [studentDoc, keyDoc] = await Promise.all([
      fetchPdfAsInline(pdfUrl),
      fetchPdfAsInline(answerKeyUrl),
    ]);

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent([
      { text: VALIDATOR_PROMPT + DOC_NOTE },
      studentDoc, // dokumen ke-1: jawaban siswa
      keyDoc, // dokumen ke-2: kunci jawaban
    ]);

    const rawText = result.response.text();

    let data;
    try {
      const judged = parseJudged(rawText);
      data = {
        score: Number.isFinite(Number(judged.score)) ? Number(judged.score) : 0,
        grade: judged.grade ?? "D",
        evaluation:
          judged.evaluation ??
          judged.evaluasi ??
          judged.feedback ??
          judged.summary ??
          judged.topic_check ??
          "",
      };
    } catch (parseErr) {
      console.error(
        `[grading native] Gagal parse JSON Gemini (submission ${id}):`,
        parseErr?.message,
      );
      data = {
        score: 0,
        grade: "D",
        evaluation: "Gagal parse hasil penilaian otomatis.",
      };
    }

    await prisma.assignmentSubmission.update({
      where: { id },
      data: {
        score: Number.isInteger(data.score) ? data.score : Math.round(data.score) || 0,
        grade: String(data.grade || "D").slice(0, 1).toUpperCase(),
        evaluation: data.evaluation || "",
      },
    });

    console.log(
      `[grading native] Submission ${id} dinilai: grade=${data.grade} score=${data.score}`,
    );
  } catch (err) {
    console.error(`[grading native] Error menilai submission ${id}:`, err);
  }
}

/**
 * Orkestrator: coba n8n dulu, fallback native.
 * @param {import("@prisma/client").PrismaClient} prisma
 * @param {{ id:number, siswaId:number, tugasId:number, pdfUrl:string, answerKeyUrl:string|null }} payload
 */
export async function dispatchGrading(prisma, payload) {
  const webhookUrl = process.env.WEBHOOK_TUGAS_URL || DEFAULT_WEBHOOK_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      console.log(`[grading] via n8n (${webhookUrl}) untuk submission ${payload.id}`);
      return;
    }

    const text = await res.text().catch(() => "");
    console.warn(
      `[grading] n8n gagal (${res.status}: ${text}) — fallback native untuk submission ${payload.id}`,
    );
  } catch (whErr) {
    clearTimeout(timer);
    console.warn(
      `[grading] n8n tidak terjangkau (${whErr?.name || "error"}: ${whErr?.message}) — fallback native untuk submission ${payload.id}`,
    );
  }

  // Fallback native
  await gradeSubmissionNative(prisma, {
    id: payload.id,
    pdfUrl: payload.pdfUrl,
    answerKeyUrl: payload.answerKeyUrl,
  });
}
