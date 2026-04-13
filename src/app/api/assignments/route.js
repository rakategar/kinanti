import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { isValidKelas, normalizeKelas } from "../../../utils/kelas";

// Prisma singleton (aman untuk Next.js)
const g = globalThis;
const prisma = g.prisma || new PrismaClient({});
if (process.env.NODE_ENV !== "production") g.prisma = prisma;

// Import Supabase config untuk upload
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Helper function untuk upload ke Supabase
async function uploadPDFtoSupabase(
  fileBuffer,
  fileName,
  subdir = "assignments"
) {
  const objectPath = `${subdir}/${fileName}`;
  const { error } = await supabase.storage
    .from("assignments")
    .upload(objectPath, fileBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) {
    console.error("Supabase upload error:", error);
    throw new Error("Gagal upload PDF ke Supabase");
  }
  return `${supabaseUrl}/storage/v1/object/public/assignments/${objectPath}`;
}

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
        kunciJawaban: a.kunciJawaban || null, // Tambahkan kunci jawaban
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
          kunciJawaban: a.kunciJawaban || null, // Tambahkan kunci jawaban
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

export async function POST(req) {
  try {
    const formData = await req.formData();

    const guruId = Number(formData.get("guruId"));
    const kode = formData.get("kode");
    const judul = formData.get("judul");
    const deskripsi = formData.get("deskripsi");
    const kelas = formData.get("kelas");
    const deadlineHari = formData.get("deadlineHari");
    const lampirPdf = formData.get("lampirPdf") === "true";
    const tambahKunciJawaban = formData.get("tambahKunciJawaban") === "true";

    // Validasi data wajib
    if (!guruId || !kode || !judul || !deskripsi || !kelas) {
      return NextResponse.json(
        { error: "Data tidak lengkap" },
        { status: 400 }
      );
    }

    const normalizedKelas = normalizeKelas(kelas);
    if (!isValidKelas(normalizedKelas)) {
      return NextResponse.json(
        { error: "Kelas tidak tersedia" },
        { status: 400 }
      );
    }

    // Hitung deadline
    let deadline = null;
    if (deadlineHari && !isNaN(Number(deadlineHari))) {
      const hari = Number(deadlineHari);
      if (!Number.isInteger(hari) || hari < 0) {
        return NextResponse.json(
          { error: "Deadline harus berupa angka 0 atau lebih" },
          { status: 400 }
        );
      }
      deadline = new Date(Date.now() + hari * 24 * 60 * 60 * 1000);
    } else if (deadlineHari) {
      return NextResponse.json(
        { error: "Deadline harus berupa angka 0 atau lebih" },
        { status: 400 }
      );
    }

    let pdfUrl = null;
    let kunciJawabanUrl = null;

    // Upload PDF tugas jika ada
    if (lampirPdf) {
      const file = formData.get("file");
      if (file && file instanceof File) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `tugas_${kode}_${Date.now()}.pdf`;
        pdfUrl = await uploadPDFtoSupabase(buffer, fileName, "tugas");
      }
    }

    // Upload kunci jawaban jika ada
    if (tambahKunciJawaban) {
      const kunciFile = formData.get("kunciJawabanFile");
      if (kunciFile && kunciFile instanceof File) {
        // Validasi tipe file
        if (kunciFile.type !== "application/pdf") {
          return NextResponse.json(
            { error: "Kunci jawaban harus berupa file PDF" },
            { status: 400 }
          );
        }

        const buffer = Buffer.from(await kunciFile.arrayBuffer());
        const fileName = `kunci_${kode}_${Date.now()}.pdf`;
        kunciJawabanUrl = await uploadPDFtoSupabase(
          buffer,
          fileName,
          "kunci-jawaban"
        );
      }
    }

    // Simpan ke database
    const assignment = await prisma.assignment.create({
      data: {
        kode: kode.toUpperCase(),
        judul,
        deskripsi,
        kelas: normalizedKelas,
        guruId,
        deadline,
        pdfUrl,
        lampirkanPDF: lampirPdf,
        kunciJawaban: kunciJawabanUrl, // Simpan URL kunci jawaban
      },
    });

    // Buat status untuk semua siswa di kelas tersebut
    const siswaList = await prisma.user.findMany({
      where: {
        role: "siswa",
        kelas: normalizedKelas,
      },
      select: { id: true },
    });

    if (siswaList.length > 0) {
      await prisma.assignmentStatus.createMany({
        data: siswaList.map((s) => ({
          siswaId: s.id,
          tugasId: assignment.id,
          status: "BELUM_SELESAI",
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json(
      {
        success: true,
        assignment,
        message: "Tugas berhasil dibuat",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error POST /api/assignments:", error);
    return NextResponse.json(
      { error: "Gagal membuat tugas: " + error.message },
      { status: 500 }
    );
  }
}
