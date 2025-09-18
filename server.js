// server.js (cuplikan)
const { nlpPipeline } = require("./src/nlp/pipeline");
const { handleSiswaCommand } = require("./src/controllers/siswaController");
const { handleGuruCommand } = require("./src/controllers/guruController");

const supabase = require("./src/config/supabase");
const pdfUtil = require("./src/utils/pdfUtil");
const { client } = require("./src/client");
const waClient = client;
const excelUtil = require("./src/utils/excelUtil");

waClient.on("message", async (message) => {
  try {
    const ctx = await nlpPipeline(message);
    const { dialog } = ctx;

    if (!dialog.done) {
      return message.reply(dialog.message); // tanya slot
    }

    const intent = dialog.to;

    if (intent.startsWith("guru_")) {
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
  } catch (e) {
    console.error("NLP error", e);
    return message.reply("Maaf, terjadi kesalahan. Coba lagi ya.");
  }
});

waClient.initialize();
console.log("Memulai Bot...");
waClient.on("qr", (qr) => console.log("QR received, scan di WhatsApp!"));
waClient.on("ready", () => console.log("WhatsApp client is ready!"));
waClient.on("auth_failure", (m) => console.error("Auth failure:", m));
waClient.on("disconnected", (r) => console.error("Disconnected:", r));
