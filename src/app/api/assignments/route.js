import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req) {
  try {
    // Ambil userId dari query params
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "User ID tidak diberikan." },
        { status: 400 }
      );
    }

    // ✅ Konversi userId ke Number sebelum query
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) },
      select: { kelas: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User tidak ditemukan." },
        { status: 404 }
      );
    }

    if (!user.kelas) {
      return NextResponse.json(
        { error: "User tidak memiliki kelas." },
        { status: 400 }
      );
    }

    // ✅ Ambil tugas berdasarkan kelas user, serta status dan lampiran PDF yang dikumpulkan siswa
    const assignments = await prisma.assignment.findMany({
      where: { kelas: user.kelas.toString() },
      include: {
        status: {
          where: { siswaId: Number(userId) }, // Status tugas untuk siswa ini
          select: { status: true },
        },
        submissions: {
          where: { siswaId: Number(userId) }, // Lampiran PDF siswa ini
          select: { pdfUrl: true },
        },
      },
    });

    // Ubah format data agar lebih mudah dibaca frontend
    const formattedAssignments = assignments.map((assignment) => ({
      id: assignment.id,
      kodeTugas: assignment.kode, // 🆕 Kode tugas
      judul: assignment.judul,
      status:
        assignment.status.length > 0
          ? assignment.status[0].status
          : "BELUM_SELESAI",
      lampiranPDF: assignment.pdfUrl, // 🆕 Link PDF tugas (jika ada)
      lampiranDikumpulkan:
        assignment.submissions.length > 0
          ? assignment.submissions[0].pdfUrl.replace(/[';"]+/g, "")
          : null, // 🆕 Lampiran PDF yang dikumpulkan siswa (jika ada)
    }));

    console.log(formattedAssignments);

    return NextResponse.json(formattedAssignments);
  } catch (error) {
    console.error("Error fetching assignments:", error);
    return NextResponse.json(
      { error: "Gagal mengambil tugas" },
      { status: 500 }
    );
  }
}
