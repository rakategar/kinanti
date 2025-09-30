import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

// Prisma singleton (aman untuk Next.js)
const g = globalThis;
const prisma = g.prisma || new PrismaClient({});
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userIdParam = searchParams.get("userId");
    const userId = Number(userIdParam);

    if (!userIdParam || Number.isNaN(userId)) {
      return NextResponse.json(
        { error: "User ID tidak diberikan/invalid." },
        { status: 400 }
      );
    }

    // Cek user & kelas
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, kelas: true },
    });
    if (!user)
      return NextResponse.json(
        { error: "User tidak ditemukan." },
        { status: 404 }
      );

    // ---------- PATH A: user.kelas TERISI -> ambil tugas berdasarkan kelas ----------
    if (user.kelas && String(user.kelas).trim() !== "") {
      const assignments = await prisma.assignment.findMany({
        where: { kelas: String(user.kelas) },
        include: {
          // Status milik siswa ini
          status: {
            where: { siswaId: userId },
            select: { status: true },
          },
          // Submission terbaru milik siswa ini (kalau ada)
          submissions: {
            where: { siswaId: userId },
            select: { pdfUrl: true, createdAt: true },
            // orderBy dihapus; biar frontend yang urut — kita cukup ambil satu terbaru via take=1
            take: 1,
          },
        },
        // orderBy dihapus; frontend yang akan mengurutkan
      });

      const formatted = assignments.map((a) => ({
        id: a.id,
        kode: a.kode,
        judul: a.judul,
        deadline: a.deadline,
        status: a.status?.[0]?.status || "BELUM_SELESAI",
        lampiranPDF: a.pdfUrl || null, // lampiran dari guru
        lampiranDikumpulkan: a.submissions?.[0]?.pdfUrl || null, // file yang dikumpulkan siswa
      }));

      return NextResponse.json(formatted, { status: 200 });
    }

    // ---------- PATH B: user.kelas KOSONG -> ambil lewat AssignmentStatus siswa ----------
    // 1) Ambil semua status milik siswa (+tugas untuk dapat judul/kode/deadline)
    const statuses = await prisma.assignmentStatus.findMany({
      where: { siswaId: userId },
      include: { tugas: true },
      // orderBy dihapus; frontend yang akan mengurutkan
    });

    // 2) Ambil semua submission milik siswa (map by tugasId -> submission terbaru)
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { siswaId: userId },
      select: { tugasId: true, pdfUrl: true, createdAt: true },
      // orderBy dihapus; frontend yang akan mengurutkan bila perlu
    });
    const subByTugas = new Map();
    for (const s of submissions) {
      // Simpan yang pertama kali kita jumpai; karena tidak diurutkan,
      // kalau butuh benar-benar "terbaru", pertimbangkan sorting di frontend atau tambah orderBy di sini
      if (!subByTugas.has(s.tugasId)) subByTugas.set(s.tugasId, s.pdfUrl);
    }

    // 3) Normalisasi & unique per tugasId (kalau ada duplikat status)
    const outMap = new Map();
    for (const st of statuses) {
      const a = st.tugas;
      if (!a) continue;
      if (!outMap.has(a.id)) {
        outMap.set(a.id, {
          id: a.id,
          kode: a.kode,
          judul: a.judul,
          deadline: a.deadline,
          status: st.status || "BELUM_SELESAI",
          lampiranPDF: a.pdfUrl || null,
          lampiranDikumpulkan: subByTugas.get(a.id) || null,
        });
      } else {
        // jika sudah ada, pilih status "tertinggi" (SELESAI menang atas BELUM_SELESAI)
        const cur = outMap.get(a.id);
        const newStatus = st.status || "BELUM_SELESAI";
        if (cur.status !== "SELESAI" && newStatus === "SELESAI") {
          cur.status = "SELESAI";
        }
        // update lampiranDikumpulkan jika belum ada
        if (!cur.lampiranDikumpulkan && subByTugas.get(a.id)) {
          cur.lampiranDikumpulkan = subByTugas.get(a.id);
        }
      }
    }

    // 4) Kembalikan array (tanpa sort; biar frontend yang mengurutkan)
    const formatted = Array.from(outMap.values());
    return NextResponse.json(formatted, { status: 200 });
  } catch (error) {
    console.error("Error /api/assignments:", error);
    return NextResponse.json(
      { error: "Gagal mengambil tugas" },
      { status: 500 }
    );
  }
}
