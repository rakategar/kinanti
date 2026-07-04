import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const g = globalThis;
const prisma = g.prisma || new PrismaClient({});
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = Number(searchParams.get("userId"));
    const tugasId = Number(searchParams.get("tugasId"));

    if (!userId || !tugasId || Number.isNaN(userId) || Number.isNaN(tugasId)) {
      return NextResponse.json(
        { error: "userId dan tugasId wajib diisi" },
        { status: 400 }
      );
    }

    // Ambil submission terbaru dari siswa untuk tugas ini
    const submission = await prisma.assignmentSubmission.findFirst({
      where: {
        siswaId: userId,
        tugasId: tugasId,
      },
      select: {
        id: true,
        pdfUrl: true,
        evaluation: true,
        grade: true,
        score: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!submission) {
      return NextResponse.json(
        { error: "Submission tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json(submission, { status: 200 });
  } catch (error) {
    console.error("Error GET /api/submission-detail:", error);
    return NextResponse.json(
      { error: "Gagal mengambil detail submission" },
      { status: 500 }
    );
  }
}
