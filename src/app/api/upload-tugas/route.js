import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

// ---- Prisma singleton ----
const globalForPrisma = globalThis;
const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    // log: ['query', 'error', 'warn'],
  });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// ---- Supabase (ambil dari .env melalui process.env) ----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("SUPABASE_URL atau SUPABASE_KEY tidak ditemukan di env");
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Webhook target (bisa override via env WEBHOOK_TUGAS_URL)
const WEBHOOK_URL =
  process.env.WEBHOOK_TUGAS_URL || "http://0.0.0.0:5678/webhook/nilai-tugas";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const userIdParam = formData.get("userId");
    const tugasIdParam = formData.get("tugasId");

    const userId = Number(userIdParam);
    const tugasId = Number(tugasIdParam);

    if (!file || Number.isNaN(userId) || Number.isNaN(tugasId)) {
      return NextResponse.json(
        { error: "Data tidak lengkap." },
        { status: 400 },
      );
    }

    // Validasi assignment & user ada (ambil juga kunci jawaban)
    const [user, tugas] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true },
      }),
      prisma.assignment.findUnique({
        where: { id: tugasId },
        select: { id: true, kode: true, kunciJawaban: true },
      }),
    ]);
    if (!user)
      return NextResponse.json(
        { error: "User tidak ditemukan." },
        { status: 404 },
      );
    if (!tugas)
      return NextResponse.json(
        { error: "Tugas tidak ditemukan." },
        { status: 404 },
      );

    // Validasi file PDF
    const type = file.type || "";
    if (!type.includes("pdf")) {
      return NextResponse.json(
        { error: "Hanya file PDF yang diperbolehkan." },
        { status: 415 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Nama file rapi: users/siswa/<userId>/submissions/<KODE>_timestamp_original.pdf
    const origName = (file?.name || "tugas.pdf").replace(/\s+/g, "_");
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
    const path = `users/siswa/${userId}/submissions/${
      tugas.kode || "TUGAS"
    }_${stamp}_${origName}`;

    // Upload ke bucket "submissions"
    const { data: up, error: upErr } = await supabase.storage
      .from("submissions")
      .upload(path, buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (upErr) {
      console.error("Supabase upload error:", upErr);
      return NextResponse.json(
        { error: "Gagal mengunggah ke storage." },
        { status: 500 },
      );
    }

    // URL publik
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/submissions/${path}`;

    // Simpan ke AssignmentSubmission (create atau update)
    const existing = await prisma.assignmentSubmission.findFirst({
      where: { siswaId: userId, tugasId },
      select: { id: true },
    });

    let submissionRow;
    if (existing) {
      submissionRow = await prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: { pdfUrl: publicUrl },
        select: { id: true, siswaId: true, tugasId: true, pdfUrl: true },
      });
    } else {
      submissionRow = await prisma.assignmentSubmission.create({
        data: { siswaId: userId, tugasId, pdfUrl: publicUrl },
        select: { id: true, siswaId: true, tugasId: true, pdfUrl: true },
      });
    }

    // Set status tugas → SELESAI (jika record status belum ada, buat)
    const statusRow = await prisma.assignmentStatus.findFirst({
      where: { siswaId: userId, tugasId },
      select: { id: true },
    });

    if (statusRow) {
      await prisma.assignmentStatus.update({
        where: { id: statusRow.id },
        data: { status: "SELESAI" },
      });
    } else {
      await prisma.assignmentStatus.create({
        data: { siswaId: userId, tugasId, status: "SELESAI" },
      });
    }

    // --- Kirim webhook ke service eksternal ---
    // payload: { id, siswaId, tugasId, pdfUrl, answerKeyUrl }
    (async () => {
      try {
        const payload = {
          id: submissionRow.id,
          siswaId: submissionRow.siswaId,
          tugasId: submissionRow.tugasId,
          pdfUrl: submissionRow.pdfUrl,
          answerKeyUrl: tugas.kunciJawaban || null,
        };

        const res = await fetch(WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.warn(
            `Webhook POST failed (${res.status}): ${WEBHOOK_URL} - ${text}`,
          );
        } else {
          console.log(`Webhook POST success: ${WEBHOOK_URL}`);
        }
      } catch (whErr) {
        console.error("Webhook error:", whErr);
      }
    })();

    return NextResponse.json(
      {
        message: "Tugas berhasil dikumpulkan!",
        url: publicUrl,
        submission: submissionRow,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json(
      { error: "Gagal mengunggah tugas." },
      { status: 500 },
    );
  }
}
