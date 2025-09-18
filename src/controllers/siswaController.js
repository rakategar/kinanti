// src/controllers/siswaController.js

const prisma = require("../config/prisma"); // pastikan export PrismaClient singleton
const { MessageMedia } = require("whatsapp-web.js");

// =========================
// STATE PERSISTEN DI MEMORI (untuk buffer media per user)
// Catatan: progres/slots utama sudah disimpan di ConversationState (DB).
// Di sini hanya cache foto sementara sampai "selesai".
const pendingLocal = {}; // { phone: { mode:'kumpul', kode_tugas, images: [{mimetype, data(base64)}], fileNameHint } }
// =========================

// Util: ambil user berdasarkan phone (pastikan phone sudah dinormalisasi "628xxxxx")
async function getUserByPhone(phone) {
  return prisma.user.findUnique({ where: { phone } });
}

// Util: ambil assignment by kode
async function getAssignmentByKode(kode) {
  return prisma.assignment.findUnique({ where: { kode } });
}

// Util: Format tanggal WIB sederhana
function fmtDate(dt) {
  if (!dt) return "-";
  const d = new Date(dt);
  return d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });
}

// ============ HANDLERS INTENT ============

async function handleTanyaTugasAktif(message, { user }) {
  // Tampilkan semua tugas yang statusnya BELUM_SELESAI untuk siswa ini
  const statuses = await prisma.assignmentStatus.findMany({
    where: { siswaId: user.id, status: "BELUM_SELESAI" },
    include: { tugas: true },
    orderBy: [{ updatedAt: "desc" }],
    take: 20,
  });

  if (!statuses.length) {
    return message.reply("Tidak ada tugas aktif. 🎉");
  }

  const lines = statuses.map(
    (s, i) =>
      `${i + 1}. ${s.tugas.kode} — ${s.tugas.judul}${
        s.tugas.deadline ? ` (deadline: ${fmtDate(s.tugas.deadline)})` : ""
      }`
  );
  return message.reply(`Berikut tugas aktifmu:\n${lines.join("\n")}`);
}

async function handleTanyaDeadline(message, { entities }) {
  const { kode_tugas } = entities;
  const asg = await getAssignmentByKode(kode_tugas);
  if (!asg) return message.reply(`Kode tugas *${kode_tugas}* tidak ditemukan.`);
  const d = asg.deadline ? fmtDate(asg.deadline) : "Belum diatur";
  return message.reply(`Deadline *${asg.kode}* — ${asg.judul}: ${d}`);
}

async function handleStatusTugas(message, { user, entities }) {
  const { kode_tugas } = entities || {};
  if (kode_tugas) {
    const asg = await getAssignmentByKode(kode_tugas);
    if (!asg)
      return message.reply(`Kode tugas *${kode_tugas}* tidak ditemukan.`);
    const st = await prisma.assignmentStatus.findFirst({
      where: { tugasId: asg.id, siswaId: user.id },
    });
    if (!st)
      return message.reply(`Kamu tidak terdaftar pada tugas *${asg.kode}*.`);
    return message.reply(`Status *${asg.kode}*: ${st.status}`);
  }

  // Ringkas semua
  const [belum, selesai] = await Promise.all([
    prisma.assignmentStatus.count({
      where: { siswaId: user.id, status: "BELUM_SELESAI" },
    }),
    prisma.assignmentStatus.count({
      where: { siswaId: user.id, status: "SELESAI" },
    }),
  ]);
  return message.reply(
    `Ringkasan tugasmu:\n- BELUM SELESAI: ${belum}\n- SELESAI: ${selesai}`
  );
}

// ============ FLOW KUMPUL ============

async function handleKumpulStart(message, { user, entities }) {
  const { kode_tugas } = entities;
  const asg = await getAssignmentByKode(kode_tugas);
  if (!asg) return message.reply(`Kode tugas *${kode_tugas}* tidak ditemukan.`);

  // Cek apakah siswa terdaftar di assignment ini
  const st = await prisma.assignmentStatus.findFirst({
    where: { tugasId: asg.id, siswaId: user.id },
  });
  if (!st)
    return message.reply(`Kamu tidak terdaftar pada tugas *${kode_tugas}*.`);

  // Set local buffer
  pendingLocal[user.phone] = {
    mode: "kumpul",
    kode_tugas,
    images: [],
    fileNameHint: null,
  };
  return message.reply(
    `Siap kumpul *${kode_tugas}* — *${asg.judul}*.\n` +
      `Silakan KIRIM foto-foto tugasnya (boleh lebih dari satu). ` +
      `Kalau sudah, balas: *selesai*.\n` +
      `Opsional: kasih nama file dulu dengan pesan: *nama: <namafilemu>*`
  );
}

// Terima media (foto) saat mode kumpul aktif
async function handleIncomingMediaIfAny(message, { user }) {
  const buf = pendingLocal[user.phone];
  if (!buf || buf.mode !== "kumpul") return false;

  if (!message.hasMedia) return false;
  const media = await message.downloadMedia();
  if (!media || !media.mimetype?.startsWith("image/")) {
    await message.reply("File bukan gambar. Kirim foto tugas ya.");
    return true;
  }
  buf.images.push({ mimetype: media.mimetype, data: media.data }); // base64
  await message.reply(
    `Foto diterima (${buf.images.length}). Kirim lagi bila perlu, atau balas *selesai* jika cukup.`
  );
  return true;
}

// Set nama file
async function handleSetNamaFile(message, { user, textNormalized }) {
  const buf = pendingLocal[user.phone];
  if (!buf || buf.mode !== "kumpul") return false;

  const m = /^nama\s*:\s*(.+)$/i.test(message.body)
    ? message.body.match(/^nama\s*:\s*(.+)$/i)
    : null;
  if (!m) return false;

  const raw = m[1].trim();
  // sanitasi sederhana
  const safe = raw
    .replace(/[^\p{L}\p{N}\-_ ]/gu, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);
  buf.fileNameHint = safe || null;
  await message.reply(`Nama file diset: *${buf.fileNameHint || "(otomatis)"}*`);
  return true;
}

// Selesaikan: gabung gambar → PDF → upload → create submission
async function handleKumpulSelesai(message, { user, supabase, pdfUtil }) {
  const buf = pendingLocal[user.phone];
  if (!buf || buf.mode !== "kumpul") return false;

  if (!buf.images.length) {
    await message.reply(
      "Belum ada foto yang kamu kirim. Kirim minimal 1 foto dulu ya."
    );
    return true;
  }

  const asg = await getAssignmentByKode(buf.kode_tugas);
  if (!asg) {
    delete pendingLocal[user.phone];
    return message.reply(
      `Tugas *${buf.kode_tugas}* tidak ditemukan. Mulai lagi ya.`
    );
  }

  try {
    // 1) Gambar → PDF (pakai util kamu yang sudah ada)
    // pdfBytes = await pdfUtil.imagesToPdf(buf.images)
    const pdfBytes = await pdfUtil.imagesToPdf(buf.images); // <- pastikan ada util ini

    // 2) Upload ke Supabase
    // path: assignments/<kode>/<userId>-<timestamp>.pdf
    const fileName = `${buf.fileNameHint || "tugas"}_${
      user.id
    }_${Date.now()}.pdf`;
    const path = `assignments/${asg.kode}/${fileName}`;
    const { data, error } = await supabase.storage
      .from("assignments")
      .upload(path, Buffer.from(pdfBytes), {
        contentType: "application/pdf",
        upsert: true,
      });
    if (error) throw error;

    // 3) Dapatkan public URL (atau signed URL)
    const { data: pub } = supabase.storage
      .from("assignments")
      .getPublicUrl(path);
    const pdfUrl = pub?.publicUrl;

    // 4) Catat submission & update status
    await prisma.assignmentSubmission.create({
      data: { siswaId: user.id, tugasId: asg.id, pdfUrl },
    });
    await prisma.assignmentStatus.updateMany({
      where: { siswaId: user.id, tugasId: asg.id },
      data: { status: "SELESAI" },
    });

    await message.reply(
      `✅ Terkumpul!\n*${asg.kode} — ${asg.judul}*\nLink PDF: ${pdfUrl}`
    );
  } catch (e) {
    console.error("submit error", e);
    await message.reply("Gagal memproses PDF atau upload. Coba lagi ya.");
  } finally {
    delete pendingLocal[user.phone];
  }
  return true;
}

// ============ ENTRY UTAMA ============

/**
 * Dipanggil dari server.js setelah NLP.
 * @param {any} message whatsapp message
 * @param {{ intent: string, entities: any, ctx: any }} options
 */
async function handleSiswaCommand(message, options = {}) {
  const { intent, entities, ctx } = options;
  const phone = String(message.from || "").replace(/@c\.us$/i, "");
  const user = await getUserByPhone(phone);
  if (!user)
    return message.reply("Akunmu belum terdaftar. Silakan hubungi guru.");

  // Hook: bila user kirim media saat mode kumpul
  if (await handleIncomingMediaIfAny(message, { user })) return;

  // Hook: set nama file
  if (
    await handleSetNamaFile(message, {
      user,
      textNormalized: ctx.textNormalized,
    })
  )
    return;

  // Hook: selesai
  if (/^selesai$/i.test(ctx.textNormalized || "")) {
    // butuh akses supabase client & util pdf dari konteks/DI kamu
    // Pastikan kamu injeksi di server.js saat memanggil handler:
    // handleSiswaCommand(message, { intent, entities, ctx, supabase, pdfUtil })
    return handleKumpulSelesai(message, {
      user,
      supabase: options.supabase,
      pdfUtil: options.pdfUtil,
    });
  }

  // Routing berdasarkan intent
  switch (intent) {
    case "siswa_tanya_tugas_aktif":
      return handleTanyaTugasAktif(message, { user });

    case "siswa_tanya_deadline":
      return handleTanyaDeadline(message, { entities });

    case "siswa_status_tugas":
      return handleStatusTugas(message, { user, entities });

    case "siswa_kumpul_tugas":
      return handleKumpulStart(message, { user, entities });

    case "siswa_batal_kumpul":
      delete pendingLocal[user.phone];
      return message.reply("Mode kumpul dibatalkan.");

    // Backward compatibility: bila pengguna mengetik “list”, “kumpul KODE”, dll
    default:
      // optional: panggil handler lama berbasis keyword bila ada
      return; // no-op → biarkan fallback/global help merespons
  }
}

module.exports = { handleSiswaCommand };
