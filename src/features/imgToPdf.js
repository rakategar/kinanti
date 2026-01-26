// src/features/imgToPdf.js
// Gambar → PDF untuk GURU & SISWA (chat pribadi, in-memory session)
// - Ketik: "gambar ke pdf" → masuk mode unggah gambar
// - Kirim 1..N gambar
// - Opsional: "judul: Nama_File"
// - Ketik: "selesai" → bila belum ada judul diminta nama file; bila ada langsung dibuatkan PDF
// - PDF dikirim langsung ke user (dokumen WhatsApp), TIDAK diunggah ke DB

const { imagesToPdf } = require("../utils/pdfUtil");
const { MessageMedia } = require("whatsapp-web.js");
const { safeReply } = require("../utils/waHelper");

// ===== In-memory session (key = JID pengirim) =====
const sessions = new Map();
/*
  sessions.get(jid) = {
    step: "upload_images" | "request_filename",
    images: Array<{ mimetype: string, data: string(base64) }>,
    note: string|null,
    startedAt: number
  }
*/

const IDLE_MS = 30 * 60 * 1000; // auto-expire 30 menit
setInterval(() => {
  const now = Date.now();
  for (const [jid, s] of sessions.entries()) {
    if (now - (s.startedAt || now) > IDLE_MS) sessions.delete(jid);
  }
}, 5 * 60 * 1000);

function isGroupJid(jid = "") {
  return String(jid).endsWith("@g.us");
}
function nowStamp() {
  return new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
}
function sanitizeName(s = "") {
  const x = String(s || "").replace(/[^A-Za-z0-9_-]/g, "_");
  return x || "IMG2PDF";
}

// ============ PUBLIC API: dipanggil dari server.js ============
async function startImgToPdf(message) {
  if (isGroupJid(message.from)) return false;

  sessions.set(message.from, {
    step: "upload_images",
    images: [],
    note: null,
    startedAt: Date.now(),
  });

  await safeReply(message, 
    "🖼️➡️📄 *Gambar ke PDF*\n\n" +
      "Kirim *1 atau beberapa gambar* (JPG/PNG/WEBP).\n\n" +
      "📌 *Perintah:*\n" +
      "*1.* ✅ Selesai & buat PDF\n" +
      "*0.* ❌ Batal\n\n" +
      "_Opsional:_ ketik *judul: <nama_file>* untuk nama PDF\n" +
      "_Catatan: hanya tersedia di chat pribadi._"
  );
  return true;
}

async function onIncomingMedia(message) {
  if (isGroupJid(message.from)) return false;

  // Deteksi gambar yang robust (kadang hasMedia=false tapi type='image')
  const looksImage =
    message.hasMedia ||
    message.type === "image" ||
    (message.type === "document" &&
      /^image\//i.test(message._data?.mimetype || message.mimetype || "")) ||
    /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif)$/i.test(
      message._data?.filename || message.filename || ""
    );
  if (!looksImage) return false;

  const sess = sessions.get(message.from);
  if (!sess || sess.step !== "upload_images") return false; // bukan di mode img->pdf

  let media;
  try {
    media = await message.downloadMedia();
  } catch (e) {
    console.error("[imgToPdf] downloadMedia error:", e);
    await safeReply(message, 
      "⚠️ Gagal mengambil media. Coba kirim ulang gambarnya ya."
    );
    return true;
  }

  if (!media || !/^image\//i.test(media.mimetype || "")) {
    await safeReply(message, 
      "⚠️ Hanya file *gambar/foto* yang diperbolehkan (JPG/PNG/WEBP)."
    );
    return true;
  }

  sess.images.push({ mimetype: media.mimetype, data: media.data }); // base64
  sess.startedAt = Date.now();
  await safeReply(message, `✅ Gambar diterima. Total: *${sess.images.length}*\n\n📌 Perintah:
1. ✅ Selesai & buat PDF
0. ❌ Batal`);
  return true;
}

async function onIncomingText(message) {
  if (isGroupJid(message.from)) return false;

  const body = String(message.body || "").trim();
  const b = body.toLowerCase();
  const sess = sessions.get(message.from);

  // ❗ Tanpa sesi → JANGAN balas, biar alur lain (mis. penugasan) yang menangani
  if (!sess) return false;

  // BATAL: ketik "0" atau "batal"
  if (b === "0" || b === "batal") {
    sessions.delete(message.from);
    await safeReply(message, 
      "❌ Dibatalkan. Tidak ada PDF yang dibuat.\n\n" +
        "Ketik *halo* untuk kembali ke menu."
    );
    return true;
  }

  // Set judul di mana saja
  const mJudul = body.match(/^judul\s*:\s*(.+)$/i);
  if (mJudul) {
    sess.note = sanitizeName(mJudul[1].trim().slice(0, 60));
    sess.startedAt = Date.now();
    await safeReply(message, `📝 Judul diset: *${sess.note}*`);
    return true;
  }

  // Flow per step
  if (sess.step === "upload_images") {
    // SELESAI: ketik "1" atau "selesai"
    if (b === "1" || b === "selesai") {
      if (!sess.images.length) {
        await safeReply(message, 
          "⚠️ Belum ada gambar yang diterima.\n\n" +
            "Kirim gambar dulu, lalu ketik *1* untuk selesai."
        );
        return true;
      }
      if (!sess.note) {
        sess.step = "request_filename";
        sess.startedAt = Date.now();
        await safeReply(message, 
          "📎 Ketik *nama file* untuk PDF (tanpa spasi).\n" +
            "Contoh: _Tugas_TKJ_\n\n" +
            "Atau ketik *0* untuk batal."
        );
        return true;
      }
      await finalizeAndSend(message, sess);
      return true;
    }

    // Jika user masih memakai "simpan", beri arahan singkat (hanya saat sesi aktif)
    if (b === "simpan") {
      await safeReply(message, 
        'Perintah *"simpan"* tidak dipakai di sini. Ketik *1* untuk selesai 🙏'
      );
      return true;
    }

    // Teks lain → hint
    await safeReply(message, 
      "Kirim *gambar/foto* sebanyak yang dibutuhkan.\n\n" +
        "📌 *Perintah:*\n" +
        "*1.* ✅ Selesai & buat PDF\n" +
        "*0.* ❌ Batal\n\n" +
        "_Opsional:_ *judul: <nama_file>*"
    );
    return true;
  }

  if (sess.step === "request_filename") {
    const name = sanitizeName(body);
    if (!name) {
      await safeReply(message, 
        "⚠️ Nama file tidak boleh kosong.\n" +
          "Contoh: _Tugas_TKJ_\n\n" +
          "Ketik *0* untuk batal."
      );
      return true;
    }
    sess.note = name;
    await finalizeAndSend(message, sess);
    return true;
  }

  // fallback
  await safeReply(message, 
    "Ketik *0* untuk batal atau *halo* untuk kembali ke menu."
  );
  return true;
}

// ===== Finalisasi: render PDF & kirim langsung ke user =====
async function finalizeAndSend(message, sess) {
  try {
    await safeReply(message, "⏳ Memproses gambar menjadi PDF...");

    // 1) Render PDF (Buffer)
    const pdfBuffer = await imagesToPdf(sess.images);

    // 2) Buat MessageMedia dari buffer → base64
    const fileName = `${sess.note || "IMG2PDF"}_${nowStamp()}.pdf`;
    const media = new MessageMedia(
      "application/pdf",
      pdfBuffer.toString("base64"),
      fileName
    );

    // 3) Kirim sebagai dokumen (bukan pratinjau)
    const chat = await message.getChat();
    await chat.sendMessage(media, {
      sendMediaAsDocument: true,
      caption:
        `📄 *${fileName}*\n\n` +
        `✅ PDF berhasil dibuat dari ${sess.images.length} gambar.\n\n` +
        `Ketik *halo* untuk kembali ke menu.`,
    });

    // 4) Selesai → hapus sesi
    sessions.delete(message.from);
  } catch (err) {
    console.error("[imgToPdf] finalize error:", err);
    await safeReply(message, 
      "❌ Terjadi kesalahan saat membuat/kirim PDF. Coba lagi ya."
    );
  }
}

module.exports = {
  startImgToPdf,
  onIncomingMedia,
  onIncomingText,
};
