// app/api/guru/generate-hots/route.js
import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const JENIS_VALID = ["Pilihan Ganda", "Uraian"];

const SYSTEM_PROMPT = `Kamu adalah pembuat soal HOTS (Higher Order Thinking Skills) profesional
untuk pendidikan Indonesia tingkat SMA/SMK.
Buat soal berdasarkan taksonomi Bloom level C4 (Analisis), C5 (Evaluasi), C6 (Kreasi).
Selalu kembalikan response dalam format JSON yang valid.

ATURAN PENULISAN RUMUS MATEMATIKA & KODE (WAJIB, agar rapi saat dicetak ke PDF):
- Rumus matematika: tulis memakai SIMBOL UNICODE langsung, mis.
  pangkat x², x³, xⁿ; indeks x₁, x₂, aₙ; akar √2, √(x+1); pecahan ½, ¾, atau (a+b)/c;
  operator × ÷ ± ≤ ≥ ≠ ≈ ∑ ∫ → ∞ ·; huruf Yunani π θ α β Σ Ω; serta ∈ ℝ, °, ∠.
- DILARANG KERAS menulis perintah LaTeX dengan backslash (mis. \\frac, \\sqrt, \\times,
  \\leq, \\pi) atau tanda dolar $...$, karena backslash merusak JSON. Selalu pakai
  simbol Unicode di atas, dan tulis pecahan sebagai "a/b" bila tidak ada simbol Unicode-nya.
- Potongan kode program: SELALU bungkus dalam blok berpagar tiga backtick
  disertai nama bahasa, contoh:
  \`\`\`python
  def f(x):
      return x * 2
  \`\`\`
  Pertahankan indentasi asli. Untuk menyebut nama variabel/fungsi di dalam
  kalimat, gunakan inline code satu backtick, mis. \`output\`.
- Untuk penekanan gunakan **teks tebal**. Jangan gunakan tabel markdown.`;

function buildUserPrompt({ mataPelajaran, judulSoal, deskripsi, jenisSoal, jumlahSoal }) {
  return `Buat ${jumlahSoal} soal HOTS jenis ${jenisSoal} untuk mata pelajaran ${mataPelajaran}.
Materi/konteks: ${deskripsi}

Untuk setiap soal, pilih SATU level Bloom konkret pada field "levelBloom": "C4", "C5", atau "C6" (jangan tulis "C4/C5/C6").

Tulis rumus matematika HANYA dengan simbol Unicode (mis. x², √, ≤, ≥, ≠, ±, π, ½, x₁),
JANGAN memakai LaTeX/backslash atau tanda dolar. Kode program dalam blok \`\`\`bahasa ... \`\`\`.

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

// Perbaiki backslash yang bukan escape JSON valid (\" \\ \/ \b \f \n \r \t \uXXXX)
// menjadi backslash ganda, agar LaTeX yang tak sengaja lolos (mis. \sqrt, \leq)
// tidak membuat JSON.parse gagal.
function repairJsonBackslashes(text) {
  return text.replace(/\\(?!["\\/bfnrtu]|u[0-9a-fA-F]{4})/g, "\\\\");
}

// Bersihkan code-fence (```json ... ```) bila ada lalu parse; jika gagal karena
// escape backslash yang buruk, coba sekali lagi setelah diperbaiki.
function parseGeminiJson(raw) {
  let text = String(raw || "").trim();
  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    return JSON.parse(repairJsonBackslashes(text));
  }
}

async function callGemini(model, prompt) {
  const result = await model.generateContent(prompt);
  return result.response.text();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Error sementara dari sisi Gemini (overload / rate limit) → layak dicoba ulang.
function isTransient(err) {
  const m = String(err?.message || "");
  return /\b(503|429|500|overloaded|high demand|Service Unavailable|unavailable|rate limit)\b/i.test(m);
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
    const makeModel = (name) =>
      genAI.getGenerativeModel({
        model: name,
        systemInstruction: SYSTEM_PROMPT,
        // Sisakan ruang output besar agar 10–20 soal tidak terpotong (truncated JSON).
        generationConfig: {
          responseMimeType: "application/json",
          maxOutputTokens: 32768,
          temperature: 0.7,
        },
      });

    const prompt = buildUserPrompt({
      mataPelajaran,
      judulSoal,
      deskripsi,
      jenisSoal,
      jumlahSoal,
    });

    // Model utama kualitas terbaik; bila kena rate-limit/overload (429/503),
    // jatuh ke model cadangan yang lebih ringan agar tetap bisa membuat soal.
    const MODELS = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-flash-latest"];

    // --- Panggil Gemini per-model, retry dengan backoff, parse + repair JSON ---
    let parsed = null;
    let lastErr = null;
    outer: for (const name of MODELS) {
      const model = makeModel(name);
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const raw = await callGemini(model, prompt);
          parsed = parseGeminiJson(raw);
          if (parsed && Array.isArray(parsed.soal) && parsed.soal.length > 0) {
            break outer;
          }
          parsed = null;
          lastErr = new Error("Struktur JSON tidak sesuai (field 'soal' kosong).");
        } catch (e) {
          lastErr = e;
          parsed = null;
          if (isTransient(e)) {
            // error sementara: tunggu sejenak lalu coba lagi / pindah model
            if (attempt < 1) await sleep(1000);
          } else {
            break; // error permanen pada model ini → langsung coba model berikutnya
          }
        }
      }
    }

    if (!parsed) {
      console.error("POST /api/guru/generate-hots error:", lastErr);
      const transient = isTransient(lastErr);
      return NextResponse.json(
        {
          error: transient
            ? "Server AI (Gemini) sedang sibuk / penuh permintaan. Tunggu beberapa detik lalu coba lagi."
            : "Gemini gagal menghasilkan soal yang valid. Coba lagi.",
        },
        { status: transient ? 503 : 502 },
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
