import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ==========================
// GET /api/guru/assignments?guruId=123
// ==========================
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const guruId = Number(searchParams.get("guruId"));
    if (!guruId || Number.isNaN(guruId)) {
      return NextResponse.json(
        { error: "guruId wajib diisi" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const sid = Number(session?.user?.id);
    // Validasi opsional: pastikan guru yang login sama
    if (!sid || sid !== guruId) {
      // return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const list = await prisma.assignment.findMany({
      where: { guruId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        kode: true,
        judul: true,
        kelas: true,
        deadline: true,
        pdfUrl: true,
        createdAt: true,
      },
    });

    const now = Date.now();
    const payload = list.map((a) => ({
      ...a,
      overdueCount: a.deadline && new Date(a.deadline).getTime() < now ? 1 : 0,
      openCount: 0,
      statusRingkas:
        a.deadline && new Date(a.deadline).getTime() < now
          ? "Terlambat"
          : "Aktif",
    }));

    return NextResponse.json(payload);
  } catch (e) {
    console.error("GET /api/guru/assignments error:", e);
    return NextResponse.json(
      { error: "Gagal memuat assignments" },
      { status: 500 }
    );
  }
}

// ==========================
// DELETE /api/guru/assignments?id=999
// ==========================
// ==========================
// DELETE /api/guru/assignments?id=999
// ==========================
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const sid = Number(session?.user?.id);
    if (!sid) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    // cek & validasi kepemilikan
    const found = await prisma.assignment.findUnique({
      where: { id },
      include: { submissions: true }, // pastikan nama relasi sesuai model Assignment kamu
    });
    if (!found) {
      return NextResponse.json(
        { error: "Tugas tidak ditemukan" },
        { status: 404 }
      );
    }
    if (found.guruId !== sid) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    // 🔧 Hapus semua submission terkait tugas ini.
    // Gunakan RELATION FILTER sesuai schema: 'tugas' (bukan 'assignment')
    await prisma.assignmentSubmission.deleteMany({
      where: { tugas: { id } }, // <= ini kunci perbaikannya
    });
    // Catatan: kalau di schema-mu tidak ada relasi bernama 'tugas', tapi ada 'assignment',
    // pakai: where: { assignment: { id } } atau where: { tugasId: id }

    // Hapus record assignment utama
    await prisma.assignment.delete({ where: { id } });

    return NextResponse.json({
      ok: true,
      message: `Tugas ${found.kode} (${found.judul}) berhasil dihapus.`,
    });
  } catch (e) {
    console.error("DELETE /api/guru/assignments error:", e);
    return NextResponse.json(
      { error: "Gagal menghapus tugas." },
      { status: 500 }
    );
  }
}
