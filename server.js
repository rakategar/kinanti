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

// Fitur gambar → PDF (guru & siswa, chat pribadi)
const {
  startImgToPdf,
  onIncomingMedia,
  onIncomingText,
} = require("./src/features/imgToPdf");

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
// WhatsApp Message Loop
// =====================
waClient.on("message", async (message) => {
  try {
    // ---- Intersep gambar/teks untuk sesi img_to_pdf ----
    const isImageLike =
      message.hasMedia ||
      message.type === "image" ||
      (message.type === "document" &&
        /^image\//i.test(message._data?.mimetype || message.mimetype || ""));

    if (isImageLike) {
      const handled = await onIncomingMedia(message); // boolean
      if (handled) return; // stop hanya jika benar-benar ditangani oleh sesi img_to_pdf
    } else if (typeof message.body === "string") {
      // Kirim SEMUA teks ke handler img_to_pdf; handler akan cek apakah ada sesi aktif
      const handled = await onIncomingText(message); // boolean
      if (handled) return;
    }

    // ---- NLP normal ----
    const ctx = await nlpPipeline(message);
    const { dialog } = ctx;

    // Slot-filling belum lengkap → tanya slot
    if (!dialog.done) {
      return message.reply(dialog.message);
    }

    const intent = dialog.to || "";

    // Mulai sesi img_to_pdf (guru & siswa)
    if (intent === "img_to_pdf" || intent === "guru_img_to_pdf") {
      await startImgToPdf(message);
      return;
    }

    // ---- Role-aware routing: hanya kirim ke GuruController jika benar2 guru ----
    let role = await getUserRoleByJid(message.from);
    // Normalisasi role
    if (role === "teacher") role = "guru";
    if (role === "student") role = "siswa";

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
        // BUKAN guru → jangan arahkan ke guruController; teruskan ke siswaController agar tidak mentok
        return handleSiswaCommand(message, {
          intent, // boleh diteruskan; siswaController akan abaikan intent guru
          entities: dialog.slots,
          ctx,
          supabase,
          pdfUtil,
        });
      }
    }

    // Default → siswaController
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
  console.log(qr);
});

waClient.on("ready", () => console.log("WhatsApp client is ready!"));
waClient.on("auth_failure", (m) => console.error("Auth failure:", m));
waClient.on("disconnected", (r) => console.error("Disconnected:", r));
