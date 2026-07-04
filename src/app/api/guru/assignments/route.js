import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/authOptions";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const siswaRoleWhere = {
  OR: [{ role: "siswa" }],
};

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const isDetail = searchParams.get("detail");
    if (isDetail) {
      const assignmentId = Number(searchParams.get("assignmentId"));
      if (!assignmentId || Number.isNaN(assignmentId)) {
        return NextResponse.json(
          { error: "assignmentId wajib diisi" },
          { status: 400 }
        );
      }

      const session = await getServerSession(authOptions);
      const sid = Number(session?.user?.id) || null;

      const a = await prisma.assignment.findUnique({
        where: { id: assignmentId },
        select: {
          id: true,
          kode: true,
          judul: true,
          kelas: true,
          deadline: true,
          guruId: true,
          kunciJawaban: true,
        },
      });
      if (!a)
        return NextResponse.json(
          { error: "Tugas tidak ditemukan" },
          { status: 404 }
        );

      const siswaKelas = await prisma.user.findMany({
        where: { ...siswaRoleWhere, kelas: a.kelas ?? undefined },
        select: { id: true, nama: true, kelas: true },
        orderBy: { nama: "asc" },
      });

      const subs = await prisma.assignmentSubmission.findMany({
        where: { tugasId: assignmentId },
        select: { id: true, siswaId: true, createdAt: true },
      });

      const firstSubmitBySiswa = new Map();
      for (const s of subs) {
        const prev = firstSubmitBySiswa.get(s.siswaId);
        if (
          !prev ||
          new Date(s.createdAt).getTime() < new Date(prev.createdAt).getTime()
        ) {
          firstSubmitBySiswa.set(s.siswaId, s);
        }
      }

      const deadlineMs = a.deadline ? new Date(a.deadline).getTime() : null;

      const belumList = [];
      const terlambatList = [];
      const selesaiList = [];

      siswaKelas.forEach((u, idx0) => {
        const nama = u.nama || u.name || "—";
        const submit = firstSubmitBySiswa.get(u.id);
        const row = {
          no: idx0 + 1,
          siswaId: u.id,
          nama,
          kelas: u.kelas || a.kelas || "-",
        };

        if (!submit) {
          belumList.push(row);
        } else {
          const subMs = new Date(submit.createdAt).getTime();
          if (deadlineMs && subMs > deadlineMs) terlambatList.push(row);
          else selesaiList.push(row);
        }
      });

      const payload = {
        assignment: {
          id: a.id,
          kode: a.kode,
          judul: a.judul,
          kelas: a.kelas,
          deadline: a.deadline,
          kunciJawaban: a.kunciJawaban,
        },
        count: {
          belum: belumList.length,
          terlambat: terlambatList.length,
          selesai: selesaiList.length,
        },
        belumList,
        terlambatList,
        selesaiList,
      };

      return NextResponse.json(payload);
    }

    const guruId = Number(searchParams.get("guruId"));
    if (!guruId || Number.isNaN(guruId)) {
      return NextResponse.json(
        { error: "guruId wajib diisi" },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const sid = Number(session?.user?.id) || null;

    const assignments = await prisma.assignment.findMany({
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
        kunciJawaban: true,
      },
    });

    const kelasSet = Array.from(
      new Set(assignments.map((a) => a.kelas).filter(Boolean))
    );
    const siswaByKelas = new Map();
    if (kelasSet.length > 0) {
      const allSiswa = await prisma.user.findMany({
        where: { ...siswaRoleWhere, kelas: { in: kelasSet } },
        select: { id: true, nama: true, kelas: true },
      });
      for (const s of allSiswa) {
        if (!s.kelas) continue;
        if (!siswaByKelas.has(s.kelas)) siswaByKelas.set(s.kelas, []);
        siswaByKelas.get(s.kelas).push(s);
      }
    }

    const ids = assignments.map((a) => a.id);
    const allSubs = ids.length
      ? await prisma.assignmentSubmission.findMany({
          where: { tugasId: { in: ids } },
          select: { siswaId: true, tugasId: true, createdAt: true },
        })
      : [];

    const firstSubmit = new Map();
    for (const s of allSubs) {
      const key = `${s.tugasId}:${s.siswaId}`;
      const prev = firstSubmit.get(key);
      if (!prev || new Date(s.createdAt).getTime() < new Date(prev).getTime()) {
        firstSubmit.set(key, s.createdAt);
      }
    }

    const now = Date.now();

    const result = assignments.map((a) => {
      const deadlineMs = a.deadline ? new Date(a.deadline).getTime() : null;
      const siswaKelas = a.kelas ? siswaByKelas.get(a.kelas) || [] : [];

      let belum = 0;
      let terlambat = 0;
      let selesai = 0;

      for (const s of siswaKelas) {
        const key = `${a.id}:${s.id}`;
        const subAt = firstSubmit.get(key);
        if (!subAt) {
          belum++;
        } else {
          const subMs = new Date(subAt).getTime();
          if (deadlineMs && subMs > deadlineMs) terlambat++;
          else selesai++;
        }
      }

      return {
        ...a,
        statusSummary: { belum, terlambat, selesai },
        statusRingkas:
          a.deadline && new Date(a.deadline).getTime() < now
            ? "Terlambat"
            : "Aktif",
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("GET /api/guru/assignments error:", e);
    return NextResponse.json(
      { error: "Gagal memuat assignments" },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!id || Number.isNaN(id)) {
      return NextResponse.json({ error: "id wajib diisi" }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const sid = Number(session?.user?.id);
    if (!sid)
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

    const found = await prisma.assignment.findUnique({
      where: { id },
      include: { submissions: true },
    });
    if (!found)
      return NextResponse.json(
        { error: "Tugas tidak ditemukan" },
        { status: 404 }
      );
    if (found.guruId !== sid) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    await prisma.assignmentSubmission.deleteMany({ where: { tugasId: id } });
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
