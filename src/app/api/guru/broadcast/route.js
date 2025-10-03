import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const g = globalThis;
const prisma = g.__prisma || new PrismaClient({});
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const kode = String(body.kode || "")
      .trim()
      .toUpperCase();
    const kelas = String(body.kelas || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

    if (!kode || !kelas) {
      return NextResponse.json(
        { error: "Kode dan Kelas wajib diisi." },
        { status: 400 }
      );
    }

    const assignment = await prisma.assignment.findFirst({
      where: { kode, kelas },
      select: {
        id: true,
        judul: true,
        deadline: true,
        pdfUrl: true,
        kelas: true,
      },
    });
    if (!assignment) {
      return NextResponse.json(
        { error: "Tugas tidak ditemukan untuk kode/kelas tersebut." },
        { status: 404 }
      );
    }

    // Ambil siswa di kelas yang sama
    const students = await prisma.user.findMany({
      where: { role: "siswa", kelas },
      select: { id: true, nama: true, phone: true },
    });

    // (opsional) simpan jejak broadcast di log table kalau ada — diabaikan karena tidak ada tabelnya

    // di sini *seharusnya* kamu panggil service/bot internal untuk kirim WA
    // contoh (pseudo):
    // await fetch(process.env.BOT_INTERNAL_URL + "/broadcast", { method: "POST", body: JSON.stringify({...}) })

    const sampleTargets = students.slice(0, 5).map((s) => s.phone);
    return NextResponse.json(
      {
        message: "Broadcast diproses.",
        task: {
          kode,
          kelas,
          targetCount: students.length,
          sampleTargets,
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/guru/broadcast error:", err);
    return NextResponse.json(
      { error: "Gagal memproses broadcast." },
      { status: 500 }
    );
  }
}
