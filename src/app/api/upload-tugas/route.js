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

// ---- Supabase ----
// Pindahkan KEY & URL ke ENV di production!
// Di sini tetap gunakan konstanta agar konsisten dengan upload URL.
const SUPABASE_URL = "https://wgdxgzraacfhfbxvxuzy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZHhnenJhYWNmaGZieHZ4dXp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTAzNjM5OCwiZXhwIjoyMDU2NjEyMzk4fQ._dVS_wha-keEbaBb1xapdAeSpgJwwEAnWcrdnjDQ9nA";
// NOTE: gunakan bucket bernama "submissions" (public).
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
        { status: 400 }
      );
    }

    // Validasi assignment & user ada
    const [user, tugas] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, phone: true },
      }),
      prisma.assignment.findUnique({
        where: { id: tugasId },
        select: { id: true, kode: true },
      }),
    ]);
    if (!user)
      return NextResponse.json(
        { error: "User tidak ditemukan." },
        { status: 404 }
      );
    if (!tugas)
      return NextResponse.json(
        { error: "Tugas tidak ditemukan." },
        { status: 404 }
      );

    // Validasi file
    const type = file.type || "";
    if (!type.includes("pdf")) {
      return NextResponse.json(
        { error: "Hanya file PDF yang diperbolehkan." },
        { status: 415 }
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
        upsert: true, // jika file sama di-path sama, timpa
      });

    if (upErr) {
      console.error("Supabase upload error:", upErr);
      return NextResponse.json(
        { error: "Gagal mengunggah ke storage." },
        { status: 500 }
      );
    }

    // URL publik (gunakan konstanta SUPABASE_URL biar ga mismatch)
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/submissions/${path}`;

    // Simpan ke AssignmentSubmission:
    // - Jika sudah ada submission siswa untuk tugas ini → update (biar idempoten)
    // - Jika belum ada → create
    const existing = await prisma.assignmentSubmission.findFirst({
      where: { siswaId: userId, tugasId },
      select: { id: true },
    });

    if (existing) {
      await prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: { pdfUrl: publicUrl },
      });
    } else {
      await prisma.assignmentSubmission.create({
        data: { siswaId: userId, tugasId, pdfUrl: publicUrl },
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

    return NextResponse.json(
      { message: "Tugas berhasil dikumpulkan!", url: publicUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json(
      { error: "Gagal mengunggah tugas." },
      { status: 500 }
    );
  }
}
