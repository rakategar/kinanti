// app/api/guru/broadcast/route.js
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

    // Ambil semua siswa pada kelas yang sama
    const students = await prisma.user.findMany({
      where: { role: "siswa", kelas },
      select: { id: true, nama: true, phone: true },
    });

    // Panggil API bot
    const botUrl =
      process.env.BOT_INTERNAL_URL || "http://localhost:4000/broadcast";
    const headers = { "Content-Type": "application/json" };
    if (process.env.BOT_SECRET) {
      headers["Authorization"] = `Bearer ${process.env.BOT_SECRET}`;
    }

    const resp = await fetch(botUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        kode,
        kelas,
        siswa: students,
        judul: assignment.judul,
        deadline: assignment.deadline,
        pdfUrl: assignment.pdfUrl,
      }),
    });

    const result = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      console.error("Bot response error:", result);
      return NextResponse.json(
        { error: result?.error || "Gagal kirim ke bot." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Broadcast diproses oleh bot.",
      detail: result,
    });
  } catch (err) {
    console.error("POST /api/guru/broadcast error:", err);
    return NextResponse.json(
      { error: "Gagal memproses broadcast." },
      { status: 500 }
    );
  }
}
