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

    // === OPTIMASI 1: Gabungkan query assignment dengan include ===
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

    // === OPTIMASI 2: Parallel Query dengan Promise.all ===
    const [students, statuses, submissions] = await Promise.all([
      prisma.user.findMany({
        where: { role: "siswa", kelas },
        select: { id: true, nama: true, phone: true },
        orderBy: [{ nama: "asc" }],
      }),
      prisma.assignmentStatus.findMany({
        where: { tugasId: assignment.id },
        select: { siswaId: true, status: true },
      }),
      prisma.assignmentSubmission.findMany({
        where: { tugasId: assignment.id },
        select: {
          siswaId: true,
          pdfUrl: true,
          createdAt: true,
          evaluation: true,
          grade: true,
          score: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // === OPTIMASI 3: Map building lebih efisien ===
    const stBySiswa = new Map(statuses.map((st) => [st.siswaId, st.status]));
    const subBySiswa = new Map();

    // Hanya ambil submission terbaru per siswa
    for (const sub of submissions) {
      if (!subBySiswa.has(sub.siswaId)) {
        subBySiswa.set(sub.siswaId, sub);
      }
    }

    // ===== ExcelJS Workbook =====
    const wb = new ExcelJS.Workbook();
    wb.creator = "LOGICODE";
    wb.created = new Date();

    const ws = wb.addWorksheet("Rekap", {
      views: [{ state: "frozen", ySplit: 1 }],
    });

    // Kolom
    ws.columns = [
      { header: "Kelas", key: "kelas", width: 14 },
      { header: "Nama Siswa", key: "nama", width: 28 },
      { header: "No. HP", key: "phone", width: 16 },
      { header: "Kode", key: "kode", width: 12 },
      { header: "Judul", key: "judul", width: 40 },
      { header: "Deadline", key: "deadline", width: 20 },
      { header: "Status", key: "status", width: 18 },
      { header: "Submitted At", key: "submittedAt", width: 22 },
      { header: "File URL", key: "url", width: 60 },
      { header: "Evaluation", key: "evaluation", width: 50 },
      { header: "Grade", key: "grade", width: 12 },
      { header: "Score", key: "score", width: 12 },
    ];

    const deadlineStr = assignment.deadline
      ? new Date(assignment.deadline).toLocaleString("id-ID", {
          timeZone: "Asia/Jakarta",
        })
      : "—";

    // === OPTIMASI 4: Build rows array terlebih dahulu ===
    const rows = students.map((s) => {
      const status = stBySiswa.get(s.id) || "BELUM_SELESAI";
      const sub = subBySiswa.get(s.id);

      return {
        kelas: assignment.kelas || kelas,
        nama: s.nama || `Siswa ${s.id}`,
        phone: s.phone || "",
        kode: assignment.kode,
        judul: assignment.judul,
        deadline: deadlineStr,
        status,
        submittedAt: sub?.createdAt
          ? new Date(sub.createdAt).toLocaleString("id-ID", {
              timeZone: "Asia/Jakarta",
            })
          : "",
        url: sub?.pdfUrl || "",
        evaluation: sub?.evaluation || "",
        grade: sub?.grade ?? "",
        score: sub?.score !== null && sub?.score !== undefined ? sub.score : "",
      };
    });

    // === OPTIMASI 5: Bulk insert rows ===
    ws.addRows(rows);

    // ===== Styling header =====
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.alignment = { vertical: "middle", horizontal: "center" };
    header.height = 22;
    header.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0EA5E9" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF93C5FD" } },
        left: { style: "thin", color: { argb: "FF93C5FD" } },
        bottom: { style: "thin", color: { argb: "FF93C5FD" } },
        right: { style: "thin", color: { argb: "FF93C5FD" } },
      };
    });

    // Wrap text untuk kolom panjang
    ["judul", "url", "evaluation"].forEach((key) => {
      const col = ws.getColumn(key);
      col.alignment = { wrapText: true, vertical: "top" };
    });

    // Alignment untuk kolom numerik
    ws.getColumn("score").alignment = {
      horizontal: "center",
      vertical: "middle",
    };
    ws.getColumn("grade").alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    // AutoFilter
    ws.autoFilter = {
      from: "A1",
      to: "L1",
    };

    // === OPTIMASI 6: Simplified table creation ===
    // Hindari penggunaan ws.getRows() yang lambat
    if (rows.length > 0) {
      const tableRef = `A1:L${rows.length + 1}`;
      ws.addTable({
        name: "RekapTable",
        ref: tableRef,
        headerRow: true,
        totalsRow: false,
        style: {
          theme: "TableStyleMedium9",
          showRowStripes: true,
        },
        columns: [
          { name: "Kelas", filterButton: true },
          { name: "Nama Siswa", filterButton: true },
          { name: "No. HP", filterButton: true },
          { name: "Kode", filterButton: true },
          { name: "Judul", filterButton: true },
          { name: "Deadline", filterButton: true },
          { name: "Status", filterButton: true },
          { name: "Submitted At", filterButton: true },
          { name: "File URL", filterButton: true },
          { name: "Evaluation", filterButton: true },
          { name: "Grade", filterButton: true },
          { name: "Score", filterButton: true },
        ],
        rows: rows.map((row) => [
          row.kelas,
          row.nama,
          row.phone,
          row.kode,
          row.judul,
          row.deadline,
          row.status,
          row.submittedAt,
          row.url,
          row.evaluation,
          row.grade,
          row.score,
        ]),
      });
    }

    // === OPTIMASI 7: Stream buffer untuk memory efficiency ===
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
