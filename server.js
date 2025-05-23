const { client } = require("./src/client");
const { handleGuruCommand } = require("./src/controllers/guruController");
const { handleSiswaCommand } = require("./src/controllers/siswaController");
const { setupSchedules } = require("./src/controllers/scheduleController");
const qrcode = require('qrcode-terminal'); 

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true }); // Menampilkan QR code di terminal
});

client.on("ready", () => {
  console.log("✅ Bot aktif!");
  setupSchedules(); // Jalankan semua scheduler
});

client.on("message", async (message) => {
  const sender = message.from;
  const body = message.body.toLowerCase();

  if (
    body.startsWith("penugasan") ||
    body.startsWith("kirim") ||
    body.startsWith("rekap") ||
    body.startsWith("list penugasan") ||
    body.startsWith("convert") ||
    body === "selesai"
  ) {
    await handleGuruCommand(message);
  } else if (
    body.startsWith("list") ||
    body.startsWith("kumpul") ||
    body === "selesai" ||
    body.startsWith("convert")
  ) {
    await handleSiswaCommand(message);
  } else {
    await handleGuruCommand(message);
  }
});

client.initialize();
