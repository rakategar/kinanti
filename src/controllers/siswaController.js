// src/controllers/siswaController.js
// Fitur Siswa: daftar tugas, detail tugas, status tugas, dan kumpul tugas (unggah PDF ke Supabase)
// Diselaraskan dengan server.js & intents, memakai schema: assignmentStatus(siswaId, tugasId, status: SELESAI/BELUM_SELESAI)

const prismaMod = require("../config/prisma");
const prisma = prismaMod?.prisma ?? prismaMod?.default ?? prismaMod;
const { uploadPDFtoSupabase } = require("../utils/pdfUtils");

// ========== State pengumpulan (in-memory) ==========
// key = JID pengirim → { step: "await_pdf", assignmentId: <tugas.id>, assignmentKode, requirePdf }
const PENDING = new Map();

// ========== Utils ==========
function isGroupJid(jid = "") {
  return String(jid).endsWith("@g.us");
}
function phoneFromJid(jid = "") {
  return String(jid || "").replace(/@c\.us$/i, "");
}
function nowStamp() {
  return new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
}
function fmtDateWIB(d) {
  try {
    const date = d instanceof Date ? d : new Date(d);
    return date.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(d || "-");
  }
}
function matchAny(text, arr) {
  const s = (text || "").toLowerCase();
  return arr.some((k) => s.includes(k));
}

// ========== Data helpers ==========
async function getStudentBySender(senderJid) {
  const phone = phoneFromJid(senderJid);
  return prisma.user.findFirst({
    where: { phone, role: "siswa" },
  });
}

// Daftar tugas BELUM_SELESAI (untuk menu "tugas saya")
async function listOpenAssignments(student) {
  return prisma.assignmentStatus.findMany({
    where: { siswaId: student.id, status: "BELUM_SELESAI" },
    include: { tugas: { include: { guru: true } } },
  });
}

// Daftar tugas SELESAI (untuk menu "status tugas"/riwayat)
async function listSubmittedAssignments(student) {
  return prisma.assignmentStatus.findMany({
    where: { siswaId: student.id, status: "SELESAI" },
    include: { tugas: true },
  });
}

// Cari tugas sesuai kode (harus memang untuk kelas siswa & ada statusnya)
async function findAssignmentForStudentByKode(student, kode) {
  const tugas = await prisma.assignment.findFirst({
    where: { kode: kode.toUpperCase(), kelas: student.kelas },
    include: { guru: true },
  });
  if (!tugas) return null;
  const st = await prisma.assignmentStatus.findFirst({
    where: { tugasId: tugas.id, siswaId: student.id },
  });
  if (!st) return null;
  return { assignment: tugas, status: st };
}

// Mulai sesi pengumpulan tugas
async function beginSubmission(message, student, assignment) {
  const requirePdf = !!assignment.requirePdf || !!assignment.wajibPdf;
  PENDING.set(message.from, {
    step: "await_pdf",
    assignmentId: assignment.id,
    assignmentKode: assignment.kode,
    requirePdf,
  });

  const lampiran = assignment.pdfUrl
    ? `\n📎 Lampiran dari guru: ${assignment.pdfUrl}`
    : "";

  await message.reply(
    "📝 *Pengumpulan Tugas*\n" +
      `• Kode: *${assignment.kode}*\n` +
      `• Judul: *${assignment.judul}*\n` +
      `• Deadline: ${fmtDateWIB(assignment.deadline)}\n` +
      lampiran +
      "\n\nKirim *dokumen PDF* tugas kamu di chat ini." +
      (requirePdf ? " (PDF wajib)" : "") +
      "\nJika file kamu masih berupa foto, ketik *gambar ke pdf* untuk membuat PDF terlebih dahulu.\n" +
      "_Ketik *batal* untuk membatalkan._"
  );
}

/**
 * Upsert submission yang robust terhadap variasi skema:
 * - Coba composite unique siswaId_tugasId atau tugasId_siswaId
 * - Jika tidak ada, fallback: findFirst + update/create
 */
async function safeUpsertSubmission({ tugasId, siswaId, data }) {
  try {
    return await prisma.assignmentSubmission.upsert({
      where: { siswaId_tugasId: { siswaId, tugasId } },
      update: data,
      create: { tugasId, siswaId, ...data },
    });
  } catch (_) {
    try {
      return await prisma.assignmentSubmission.upsert({
        where: { tugasId_siswaId: { tugasId, siswaId } },
        update: data,
        create: { tugasId, siswaId, ...data },
      });
    } catch (_) {
      const existing = await prisma.assignmentSubmission.findFirst({
        where: { tugasId, siswaId },
        select: { id: true },
      });
      if (existing?.id) {
        return prisma.assignmentSubmission.update({
          where: { id: existing.id },
          data,
        });
      }
      return prisma.assignmentSubmission.create({
        data: { tugasId, siswaId, ...data },
      });
    }
  }
}

// Terima & proses PDF saat menunggu pengumpulan
async function handleMediaWhilePending(message, pending, student) {
  const mimeGuess = message._data?.mimetype || message.mimetype || "";
  const isPdfLike =
    message.type === "document" ||
    message.hasMedia ||
    /^application\/pdf$/i.test(mimeGuess);

  if (!isPdfLike) return false;

  let media;
  try {
    media = await message.downloadMedia();
  } catch (e) {
    console.error("[siswaController] downloadMedia error:", e);
    await message.reply(
      "⚠️ Gagal mengambil file. Kirim ulang dokumen PDF kamu."
    );
    return true;
  }

  const mimetype = media?.mimetype || mimeGuess;
  if (!/application\/pdf/i.test(mimetype)) {
    await message.reply(
      "⚠️ Yang diterima untuk pengumpulan adalah *dokumen PDF*. Jika masih berupa foto, ketik *gambar ke pdf* dulu ya."
    );
    return true;
  }

  try {
    const buffer = Buffer.from(media.data, "base64");
    const phone = phoneFromJid(message.from);
    const subdir = `users/siswa/${phone}/submissions`;
    const origName = message._data?.filename || media?.filename || "tugas.pdf";
    const safeName = origName.toLowerCase().endsWith(".pdf")
      ? origName
      : `${origName}.pdf`;
    const fileName = `${pending.assignmentKode}_${nowStamp()}_${safeName}`;

    const url = await uploadPDFtoSupabase(
      buffer,
      fileName,
      "application/pdf",
      subdir
    );

    // Simpan submission + set status SELESAI
    await safeUpsertSubmission({
      tugasId: pending.assignmentId,
      siswaId: student.id,
      data: {
        fileUrl: url,
        fileName,
        submittedAt: new Date(),
        via: "whatsapp_document",
      },
    });

    await prisma.assignmentStatus.updateMany({
      where: { tugasId: pending.assignmentId, siswaId: student.id },
      data: { status: "SELESAI" },
    });

    PENDING.delete(message.from);
    await message.reply(
      "✅ *Tugas terkumpul!*\n" +
        `• Kode: *${pending.assignmentKode}*\n` +
        `• File: ${fileName}\n` +
        "Terima kasih. Kamu bisa cek status dengan ketik *status tugas*."
    );
  } catch (e) {
    console.error("[siswaController] upload/DB error:", e);
    await message.reply(
      "❌ Gagal menyimpan pengumpulan. Coba lagi atau kirim ulang PDF."
    );
  }

  return true;
}

// ========== Controller utama ==========
async function handleSiswaCommand(message, opts = {}) {
  try {
    // DM-only
    if (isGroupJid(message.from)) {
      await message.reply(
        "ℹ️ Fitur siswa hanya tersedia di *chat pribadi*. Silakan DM bot ya."
      );
      return;
    }

    if (!prisma || !prisma.user || !prisma.assignment) {
      console.warn("[siswaController] Prisma belum siap / salah ekspor.");
      await message.reply(
        "⚠️ Fitur siswa belum siap: koneksi database belum terhubung."
      );
      return;
    }

    const intent = opts.intent || "";
    const body = String(message.body || "").trim();
    const lbody = body.toLowerCase();

    // Ambil siswa
    const student = await getStudentBySender(message.from);
    if (!student) {
      await message.reply(
        "⚠️ Nomor kamu belum terdaftar sebagai *siswa* di sistem."
      );
      return;
    }

    // ===== 1) Prioritas: sesi pengumpulan aktif =====
    const pending = PENDING.get(message.from);
    if (pending) {
      if (lbody === "batal") {
        PENDING.delete(message.from);
        await message.reply("❌ Pengumpulan dibatalkan.");
        return;
      }
      const handled = await handleMediaWhilePending(message, pending, student);
      if (handled) return;
      if (!message.hasMedia && body) {
        await message.reply(
          "Silakan *kirim dokumen PDF* tugas kamu. Jika file masih berupa foto, ketik *gambar ke pdf* untuk membuat PDF.\n_Ketik *batal* untuk membatalkan._"
        );
        return;
      }
      return;
    }

    // ===== 2) Routing intents & keyword fallback (SELALU aktif) =====

    // A. Daftar tugas (BELUM_SELESAI)
    if (
      intent === "siswa_list_tugas" ||
      intent === "siswa_tugas_saya" ||
      matchAny(lbody, [
        "tugas saya",
        "daftar tugas",
        "tugas belum",
        "lihat tugas",
        "list tugas",
      ])
    ) {
      const rows = await listOpenAssignments(student);
      if (!rows.length) {
        await message.reply("✅ Kamu tidak memiliki tugas yang belum selesai.");
        return;
      }
      let resp = "📌 *Daftar Tugas Belum Selesai*\n";
      for (const r of rows) {
        const t = r.tugas;
        resp +=
          "\n" +
          `• Kode: *${t.kode}*\n` +
          `  Judul: ${t.judul}\n` +
          `  Guru: ${t.guru?.name || t.guru?.nama || "-"}\n` +
          `  Deadline: ${fmtDateWIB(t.deadline)}\n` +
          (t.pdfUrl ? `  Lampiran: ${t.pdfUrl}\n` : "") +
          `  Cara kumpul: ketik *kumpul ${t.kode}* lalu kirim PDF.\n`;
      }
      await message.reply(resp);
      return;
    }

    // B. Status/riwayat (SELESAI)
    if (
      intent === "siswa_status" ||
      matchAny(lbody, ["status tugas", "status", "riwayat tugas", "riwayat"])
    ) {
      const rows = await listSubmittedAssignments(student);
      if (!rows.length) {
        await message.reply("ℹ️ Belum ada tugas yang kamu kumpulkan.");
        return;
      }
      let resp = "🗂️ *Riwayat Pengumpulan (SELESAI)*\n";
      for (const r of rows) {
        const t = r.tugas;
        resp +=
          `\n• ${t.kode} — ${t.judul}\n` +
          `  Status: SELESAI\n` +
          `  Deadline: ${fmtDateWIB(t.deadline)}\n`;
      }
      await message.reply(resp);
      return;
    }

    // C. Detail/info tugas <KODE> (intent atau keyword)
    if (intent === "siswa_detail_tugas") {
      const kode = (
        opts.entities?.kode ||
        opts.entities?.kode_tugas ||
        opts.entities?.assignmentCode ||
        ""
      )
        .toString()
        .trim()
        .toUpperCase();
      if (!kode) {
        await message.reply("Format: *detail <KODE>* (contoh: _detail RPL-1_)");
        return;
      }
      const found = await findAssignmentForStudentByKode(student, kode);
      if (!found) {
        await message.reply(
          `⚠️ Tugas dengan kode *${kode}* tidak ditemukan untuk kelas kamu.`
        );
        return;
      }
      const t = found.assignment;
      await message.reply(
        "📝 *Detail Tugas*\n" +
          `• Kode: *${t.kode}*\n` +
          `• Judul: *${t.judul}*\n` +
          `• Deskripsi: ${t.deskripsi || "-"}\n` +
          `• Deadline: ${fmtDateWIB(t.deadline)}\n` +
          `• Kelas: ${t.kelas}\n` +
          (t.pdfUrl ? `• Lampiran Guru: ${t.pdfUrl}\n` : "")
      );
      return;
    }
    const md = lbody.match(/(?:detail|info)\s+([a-z0-9_-]+)/i);
    if (md) {
      const kode = md[1].toUpperCase();
      const found = await findAssignmentForStudentByKode(student, kode);
      if (!found) {
        await message.reply(
          `⚠️ Tugas dengan kode *${kode}* tidak ditemukan untuk kelas kamu.`
        );
        return;
      }
      const t = found.assignment;
      await message.reply(
        "📝 *Detail Tugas*\n" +
          `• Kode: *${t.kode}*\n` +
          `• Judul: *${t.judul}*\n` +
          `• Deskripsi: ${t.deskripsi || "-"}\n` +
          `• Deadline: ${fmtDateWIB(t.deadline)}\n` +
          `• Kelas: ${t.kelas}\n` +
          (t.pdfUrl ? `• Lampiran Guru: ${t.pdfUrl}\n` : "")
      );
      return;
    }

    // D. Kumpul <KODE>
    let kumpulKode = null;
    if (intent === "siswa_kumpul_tugas") {
      kumpulKode = (opts.entities?.kode || opts.entities?.assignmentCode || "")
        .toString()
        .trim();
    }
    if (!kumpulKode) {
      const m = lbody.match(/kumpul\s+([a-z0-9_-]+)/i);
      if (m) kumpulKode = m[1].toUpperCase();
    }
    if (kumpulKode) {
      const found = await findAssignmentForStudentByKode(student, kumpulKode);
      if (!found) {
        await message.reply(
          `⚠️ Tugas dengan kode *${kumpulKode}* tidak ditemukan untuk kelas kamu.`
        );
        return;
      }
      await beginSubmission(message, student, found.assignment);
      return;
    }

    // E. Menu siswa
    if (
      intent === "siswa_help" ||
      matchAny(lbody, ["bantuan", "help", "menu", "siswa"])
    ) {
      await message.reply(
        "👋 *Menu Siswa*\n" +
          "• *tugas saya* — lihat tugas belum selesai\n" +
          "• *status tugas* — lihat riwayat (SELESAI)\n" +
          "• *detail <KODE>* — lihat detail tugas tertentu\n" +
          "• *kumpul <KODE>* — mulai pengumpulan tugas (kirim PDF)\n" +
          "• *gambar ke pdf* — ubah foto jadi PDF (alat bantu)\n"
      );
      return;
    }

    // ===== Fallback =====
    await message.reply(
      "ℹ️ Tidak mengenali perintahmu.\n" +
        "Ketik *menu* untuk melihat perintah siswa atau *kumpul <KODE>* untuk mulai pengumpulan."
    );
  } catch (e) {
    console.error("handleSiswaCommand error:", e);
    await message.reply("Maaf, terjadi kesalahan pada fitur siswa.");
  }
}

module.exports = { handleSiswaCommand };
