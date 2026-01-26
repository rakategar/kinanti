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
const { getState, setState, clearState } = require("./src/services/state");
const { setupSchedules } = require("./src/controllers/scheduleController");
const qrcode = require("qrcode-terminal");
const { safeReply, safeSendMessage } = require("./src/utils/waHelper");

// ===== Global Error Handlers =====
process.on("unhandledRejection", (reason, promise) => {
  // Ignore markedUnread errors
  if (reason?.message?.includes("markedUnread")) {
    console.log("⚠️ [global] Ignored unhandledRejection: markedUnread");
    return;
  }
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  // Ignore markedUnread errors
  if (error?.message?.includes("markedUnread")) {
    console.log("⚠️ [global] Ignored uncaughtException: markedUnread");
    return;
  }
  console.error("Uncaught Exception:", error);
  // Don't exit on markedUnread
});

// ===== Helpers =====
function phoneFromJid(jid = "") {
  // Handle both @c.us and @lid formats
  return String(jid || "")
    .replace(/@c\.us$/i, "")
    .replace(/@lid$/i, "");
}

/**
 * Resolve LID to phone number using WhatsApp client
 * @param {Object} message - WhatsApp message object
 * @returns {string} - Phone number or original JID
 */
async function resolvePhoneFromMessage(message) {
  const jid = message.from || "";
  
  // If it's already @c.us format, extract phone directly
  if (jid.endsWith("@c.us")) {
    return phoneFromJid(jid);
  }
  
  // If it's @lid format, try to get the actual phone number
  if (jid.endsWith("@lid")) {
    try {
      // Method 1: Get from message author or contact
      const contact = await message.getContact();
      if (contact?.number) {
        console.log(`🔄 [LID] Resolved ${jid} → ${contact.number}`);
        return contact.number;
      }
      
      // Method 2: Try to get from contact id
      if (contact?.id?.user) {
        console.log(`🔄 [LID] Resolved from id ${jid} → ${contact.id.user}`);
        return contact.id.user;
      }
    } catch (err) {
      console.warn(`⚠️ [LID] Failed to resolve ${jid}:`, err.message);
    }
  }
  
  // Fallback: return the ID part without suffix
  return phoneFromJid(jid);
}

// Helper: retry database operation with exponential backoff
async function retryDbOperation(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      console.warn(
        `[server] DB attempt ${attempt}/${maxRetries} failed:`,
        err.message
      );
      if (attempt === maxRetries) throw err;
      // Wait before retry (exponential backoff)
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function getUserRoleByJid(jid) {
  try {
    if (!prisma?.user?.findFirst) return null;
    const phone = phoneFromJid(jid);
    const user = await retryDbOperation(() =>
      prisma.user.findFirst({ where: { phone } })
    );
    return user?.role ? String(user.role).toLowerCase() : null;
  } catch (e) {
    console.warn("[server] getUserRoleByJid error after retries:", e.message);
    return null;
  }
}

/**
 * Get user role by phone number directly
 */
async function getUserRoleByPhone(phone) {
  try {
    if (!prisma?.user?.findFirst) return null;
    if (!phone) return null;
    
    const user = await retryDbOperation(() =>
      prisma.user.findFirst({ where: { phone } })
    );
    return user?.role ? String(user.role).toLowerCase() : null;
  } catch (e) {
    console.warn("[server] getUserRoleByPhone error:", e.message);
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
      "*1.* 📝 Buat Tugas Baru\n" +
      "*2.* 📢 Broadcast Tugas ke Kelas\n" +
      "*3.* 📊 Rekap Excel Pengumpulan\n" +
      "*4.* 👥 Lihat Daftar Siswa\n" +
      "*5.* 🖼️ Gambar ke PDF\n" +
      "*6.* ❓ Bantuan\n" +
      "*0.* 🚪 Keluar\n\n" +
      "📌 *Balas dengan angka* untuk memilih menu."
    );
  } else {
    // Siswa - berbasis angka
    return (
      greeting +
      "\n🎒 *Menu Siswa:*\n" +
      "*1.* 📚 Tugas Saya (Belum Selesai)\n" +
      "*2.* ✅ Status Tugas (Riwayat)\n" +
      "*3.* 📝 Kumpul Tugas\n" +
      "*4.* 🖼️ Gambar ke PDF\n" +
      "*5.* ❓ Bantuan\n" +
      "*0.* 🚪 Keluar\n\n" +
      "📌 *Balas dengan angka* untuk memilih menu."
    );
  }
}

// =====================
// Helper: Guru Menu Selection
// =====================
const GURU_MENU_MAP = {
  1: "guru_buat_penugasan",
  2: "guru_broadcast_tugas",
  3: "guru_rekap_excel",
  4: "guru_list_siswa",
  5: "img_to_pdf",
  6: "guru_help",
  0: "guru_exit_menu",
};

// =====================
// Helper: Siswa Menu Selection
// =====================
const SISWA_MENU_MAP = {
  1: "siswa_tugas_saya",
  2: "siswa_status_tugas",
  3: "siswa_kumpul_tugas",
  4: "img_to_pdf",
  5: "siswa_help",
  0: "siswa_exit_menu",
};

/**
 * Cek apakah guru sedang dalam mode menu selection
 */
async function isGuruInMenuMode(phone) {
  const state = await getState(phone);
  return state?.menuMode === "guru_menu_selection";
}

/**
 * Set guru ke mode menu selection
 */
async function setGuruMenuMode(phone) {
  let state = (await getState(phone)) || {};
  state.menuMode = "guru_menu_selection";
  state.lastIntent = null; // Reset intent
  await setState(phone, state);
}

/**
 * Cek apakah siswa sedang dalam mode menu selection
 */
async function isSiswaInMenuMode(phone) {
  const state = await getState(phone);
  return state?.menuMode === "siswa_menu_selection";
}

/**
 * Set siswa ke mode menu selection
 */
async function setSiswaMenuMode(phone) {
  let state = (await getState(phone)) || {};
  state.menuMode = "siswa_menu_selection";
  state.lastIntent = null;
  await setState(phone, state);
}

/**
 * Clear guru menu mode
 */
async function clearGuruMenuMode(phone) {
  let state = (await getState(phone)) || {};
  delete state.menuMode;
  await setState(phone, state);
}

// =====================
// WhatsApp Message Loop
// =====================
waClient.on("message", async (message) => {
  try {
    // Abaikan pesan dari grup (JID berakhiran @g.us)
    if (String(message.from || "").endsWith("@g.us")) {
      console.log(`⏭️ [server] Skipping group message from: ${message.from}`);
      return;
    }

    // Resolve phone number (handle both @c.us and @lid formats)
    const phone = await resolvePhoneFromMessage(message);
    const rawText = (message.body || "").trim();

    // ========== CEK ROLE USER TERLEBIH DAHULU ==========
    // Use resolved phone number for database lookup
    let role = await getUserRoleByPhone(phone);
    console.log(`🔵 [server] Phone: ${phone}, Role: ${role}`);
    if (role === "teacher") role = "guru";
    if (role === "student") role = "siswa";

    // ========== GURU: CEK STATE KHUSUS ==========
    if (role === "guru") {
      const st = await getState(phone);
      console.log(`🔵 [server] Guru state:`, JSON.stringify(st));

      // 1) Cek apakah guru sedang dalam wizard (buat tugas / rekap / after create / broadcast / list siswa)
      if (
        st?.lastIntent === "guru_buat_penugasan" ||
        st?.lastIntent === "guru_rekap_wizard" ||
        st?.lastIntent === "guru_after_create" ||
        st?.lastIntent === "guru_broadcast_wizard" ||
        st?.lastIntent === "guru_listsiswa_wizard"
      ) {
        console.log(
          `🔵 [server] Routing to guru wizard handler for intent: ${st.lastIntent}`
        );
        // Handle media untuk wizard
        const isImageLike =
          message.hasMedia ||
          message.type === "image" ||
          (message.type === "document" &&
            /^image\//i.test(
              message._data?.mimetype || message.mimetype || ""
            ));

        if (isImageLike) {
          const handled = await onIncomingMedia(message);
          if (handled) return;
        }

        // Lanjutkan ke wizard handler
        const ctx = await nlpPipeline(message);
        return handleGuruCommand(message, {
          intent: st.lastIntent,
          entities: ctx.dialog.slots,
          ctx,
          waClient,
          excelUtil,
        });
      }

      // 2) Cek apakah guru sedang dalam menu selection mode
      if (st?.menuMode === "guru_menu_selection") {
        // Cek apakah input adalah angka menu
        const menuChoice = rawText.replace(/[^0-9]/g, ""); // Ambil angka saja

        if (GURU_MENU_MAP[menuChoice]) {
          const selectedIntent = GURU_MENU_MAP[menuChoice];

          // Handle exit menu
          if (selectedIntent === "guru_exit_menu") {
            await clearState(phone);
            return safeReply(message,
              "👋 Sampai jumpa! Ketik *halo* atau *mulai* kapan saja untuk kembali ke menu.",
              waClient
            );
          }

          // Handle img_to_pdf (shared feature)
          if (selectedIntent === "img_to_pdf") {
            await clearGuruMenuMode(phone);
            await startImgToPdf(message);
            return;
          }

          // Handle guru_help - tampilkan bantuan detail
          if (selectedIntent === "guru_help") {
            return safeReply(message,
              "❓ *Bantuan Menu Guru*\n\n" +
                "*1. Buat Tugas Baru*\n" +
                "   Membuat tugas baru dengan form interaktif.\n" +
                "   Bisa dengan/tanpa penilaian otomatis.\n\n" +
                "*2. Broadcast Tugas*\n" +
                "   Kirim pengumuman tugas ke semua siswa di kelas.\n\n" +
                "*3. Rekap Excel*\n" +
                "   Download rekap pengumpulan tugas dalam format Excel.\n\n" +
                "*4. Lihat Daftar Siswa*\n" +
                "   Melihat daftar siswa, bisa filter per kelas.\n\n" +
                "*5. Gambar ke PDF*\n" +
                "   Menggabungkan beberapa gambar menjadi 1 file PDF.\n\n" +
                "Kalau ada kendala yang lain, hubungi Admin yaa\n0895378394020 Raka (Admin) 😆\n\n" +
                "📌 Ketik angka untuk memilih menu, atau *0* untuk keluar.",
              waClient
            );
          }

          // Clear menu mode dan route ke fitur guru
          await clearGuruMenuMode(phone);

          const ctx = await nlpPipeline(message);
          return handleGuruCommand(message, {
            intent: selectedIntent,
            entities: ctx.dialog.slots || {},
            ctx,
            waClient,
            excelUtil,
          });
        } else {
          // Input bukan angka menu yang valid
          return safeReply(message,
            "⚠️ Pilihan tidak valid.\n\n" +
              "📌 Balas dengan *angka 0-6* untuk memilih menu:\n" +
              "*1.* Buat Tugas | *2.* Broadcast | *3.* Rekap\n" +
              "*4.* Daftar Siswa | *5.* Gambar ke PDF | *6.* Bantuan\n" +
              "*0.* Keluar",
            waClient
          );
        }
      }

      // 3) Cek apakah guru mengetik sapaan untuk masuk ke menu
      const isSapaan =
        /^(halo|hai|hey|hei|mulai|start|menu|kinanti|assalamualaikum)/i.test(
          rawText
        );
      if (isSapaan) {
        // Set guru ke menu mode
        await setGuruMenuMode(phone);

        // Ambil nama user
        const user = await prisma.user.findFirst({
          where: { phone },
          select: { nama: true },
        });
        const userName = user?.nama || "Guru";

        return safeReply(message, buildGreetingMessage(userName, "guru"), waClient);
      }
    }

    // ========== SISWA: CEK STATE KHUSUS ==========
    if (role === "siswa") {
      const st = await getState(phone);
      console.log(`🔵 [server] Siswa state:`, JSON.stringify(st));

      // 1) Cek apakah siswa sedang dalam wizard (kumpul tugas / status / gambar ke pdf)
      if (
        st?.lastIntent === "siswa_kumpul_wizard" ||
        st?.lastIntent === "siswa_status_wizard" ||
        st?.lastIntent === "siswa_imgtopdf"
      ) {
        console.log(
          `🔵 [server] Routing to siswa wizard handler for intent: ${st.lastIntent}`
        );

        // Handle media untuk wizard
        const isImageLike =
          message.hasMedia ||
          message.type === "image" ||
          (message.type === "document" &&
            /^image\//i.test(
              message._data?.mimetype || message.mimetype || ""
            ));

        if (isImageLike) {
          if (st?.lastIntent === "siswa_imgtopdf") {
            const handled = await onIncomingMedia(message);
            if (handled) return;
          }
        }

        // Lanjutkan ke siswa handler
        return handleSiswaCommand(message, {
          intent: st.lastIntent,
          entities: st.slots || {},
          waClient,
        });
      }

      // 2) Cek apakah siswa sedang dalam menu selection mode
      if (st?.menuMode === "siswa_menu_selection") {
        const menuChoice = rawText.replace(/[^0-9]/g, "");

        if (SISWA_MENU_MAP[menuChoice]) {
          const selectedIntent = SISWA_MENU_MAP[menuChoice];

          // Handle exit menu
          if (selectedIntent === "siswa_exit_menu") {
            await clearState(phone);
            return safeReply(message,
              "👋 Sampai jumpa! Ketik *halo* kapan saja untuk kembali ke menu. 😊",
              waClient
            );
          }

          // Handle img_to_pdf
          if (selectedIntent === "img_to_pdf") {
            await startImgToPdf(message);
            return;
          }

          // Handle siswa_help
          if (selectedIntent === "siswa_help") {
            return safeReply(message,
              `❓ *Bantuan Kinanti Bot - Siswa*\n\n` +
                `📚 *Daftar Menu:*\n` +
                `*1.* 📚 Tugas Saya — Lihat tugas yang belum selesai\n` +
                `*2.* ✅ Status Tugas — Lihat riwayat tugas yang sudah dikumpul\n` +
                `*3.* 📝 Kumpul Tugas — Kumpulkan tugas dengan upload PDF\n` +
                `*4.* 🖼️ Gambar ke PDF — Konversi foto menjadi file PDF\n` +
                `*5.* ❓ Bantuan — Menampilkan halaman ini\n` +
                `*0.* 🚪 Keluar — Keluar dari menu\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `📞 *Kontak Admin Kinanti:*\n` +
                `wa.me/62895378394020\n\n` +
                `Jika ada kendala terkait penggunaan atau ada yang ingin ditanyakan, silakan hubungi nomor admin di atas.\n\n` +
                `━━━━━━━━━━━━━━━━━━━━━\n\n` +
                `Ketik *halo* untuk kembali ke menu utama.`,
              waClient
            );
          }

          // Route ke siswa handler
          return handleSiswaCommand(message, {
            intent: selectedIntent,
            entities: {},
            waClient,
          });
        } else {
          // Input bukan angka menu yang valid
          return safeReply(message,
            "⚠️ Pilihan tidak valid.\n\n" +
              "📌 Balas dengan *angka 0-5* untuk memilih menu:\n" +
              "*1.* Tugas Saya | *2.* Status Tugas | *3.* Kumpul Tugas\n" +
              "*4.* Gambar ke PDF | *5.* Bantuan | *0.* Keluar",
            waClient
          );
        }
      }

      // 3) Cek apakah siswa mengetik sapaan untuk masuk ke menu
      const isSapaan =
        /^(halo|hai|hey|hei|mulai|start|menu|kinanti|assalamualaikum)/i.test(
          rawText
        );
      if (isSapaan) {
        // Set siswa ke menu mode
        await setSiswaMenuMode(phone);

        // Ambil nama user
        const user = await prisma.user.findFirst({
          where: { phone },
          select: { nama: true },
        });
        const userName = user?.nama || "Siswa";

        return safeReply(message, buildGreetingMessage(userName, "siswa"), waClient);
      }
    }

    // ========== NON-REGISTERED USER & FALLBACK ==========
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
      return safeReply(message, dialog.message, waClient);
    }

    const intent = dialog.to || "";

    // ========== HANDLER SAPAAN (untuk user belum terdaftar & siswa) ==========
    if (intent === "sapaan_help") {
      // Cek apakah user terdaftar
      const user = await prisma.user.findFirst({
        where: { phone },
        select: { nama: true, role: true },
      });

      if (!user) {
        // User belum terdaftar
        return safeReply(message,
          "👋 Halo! Sepertinya kamu belum terdaftar di sistem Kinanti.\n\n" +
            "📝 Silakan daftar terlebih dahulu di:\n" +
            "🌐 *https://kinantiku.com*\n\n" +
            "Setelah mendaftar, kamu bisa kembali ke sini dan mulai menggunakan bot ini! 😊",
          waClient
        );
      }

      // User sudah terdaftar (siswa), tampilkan menu
      const userName = user.nama || "Pengguna";
      let userRole = String(user.role || "siswa").toLowerCase();
      if (userRole === "teacher") userRole = "guru";
      if (userRole === "student") userRole = "siswa";

      // Jika guru, masukkan ke menu mode (fallback jika belum ke-handle di atas)
      if (userRole === "guru") {
        await setGuruMenuMode(phone);
      }

      return safeReply(message, buildGreetingMessage(userName, userRole), waClient);
    }

    if (intent === "img_to_pdf" || intent === "guru_img_to_pdf") {
      await startImgToPdf(message);
      return;
    }

    // ========== HANDLER INTENT GURU (jika ada guru yang langsung ketik perintah) ==========
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
        // Siswa tidak bisa akses fitur guru
        return safeReply(message,
          "🔒 Maaf, fitur ini khusus untuk *Guru*.\n\n" +
            "Ketik *halo* untuk melihat menu siswa. 📚",
          waClient
        );
      }
    }

    // ========== HANDLER SISWA ==========
    return handleSiswaCommand(message, {
      intent,
      entities: dialog.slots,
      ctx,
      supabase,
      pdfUtil,
    });
  } catch (e) {
    // Handle markedUnread error - pesan mungkin sudah terkirim
    if (e?.message?.includes("markedUnread")) {
      console.log("⚠️ [server] markedUnread error (ignored)");
      return;
    }
    console.error("NLP/handler error:", e);
    try {
      await safeReply(message, "Maaf, terjadi kesalahan. Coba lagi ya.", waClient);
    } catch (replyErr) {
      console.error("Failed to send error reply:", replyErr.message);
    }
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
