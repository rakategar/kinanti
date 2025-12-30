import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const g = globalThis;
const prisma = g.__prisma || new PrismaClient({});
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

/**
 * GET /api/guru/penilaian?assignmentId=<id>
 * Mengambil data tugas dan daftar siswa beserta penilaiannya
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const assignmentId = searchParams.get("assignmentId");

    if (!assignmentId) {
      return NextResponse.json(
        { error: "assignmentId wajib diisi." },
        { status: 400 }
      );
    }

    const id = parseInt(assignmentId);
    if (isNaN(id)) {
      return NextResponse.json(
        { error: "assignmentId tidak valid." },
        { status: 400 }
      );
    }

    // Ambil data assignment
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      select: {
        id: true,
        kode: true,
        judul: true,
        kelas: true,
        deadline: true,
        pdfUrl: true,
        kunciJawaban: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: "Tugas tidak ditemukan." },
        { status: 404 }
      );
    }

    // Ambil daftar siswa di kelas ini
    const students = await prisma.user.findMany({
      where: {
        role: "siswa",
        kelas: assignment.kelas,
      },
      select: {
        id: true,
        nama: true,
        phone: true,
        kelas: true,
      },
      orderBy: { nama: "asc" },
    });

    // Ambil submission untuk tugas ini
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { tugasId: id },
      select: {
        siswaId: true,
        pdfUrl: true,
        createdAt: true,
        evaluation: true,
        grade: true,
        score: true,
      },
    });

    // Map submission by siswaId
    const subBySiswa = new Map();
    for (const sub of submissions) {
      // Ambil yang terbaru jika ada duplikat
      if (
        !subBySiswa.has(sub.siswaId) ||
        sub.createdAt > subBySiswa.get(sub.siswaId).createdAt
      ) {
        subBySiswa.set(sub.siswaId, sub);
      }
    }

    // Build rows
    const rows = students.map((s) => {
      const sub = subBySiswa.get(s.id);
      return {
        siswaId: s.id,
        nama: s.nama || `Siswa ${s.id}`,
        phone: s.phone || "",
        kelas: s.kelas || "",
        pdfUrl: sub?.pdfUrl || null,
        submittedAt: sub?.createdAt || null,
        evaluation: sub?.evaluation || "",
        grade: sub?.grade || "",
        score: sub?.score ?? "",
      };
    });

    return NextResponse.json({
      assignment,
      rows,
    });
  } catch (err) {
    console.error("GET /api/guru/penilaian error:", err);
    return NextResponse.json(
      { error: "Gagal memuat data penilaian." },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/guru/penilaian
 * Menyimpan perubahan penilaian
 * Body: { updates: [{ siswaId, tugasId, grade, score, evaluation }] }
 */
export async function PUT(req) {
  try {
    const body = await req.json();
    const updates = body.updates;

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada data untuk disimpan." },
        { status: 400 }
      );
    }

    // Update setiap submission
    const results = [];
    for (const update of updates) {
      const { siswaId, tugasId, grade, score, evaluation } = update;

      if (!siswaId || !tugasId) {
        continue;
      }

      // Cari submission yang ada
      const existing = await prisma.assignmentSubmission.findFirst({
        where: { siswaId, tugasId },
        select: { id: true },
      });

      if (existing) {
        // Update existing
        const updated = await prisma.assignmentSubmission.update({
          where: { id: existing.id },
          data: {
            grade: grade || null,
            score:
              score !== null && score !== undefined && score !== ""
                ? parseInt(score)
                : null,
            evaluation: evaluation || null,
          },
        });
        results.push({ siswaId, tugasId, status: "updated", id: updated.id });
      } else {
        // Jika belum ada submission, skip (siswa belum mengumpulkan)
        results.push({
          siswaId,
          tugasId,
          status: "skipped",
          reason: "no_submission",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${
        results.filter((r) => r.status === "updated").length
      } penilaian berhasil disimpan.`,
      results,
    });
  } catch (err) {
    console.error("PUT /api/guru/penilaian error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan penilaian." },
      { status: 500 }
    );
  }
}
