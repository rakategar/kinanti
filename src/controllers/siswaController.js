
// src/controllers/siswaController.js
// Fitur Siswa: daftar tugas, detail tugas, status tugas, dan kumpul tugas (unggah PDF ke Supabase)
// + Fitur Umum: Greeting (halo/assalamualaikum) untuk guru & siswa, serta nomor belum terdaftar.

const prismaMod = require("../config/prisma");
const prisma = prismaMod?.prisma ?? prismaMod?.default ?? prismaMod;
const { uploadPDFtoSupabase } = require("../utils/pdfUtils");

// ========== State pengumpulan (in-memory) ==========
// key = JID pengirim → { step: "await_pdf", assignmentId: <tugas.id>, assignmentKode, requirePdf }
const PENDING = new Map();

// ========== Quotes semangat (acak) ==========
const QUOTES = [
  "Belajar itu maraton, bukan sprint. Pelan tapi konsisten! 🏃‍♂️",
  "Setiap hari adalah kesempatan baru buat jadi lebih keren dari kemarin. ✨",
  "Jangan takut salah, karena dari situ kita naik level. 🎮",
  "Sedikit demi sedikit, lama-lama jadi bukit. Keep going! ⛰️",
  "Ilmu itu bekal, mimpi itu bensin. Gas terus! ⛽🚀",
];

// ========== Utils ==========
function isGroupJid(jid = "") {
  return String(jid).endsWith("@g.us");
}
function phoneFromJid(jid = "") {
  return String(jid || "").replace(/@c\.us$/i, "");
}
function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}
function fmtDateWIB(dt) {
  try {
    const d = new Date(dt);
    const fmt = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return fmt.format(d);
  } catch {
    return String(dt || "-");
  }
}
function matchAny(text, arr) {
  const s = (text || "").toLowerCase();
  return arr.some((k) => s.includes(k));
}
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ========== Data helpers ==========
async function getUserBySender(senderJid) {
  const phone = phoneFromJid(senderJid);
  return prisma.user.findFirst({ where: { phone } });
}
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

// Riwayat tugas (SELESAI)
async function listDoneAssignments(student) {
  return prisma.assignmentStatus.findMany({
    where: { siswaId: student.id, status: "SELESAI" },
    include: { tugas: true },
    orderBy: { updatedAt: "desc" },
  });
}

// Dapatkan tugas by kode (yang memang ditugaskan ke siswa tsb)
async function findAssignmentForStudentByKode(student, kode) {
  const asg = await prisma.assignment.findFirst({
    where: { kode },
    include: { guru: true },
  });
  if (!asg) return null;

  const status = await prisma.assignmentStatus.findFirst({
    where: { tugasId: asg.id, siswaId: student.id },
  });
  if (!status) return null;

  return { assignment: asg, status };
}

// ========== Pengumpulan ==========

// Mulai sesi pengumpulan
async function beginSubmission(message, student, assignment) {
  const requirePdf = true; // untuk sementara wajib PDF
  // simpan state
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
    "📝 *Pengumpulan Tugas Baru!*\n" +
      `📌 Kode: *${assignment.kode}*\n` +
      `📖 Judul: *${assignment.judul}*\n` +
      `⏰ Deadline: ${fmtDateWIB(assignment.deadline)}\n` +
      lampiran +
      "\n\n👉 Kirim *PDF tugas* kamu di sini ya!" +
      (requirePdf ? " (PDF *wajib* 🔒)" : " (PDF opsional 😎)") +
      "\nKalau masih berupa foto, ketik *gambar ke pdf* dulu biar rapi ✨\n" +
      "_Ketik *batal* kalau mau cancel 🙅_"
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
  } catch {
    try {
      return await prisma.assignmentSubmission.upsert({
        where: { tugasId_siswaId: { tugasId, siswaId } },
        update: data,
        create: { tugasId, siswaId, ...data },
      });
    } catch {
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

  if (!isPdfLike) {
    await message.reply(
      "⚠️ Format belum cocok. Kirim *PDF* ya. Kalau masih foto, ketik *gambar ke pdf* dulu."
    );
    return;
  }

  try {
    const media = await message.downloadMedia();
    if (!media?.data) throw new Error("No media data");

    const buffer = Buffer.from(media.data, "base64");
    const subdir = `users/siswa/${student.phone}/submissions`;
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
        pdfUrl: url,
      },
    });

    await prisma.assignmentStatus.updateMany({
      where: {
        tugasId: pending.assignmentId,
        siswaId: student.id,
      },
      data: { status: "SELESAI" },
    });

    PENDING.delete(message.from);
    await message.reply(
      "🎉 *Tugas sukses terkumpul!*\n" +
        `📌 Kode: *${pending.assignmentKode}*\n` +
        `📂 File: ${fileName}\n` +
        "Mantap! 🚀 Cek status dengan ketik *status tugas*."
    );
  } catch (e) {
    console.error("[siswaController] upload/DB error:", e);
    await message.reply("😢 Oops, gagal simpan tugas. Coba lagi ya.");
  }
}

// ========== MENU & INTENT SEDERHANA ==========
function buildHelp(role) {
  const r = String(role || "").toLowerCase();
  if (r === "guru" || r === "teacher") {
    return (
      "📚 *Menu Guru:*\n" +
      "• *buat tugas* — buat tugas\n" +
      "• *rekap <KODE>* — rekap pengumpulan tugas\n" +
      "• *list siswa* — daftar siswa di kelas\n" +
      "• *gambar ke pdf* — ubah foto jadi PDF"
    );
  }
  // default siswa
  return (
    "🎒 *Menu Siswa:*\n" +
    "• *tugas saya* — cek tugas belum selesai\n" +
    "• *status tugas* — riwayat tugas selesai\n" +
    "• *detail <KODE>* — lihat detail tugas\n" +
    "• *kumpul <KODE>* — kumpulin tugas (PDF)\n" +
    "• *gambar ke pdf* — ubah foto jadi PDF"
  );
}

// ========== GREETING HANDLER ==========
function isGreeting(text = "") {
  const s = String(text || "")
    .trim()
    .toLowerCase();
  // Kata kunci umum salam/sapaan
  const keys = [
    "halo",
    "hallo",
    "assalamualaikum",
    "assalamu'alaikum",
    "asalamualaikum",
    "selamat pagi",
    "selamat siang",
    "selamat sore",
    "selamat malam",
    "hai",
    "hey",
    "hei",
  ];
  return keys.some((k) => s.startsWith(k));
}

// Intent matcher sederhana
function detectIntent(body = "") {
  const s = (body || "").trim().toLowerCase();
  if (isGreeting(s)) return "greeting";
  if (/^tugas\s+saya$/.test(s)) return "siswa_tugas_saya";
  if (/^status\s+tugas$/.test(s)) return "siswa_status_tugas";
  if (/^detail\s+[-\w]+/i.test(s)) return "siswa_detail_tugas";
  if (/^kumpul\s+[-\w]+/i.test(s)) return "siswa_kumpul_tugas";
  if (/^menu$|^help$|^bantuan$/.test(s)) return "siswa_help";
  return "unknown";
}

// ========== Handler utama siswa ==========
async function handleSiswaCommand(message, opts = {}) {
  try {
    // === NEW: Prioritaskan state PENDING lebih dulu ===
    const pending = PENDING.get(message.from);
    if (pending) {
      const bodyLower = String(message.body || "")
        .trim()
        .toLowerCase();

      // batal
      if (bodyLower === "batal" || bodyLower === "cancel") {
        PENDING.delete(message.from);
        await message.reply(
          "❌ Pengumpulan dibatalkan. Ketik *kumpul <KODE>* lagi kalau mau mulai ulang."
        );
        return;
      }

      // pastikan pengirim adalah siswa terdaftar
      const studentWhilePending = await getStudentBySender(message.from);
      if (!studentWhilePending) {
        PENDING.delete(message.from);
        await message.reply(
          "📵 Nomor kamu belum terdaftar sebagai *siswa*. Daftar di https://kinantiku.com ya ✨"
        );
        return;
      }

      // jika ada media/dokumen, proses sebagai submission
      if (
        message.hasMedia ||
        ["document", "image", "video"].includes(message.type)
      ) {
        await handleMediaWhilePending(message, pending, studentWhilePending);
        return;
      }

      // selain itu, ingatkan untuk kirim PDF
      await message.reply(
        "↪️ Kamu sedang dalam sesi *pengumpulan tugas*.\nSilakan kirim *file PDF*-nya di sini ya.\nKetik *batal* untuk keluar."
      );
      return;
    }
    // === END NEW ===

    const body = String(message.body || "");
    const lbody = body.toLowerCase();
    const intent = detectIntent(body);

    const needsStudent = () =>
      [
        "siswa_tugas_saya",
        "siswa_status_tugas",
        "siswa_detail_tugas",
        "siswa_kumpul_tugas",
      ].includes(intent) ||
      matchAny(lbody, [
        "tugas saya",
        "daftar tugas",
        "tugas belum",
        "lihat tugas",
        "list tugas",
        "status tugas",
        "riwayat tugas",
        "riwayat",
        "detail ",
        "info ",
        "kumpul ",
      ]);

    let student = null;
    if (needsStudent()) {
      student = await getStudentBySender(message.from);
      if (!student) {
        await message.reply(
          "📵 Nomor kamu belum terdaftar sebagai *siswa*. Daftar di https://kinantiku.com ya ✨"
        );
        return;
      }
    }

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
      const items = await listOpenAssignments(student);
      if (!items?.length) {
        await message.reply(
          "✅ Tidak ada tugas yang belum selesai. Gas terus belajarnya! " +
            pickRandom(QUOTES)
        );
        return;
      }
      const lines = items.map((it, i) => {
        const tg = it.tugas;
        return (
          `${i + 1}. *${tg.kode}* — ${tg.judul}\n` +
          `   Guru: ${tg.guru?.nama || "-"} | Deadline: ${fmtDateWIB(
            tg.deadline
          )}`
        );
      });
      await message.reply(
        "📚 *Daftar Tugas Kamu* (pilih salah satu kodenya):\n\n" +
          lines.join("\n") +
          "\n\nKetik *kode tugas* yang ingin direkap. Contoh: _TKJ-09_"
      );
      return;
    }

    // B. Riwayat (SELESAI)
    if (
      intent === "siswa_status_tugas" ||
      matchAny(lbody, ["status tugas", "riwayat tugas", "riwayat"])
    ) {
      const items = await listDoneAssignments(student);
      if (!items?.length) {
        await message.reply("Belum ada tugas selesai. Semangat! 💪");
        return;
      }
      const lines = items.slice(0, 10).map((it, i) => {
        const tg = it.tugas;
        return `${i + 1}. *${tg.kode}* — ${tg.judul} (SELESAI)`;
      });
      await message.reply("🧾 *Riwayat Tugas Selesai:*\n" + lines.join("\n"));
      return;
    }

    // C. Detail <KODE>
    let detailKode = null;
    if (intent === "siswa_detail_tugas") {
      detailKode = (opts.entities?.kode || opts.entities?.assignmentCode || "")
        .toString()
        .trim();
    }
    if (!detailKode) {
      const m = lbody.match(/detail\s+([a-z0-9_-]+)/i);
      if (m) detailKode = m[1].toUpperCase();
    }
    if (detailKode) {
      const found = await findAssignmentForStudentByKode(student, detailKode);
      if (!found) {
        await message.reply(`😕 Tugas dengan kode *${detailKode}* ga ketemu.`);
        return;
      }
      const a = found.assignment;
      const lampiran = a.pdfUrl ? `\n📎 Lampiran: ${a.pdfUrl}` : "";
      await message.reply(
        "ℹ️ *Detail Tugas:*\n" +
          `• Kode: *${a.kode}*\n` +
          `• Judul: *${a.judul}*\n` +
          `• Instruksi: ${a.deskripsi || "-"}\n` +
          `• Deadline: ${fmtDateWIB(a.deadline)}${lampiran}`
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
        await message.reply(`😕 Tugas dengan kode *${kumpulKode}* ga ketemu.`);
        return;
      }
      await beginSubmission(message, student, found.assignment);
      return;
    }

    // E. Menu siswa (fallback bantuan)
    if (
      intent === "siswa_help" ||
      matchAny(lbody, ["bantuan", "help", "menu", "siswa"])
    ) {
      await message.reply(
        "📚 *Menu Siswa:*\n" +
          "• *tugas saya* — cek tugas belum selesai\n" +
          "• *status tugas* — riwayat tugas selesai\n" +
          "• *detail <KODE>* — lihat detail tugas\n" +
          "• *kumpul <KODE>* — kumpulin tugas (PDF)\n" +
          "• *gambar ke pdf* — ubah foto jadi PDF"
      );
      return;
    }

    // ===== Fallback =====
    await message.reply(
      "🤷 Perintah ga dikenali.\nKetik *menu* buat lihat opsi atau *kumpul <KODE>* buat kumpul tugas."
    );
  } catch (e) {
    console.error("handleSiswaCommand error:", e);
    await message.reply("😵 Aduh, ada error di fitur siswa. Coba lagi ya!");
  }
}

module.exports = { handleSiswaCommand };
