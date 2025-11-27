// server.js
require("dotenv").config();

const { nlpPipeline } = require("./src/nlp/pipeline");
const { handleSiswaCommand } = require("./src/controllers/siswaController");
const { handleGuruCommand } = require("./src/controllers/guruController");

const supabase = require("./src/config/supabase");
const pdfUtil = require("./src/utils/pdfUtil");
const excelUtil = require("./src/utils/excelUtil");

const prismaMod = require("./src/config/prisma");
const prisma = prismaMod?.prisma ?? prismaMod?.default ?? prismaMod;

const { client } = require("./src/client");
const waClient = client;

const {
  startImgToPdf,
  onIncomingMedia,
  onIncomingText,
} = require("./src/features/imgToPdf");
const { getState } = require("./src/services/state");
const { setupSchedules } = require("./src/controllers/scheduleController");
const qrcode = require("qrcode-terminal");

// ===== Helpers =====
function phoneFromJid(jid = "") {
  return String(jid || "").replace(/@c\.us$/i, "");
}
async function getUserRoleByJid(jid) {
  try {
    if (!prisma?.user?.findFirst) return null;
    const phone = phoneFromJid(jid);
    const user = await prisma.user.findFirst({ where: { phone } });
    return user?.role ? String(user.role).toLowerCase() : null;
  } catch (e) {
    console.warn("[server] getUserRoleByJid error:", e);
    return null;
  }
}

// =====================
// Helper: Sapaan & Menu
// =====================
function buildGreetingMessage(userName, role) {
  const greeting = `👋 Halo, *${userName}*!\n\nSelamat datang di *Kinanti Bot*.\n`;

  if (role === "guru" || role === "teacher") {
    return (
      greeting +
      "\n📚 *Menu Guru:*\n" +
      "• *buat tugas* — Buat tugas baru\n" +
      "• *kirim <KODE> <KELAS>* — Broadcast tugas ke kelas\n" +
      "• *rekap <KODE> <KELAS>* — Download rekap Excel\n" +
      "• *list siswa* — Daftar siswa di kelas\n" +
      "• *gambar ke pdf* — Ubah foto jadi PDF\n\n" +
      "Ketik perintah di atas untuk mulai! 🚀"
    );
  } else {
    // Siswa
    return (
      greeting +
      "\n🎒 *Menu Siswa:*\n" +
      "• *tugas saya* — Cek tugas belum selesai\n" +
      "• *status tugas* — Riwayat tugas selesai\n" +
      "• *detail <KODE>* — Lihat detail tugas\n" +
      "• *kumpul <KODE>* — Kumpulkan tugas (PDF)\n" +
      "• *gambar ke pdf* — Ubah foto jadi PDF\n\n" +
      "Ketik perintah di atas untuk mulai! 🚀"
    );
  }
}

// =====================
// WhatsApp Message Loop
// =====================
waClient.on("message", async (message) => {
  try {
    const isImageLike =
      message.hasMedia ||
      message.type === "image" ||
      (message.type === "document" &&
        /^image\//i.test(message._data?.mimetype || message.mimetype || ""));

    if (isImageLike) {
      const handled = await onIncomingMedia(message);
      if (handled) return;
    } else if (typeof message.body === "string") {
      const handled = await onIncomingText(message);
      if (handled) return;
    }

    const ctx = await nlpPipeline(message);
    const { dialog } = ctx;

    if (!dialog.done) {
      return message.reply(dialog.message);
    }

    const intent = dialog.to || "";

    // ========== HANDLER SAPAAN ==========
    if (intent === "sapaan_help") {
      const phone = phoneFromJid(message.from);

      // Cek apakah user terdaftar
      const user = await prisma.user.findFirst({
        where: { phone },
        select: { nama: true, role: true },
      });

      if (!user) {
        // User belum terdaftar
        return message.reply(
          "👋 Halo! Sepertinya kamu belum terdaftar di sistem Kinanti.\n\n" +
            "📝 Silakan daftar terlebih dahulu di:\n" +
            "🌐 *https://kinantiku.com*\n\n" +
            "Setelah mendaftar, kamu bisa kembali ke sini dan mulai menggunakan bot ini! 😊"
        );
      }

      // User sudah terdaftar, tampilkan menu sesuai role
      const userName = user.nama || "Pengguna";
      let userRole = String(user.role || "siswa").toLowerCase();
      if (userRole === "teacher") userRole = "guru";
      if (userRole === "student") userRole = "siswa";

      return message.reply(buildGreetingMessage(userName, userRole));
    }

    if (intent === "img_to_pdf" || intent === "guru_img_to_pdf") {
      await startImgToPdf(message);
      return;
    }

    let role = await getUserRoleByJid(message.from);
    if (role === "teacher") role = "guru";
    if (role === "student") role = "siswa";

    if (role === "guru") {
      const phone = phoneFromJid(message.from);
      const st = await getState(phone);
      if (st?.lastIntent === "guru_rekap_wizard") {
        return handleGuruCommand(message, {
          intent,
          entities: dialog.slots,
          ctx,
          waClient,
          excelUtil,
        });
      }
    }
    if (intent.startsWith("guru_")) {
      if (role === "guru") {
        return handleGuruCommand(message, {
          intent,
          entities: dialog.slots,
          ctx,
          waClient,
          excelUtil,
        });
      } else {
        return handleSiswaCommand(message, {
          intent,
          entities: dialog.slots,
          ctx,
          supabase,
          pdfUtil,
        });
      }
    }

    return handleSiswaCommand(message, {
      intent,
      entities: dialog.slots,
      ctx,
      supabase,
      pdfUtil,
    });
  } catch (e) {
    console.error("NLP/handler error:", e);
    return message.reply("Maaf, terjadi kesalahan. Coba lagi ya.");
  }
});

// =====================
// Lifecycle & Logging
// =====================
waClient.initialize();
console.log("Memulai Bot...");

waClient.on("qr", (qr) => {
  console.log("QR received, scan di WhatsApp!");
  console.log("\n=== SCAN QR CODE DI BAWAH INI ===\n");
  qrcode.generate(qr, { small: true });
  console.log("\n=================================\n");
});

waClient.on("ready", () => {
  console.log("WhatsApp client is ready!");
  setupSchedules();
});

waClient.on("auth_failure", (m) => console.error("Auth failure:", m));
waClient.on("disconnected", (r) => console.error("Disconnected:", r));

// =====================
// EXPRESS API (dipisah via routes/broadcast.js)
// =====================
const express = require("express");
const broadcastRouteFactory = require("./routes/broadcast"); // <- file terpisah

const app = express();
app.use(express.json());

// healthcheck sederhana
app.get("/", (req, res) => {
  res.json({ ok: true, msg: "Bot Kinanti aktif & siap menerima broadcast" });
});

// pasang route broadcast dengan injected waClient
app.use("/broadcast", broadcastRouteFactory(waClient));

const PORT = process.env.BOT_PORT || 4000;
app.listen(PORT, () => console.log(`Bot API listening on port ${PORT}`));
