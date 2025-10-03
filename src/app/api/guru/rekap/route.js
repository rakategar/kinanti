import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

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
        kode: true,
        judul: true,
        deadline: true,
        kelas: true,
      },
    });
    if (!assignment) {
      return NextResponse.json(
        { error: "Tugas tidak ditemukan untuk kode/kelas tersebut." },
        { status: 404 }
      );
    }

    // Ambil semua siswa di kelas
    const students = await prisma.user.findMany({
      where: { role: "siswa", kelas },
      select: { id: true, nama: true, phone: true },
      orderBy: [{ nama: "asc" }],
    });

    // Ambil status & submission mereka untuk tugas ini
    const statuses = await prisma.assignmentStatus.findMany({
      where: { tugasId: assignment.id },
      select: { id: true, siswaId: true, status: true },
    });

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { tugasId: assignment.id },
      select: { id: true, siswaId: true, pdfUrl: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    // Map akses cepat
    const stBySiswa = new Map();
    for (const st of statuses) stBySiswa.set(st.siswaId, st.status);

    const subBySiswa = new Map();
    for (const sub of submissions) {
      if (!subBySiswa.has(sub.siswaId)) subBySiswa.set(sub.siswaId, sub); // ambil yang terbaru (karena sorted desc)
    }

    // Buat workbook
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Rekap");

    ws.columns = [
      { header: "Kelas", key: "kelas", width: 14 },
      { header: "Nama Siswa", key: "nama", width: 26 },
      { header: "No. HP", key: "phone", width: 18 },
      { header: "Kode", key: "kode", width: 12 },
      { header: "Judul", key: "judul", width: 32 },
      { header: "Deadline", key: "deadline", width: 20 },
      { header: "Status", key: "status", width: 16 },
      { header: "Submitted At", key: "submittedAt", width: 22 },
      { header: "File URL", key: "url", width: 60 },
    ];

    const deadlineStr = assignment.deadline
      ? new Date(assignment.deadline).toLocaleString("id-ID")
      : "—";

    for (const s of students) {
      const status = stBySiswa.get(s.id) || "BELUM_SELESAI";
      const sub = subBySiswa.get(s.id);
      ws.addRow({
        kelas: assignment.kelas || kelas,
        nama: s.nama || `Siswa ${s.id}`,
        phone: s.phone || "",
        kode: assignment.kode,
        judul: assignment.judul,
        deadline: deadlineStr,
        status,
        submittedAt: sub?.createdAt
          ? new Date(sub.createdAt).toLocaleString("id-ID")
          : "",
        url: sub?.pdfUrl || "",
      });
    }

    // Styling ringan header
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).alignment = { vertical: "middle", horizontal: "center" };

    const buffer = await wb.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rekap_${assignment.kode}_${kelas}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("POST /api/guru/rekap error:", err);
    return NextResponse.json(
      { error: "Gagal membuat rekap." },
      { status: 500 }
    );
  }
}
