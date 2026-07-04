// app/api/guru/generate-hots/route.js
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const JENIS_VALID = ["Pilihan Ganda", "Uraian"];

const SYSTEM_PROMPT = `Kamu adalah pembuat soal HOTS (Higher Order Thinking Skills) profesional
untuk pendidikan Indonesia tingkat SMA/SMK.
Buat soal berdasarkan taksonomi Bloom level C4 (Analisis), C5 (Evaluasi), C6 (Kreasi).
Selalu kembalikan response dalam format JSON yang valid.`;

function buildUserPrompt({ mataPelajaran, judulSoal, deskripsi, jenisSoal, jumlahSoal }) {
  return `Buat ${jumlahSoal} soal HOTS jenis ${jenisSoal} untuk mata pelajaran ${mataPelajaran}.
Materi/konteks: ${deskripsi}

Untuk setiap soal, pilih SATU level Bloom konkret pada field "levelBloom": "C4", "C5", atau "C6" (jangan tulis "C4/C5/C6").

FORMAT JSON WAJIB:
{
  "judul": "${judulSoal}",
  "mataPelajaran": "${mataPelajaran}",
  "jenisSoal": "${jenisSoal}",
  "soal": [
    // Jika PILIHAN GANDA:
    {
      "nomor": 1,
      "levelBloom": "C4/C5/C6",
      "pertanyaan": "...",
      "opsi": { "A": "...", "B": "...", "C": "...", "D": "...", "E": "..." },
      "jawabanBenar": "A",
      "pembahasan": "..."
    },
    // Jika URAIAN:
    {
      "nomor": 1,
      "levelBloom": "C4/C5/C6",
      "pertanyaan": "...",
      "jawabanKunci": "...",
      "rubrikPenilaian": "...",
      "skorMaksimal": 20
    }
  ]
}
Kembalikan JSON valid saja, tanpa teks tambahan apapun.`;
}

// Bersihkan code-fence (```json ... ```) bila ada lalu parse
function parseGeminiJson(raw) {
  let text = String(raw || "").trim();
  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  return JSON.parse(text);
}

async function callGemini(model, prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const mataPelajaran = String(body.mataPelajaran || "").trim();
    const judulSoal = String(body.judulSoal || "").trim();
    const deskripsi = String(body.deskripsi || "").trim();
    const jenisSoal = String(body.jenisSoal || "").trim();
    const jumlahSoal = Number(body.jumlahSoal);

    // --- Validasi ---
    if (!mataPelajaran || !judulSoal || !deskripsi || !jenisSoal) {
      return NextResponse.json(
        { error: "Semua field wajib diisi." },
        { status: 400 },
      );
    }
    if (!JENIS_VALID.includes(jenisSoal)) {
      return NextResponse.json(
        { error: "Jenis soal harus 'Pilihan Ganda' atau 'Uraian'." },
        { status: 400 },
      );
    }
    if (!Number.isInteger(jumlahSoal) || jumlahSoal < 1 || jumlahSoal > 20) {
      return NextResponse.json(
        { error: "Jumlah soal harus berupa angka 1 sampai 20." },
        { status: 400 },
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      console.error("POST /api/guru/generate-hots error: GEMINI_API_KEY belum diset");
      return NextResponse.json(
        { error: "Konfigurasi Gemini belum lengkap (GEMINI_API_KEY tidak ditemukan)." },
        { status: 500 },
      );
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: { responseMimeType: "application/json" },
    });

    const prompt = buildUserPrompt({
      mataPelajaran,
      judulSoal,
      deskripsi,
      jenisSoal,
      jumlahSoal,
    });

    // --- Panggil Gemini, parse JSON, retry sekali jika gagal ---
    let parsed = null;
    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await callGemini(model, prompt);
        parsed = parseGeminiJson(raw);
        if (parsed && Array.isArray(parsed.soal) && parsed.soal.length > 0) {
          break;
        }
        parsed = null;
        lastErr = new Error("Struktur JSON tidak sesuai (field 'soal' kosong).");
      } catch (e) {
        lastErr = e;
        parsed = null;
      }
    }

    if (!parsed) {
      console.error("POST /api/guru/generate-hots error:", lastErr);
      return NextResponse.json(
        { error: "Gemini gagal menghasilkan soal yang valid. Coba lagi." },
        { status: 502 },
      );
    }

    // Lengkapi meta agar konsisten dengan input
    parsed.judul = parsed.judul || judulSoal;
    parsed.mataPelajaran = parsed.mataPelajaran || mataPelajaran;
    parsed.jenisSoal = parsed.jenisSoal || jenisSoal;

    return NextResponse.json({ data: parsed }, { status: 200 });
  } catch (err) {
    console.error("POST /api/guru/generate-hots error:", err);
    return NextResponse.json(
      { error: "Gagal membuat soal HOTS." },
      { status: 500 },
    );
  }
}
