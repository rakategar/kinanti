import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/authOptions";

const g = globalThis;
const prisma = g.prisma || new PrismaClient({});
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { originalId, newKode, newKelas } = body;

    if (!originalId || !newKode || !newKelas) {
      return NextResponse.json(
        { error: "Data tidak lengkap" },
        { status: 400 }
      );
    }

    // Ambil assignment asli
    const original = await prisma.assignment.findUnique({
      where: { id: Number(originalId) },
      select: {
        judul: true,
        deskripsi: true,
        deadline: true,
        guruId: true,
        pdfUrl: true,
        lampirkanPDF: true,
        kunciJawaban: true,
      },
    });

    if (!original) {
      return NextResponse.json(
        { error: "Assignment tidak ditemukan" },
        { status: 404 }
      );
    }

    // Cek apakah kode sudah ada
    const existing = await prisma.assignment.findUnique({
      where: { kode: newKode.toUpperCase() },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Kode tugas sudah digunakan" },
        { status: 400 }
      );
    }

    // Buat assignment baru (salinan)
    const newAssignment = await prisma.assignment.create({
      data: {
        kode: newKode.toUpperCase(),
        judul: original.judul,
        deskripsi: original.deskripsi,
        kelas: newKelas.toUpperCase(),
        guruId: original.guruId,
        deadline: original.deadline,
        pdfUrl: original.pdfUrl,
        lampirkanPDF: original.lampirkanPDF,
        kunciJawaban: original.kunciJawaban,
      },
    });

    // Buat status untuk semua siswa di kelas baru
    const siswaList = await prisma.user.findMany({
      where: {
        role: "siswa",
        kelas: newKelas.toUpperCase(),
      },
      select: { id: true },
    });

    if (siswaList.length > 0) {
      await prisma.assignmentStatus.createMany({
        data: siswaList.map((s) => ({
          siswaId: s.id,
          tugasId: newAssignment.id,
          status: "BELUM_SELESAI",
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json(
      {
        success: true,
        assignment: newAssignment,
        message: "Tugas berhasil diduplikasi",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error POST /api/assignments/duplicate:", error);
    return NextResponse.json(
      { error: "Gagal menduplikasi tugas: " + error.message },
      { status: 500 }
    );
  }
}
