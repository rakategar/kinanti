import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/guru/assignments?guruId=123
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

    // (Opsional) validasi kepemilikan: session.id === guruId
    const session = await getServerSession(authOptions);
    const sid = Number(session?.user?.id);
    if (!sid || sid !== guruId) {
      // demi keamanan, kamu bisa ketat di sini:
      // return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
      // atau longgar saja:
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
        // Jika kamu punya relasi status/submission dan ingin ringkasan, bisa include count di sini.
      },
    });

    // Tambahkan field ringkasan (dummy aman)
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
    console.error(e);
    return NextResponse.json(
      { error: "Gagal memuat assignments" },
      { status: 500 }
    );
  }
}

// DELETE /api/guru/assignments?id=999
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

    // Pastikan tugas milik guru yang login
    const found = await prisma.assignment.findUnique({ where: { id } });
    if (!found) {
      return NextResponse.json(
        { error: "Tugas tidak ditemukan" },
        { status: 404 }
      );
    }
    if (found.guruId !== sid) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    // Jika ada relasi (status/submission), hapus dulu anak-anaknya sesuai FK (atau ON DELETE CASCADE via schema)
    // Contoh:
    // await prisma.assignmentStatus.deleteMany({ where: { assignmentId: id } });
    // await prisma.assignmentSubmission.deleteMany({ where: { assignmentId: id } });

    await prisma.assignment.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "Gagal menghapus tugas" },
      { status: 500 }
    );
  }
}
