import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

// Prisma singleton
const g = globalThis;
const prisma = g.__prisma || new PrismaClient({});
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

// Supabase (gunakan .env di produksi; disini konstan agar konsisten URL publik)
const SUPABASE_URL = "https://wgdxgzraacfhfbxvxuzy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZHhnenJhYWNmaGZieHZ4dXp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTAzNjM5OCwiZXhwIjoyMDU2NjEyMzk4fQ._dVS_wha-keEbaBb1xapdAeSpgJwwEAnWcrdnjDQ9nA";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
// bucket untuk lampiran guru
const ASSIGN_BUCKET = "assignments";

export async function POST(req) {
  try {
    const form = await req.formData();

    const guruId = Number(form.get("guruId"));
    const kode = String(form.get("kode") || "")
      .trim()
      .toUpperCase();
    const judul = String(form.get("judul") || "").trim();
    const deskripsi = String(form.get("deskripsi") || "").trim();
    const kelas = String(form.get("kelas") || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
    const deadlineHariStr = String(form.get("deadlineHari") || "").trim();
    const lampirPdf =
      String(form.get("lampirPdf") || "tidak").toLowerCase() === "ya";
    const file = form.get("file");

    if (!guruId || Number.isNaN(guruId)) {
      return NextResponse.json(
        { error: "guruId wajib & numerik." },
        { status: 400 }
      );
    }
    if (!kode || !judul || !kelas) {
      return NextResponse.json(
        { error: "Kode, Judul, dan Kelas wajib diisi." },
        { status: 400 }
      );
    }

    // Cek unik kode untuk guru ini (opsional: bisa unik global)
    const exists = await prisma.assignment.findFirst({
      where: { guruId, kode },
    });
    if (exists) {
      return NextResponse.json(
        { error: `Kode ${kode} sudah dipakai.` },
        { status: 409 }
      );
    }

    // Hitung deadline dari sekarang + N hari (jika diisi)
    let deadline = null;
    if (deadlineHariStr !== "") {
      const n = Number(deadlineHariStr);
      if (!Number.isNaN(n) && n >= 0) {
        const d = new Date();
        d.setDate(d.getDate() + n);
        deadline = d; // simpan dalam UTC
      }
    }

    // Siapkan payload assignment
    const payload = {
      kode,
      judul,
      deskripsi,
      kelas,
      deadline,
      guruId,
      pdfUrl: null,
    };

    // Upload PDF guru bila diminta
    if (lampirPdf && file) {
      const type = file.type || "";
      if (!type.includes("pdf")) {
        return NextResponse.json(
          { error: "Lampiran harus PDF." },
          { status: 415 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const safeName = (file.name || "materi.pdf").replace(/\s+/g, "_");
      const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
      const path = `guru/${guruId}/${kode}_${stamp}_${safeName}`;

      const { data, error } = await supabase.storage
        .from(ASSIGN_BUCKET)
        .upload(path, buffer, { contentType: "application/pdf", upsert: true });

      if (error) {
        console.error("Supabase upload error:", error);
        return NextResponse.json(
          { error: "Gagal mengunggah lampiran." },
          { status: 500 }
        );
      }
      payload.pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/${ASSIGN_BUCKET}/${path}`;
    }

    // Buat assignment
    const created = await prisma.assignment.create({ data: payload });

    // Generate status BELUM_SELESAI untuk semua siswa di kelas tsb
    const students = await prisma.user.findMany({
      where: { role: "siswa", kelas },
      select: { id: true },
    });

    // Upsert satu per satu (aman walau unique constraint tidak diketahui)
    for (const s of students) {
      const existSt = await prisma.assignmentStatus.findFirst({
        where: { siswaId: s.id, tugasId: created.id },
        select: { id: true },
      });
      if (existSt) {
        await prisma.assignmentStatus.update({
          where: { id: existSt.id },
          data: { status: "BELUM_SELESAI" },
        });
      } else {
        await prisma.assignmentStatus.create({
          data: { siswaId: s.id, tugasId: created.id, status: "BELUM_SELESAI" },
        });
      }
    }

    return NextResponse.json(
      { message: "Tugas berhasil dibuat.", id: created.id },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/guru/create-assignment error:", err);
    return NextResponse.json(
      { error: "Gagal membuat tugas." },
      { status: 500 }
    );
  }
}
