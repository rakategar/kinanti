const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const { PrismaClient, Kelas } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");
const ExcelJS = require("exceljs"); // Pastikan sudah install: npm install exceljs
const fs = require("fs");
const prisma = new PrismaClient();
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const sharp = require("sharp");

// Import enum Prisma

const SUPABASE_URL = "https://wgdxgzraacfhfbxvxuzy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZHhnenJhYWNmaGZieHZ4dXp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTAzNjM5OCwiZXhwIjoyMDU2NjEyMzk4fQ._dVS_wha-keEbaBb1xapdAeSpgJwwEAnWcrdnjDQ9nA";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true,
    executablePath: "/usr/bin/google-chrome", // Path ke bin google-chrome
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

const cron = require("node-cron");

client.on("ready", async () => {
  await prisma.$disconnect();
  console.log("Client is ready! ✨");
});

client.on("ready", async () => {
  await prisma.$disconnect();
  console.log("Client is ready! ✨");

  // 🌅 Jadwal Broadcast Selamat Pagi Jam 07:00
  cron.schedule(
    "0 7 * * *",
    async () => {
      console.log("⏰ Mengirim broadcast pagi...");
      await broadcastPagi();
    },
    {
      timezone: "Asia/Jakarta", // Pastikan pakai timezone Indonesia
    }
  );

  // 🌇 Jadwal Broadcast Reminder Sore Jam 17:00
  cron.schedule(
    "0 17 * * *",
    async () => {
      console.log("⏰ Mengirim broadcast reminder sore...");
      await broadcastSore();
    },
    {
      timezone: "Asia/Jakarta",
    }
  );
});

let pendingAssignment = {};

async function buatExcel(data) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Rekap Tugas");

  // Tambahkan header
  worksheet.addRow(["Nama", "Nomor HP", "Status", "Link File"]);

  // Tambahkan data siswa
  data.forEach((row) => {
    worksheet.addRow(row);
  });

  // Simpan ke buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
}

async function convertImagesToPDF(images, outputPath) {
  const pdfDoc = await PDFDocument.create();

  for (const imageBuffer of images) {
    const image = await sharp(imageBuffer);
    const metadata = await image.metadata();
    const imageWidth = metadata.width;
    const imageHeight = metadata.height;

    const page = pdfDoc.addPage([imageWidth, imageHeight]);
    const imageEmbed = await pdfDoc.embedJpg(imageBuffer); // If JPG
    page.drawImage(imageEmbed, {
      x: 0,
      y: 0,
      width: imageWidth,
      height: imageHeight,
    });
  }

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

client.on("message", async (message) => {
  const sender = message.from;

  if (message.body.toLowerCase().startsWith("penugasan")) {
    const guru = await prisma.user.findFirst({
      where: { phone: sender.replace("@c.us", ""), role: "guru" },
    });

    if (!guru) {
      return await message.reply(
        "⚠️ Anda bukan guru atau belum terdaftar di sistem."
      );
    }

    // Menentukan target kelas (harus ada)
    const args = message.body.split(" ");
    if (args.length < 2) {
      return await message.reply(
        "⚠️ Anda harus menyebutkan kelas tujuan!\n\n📌 Contoh penggunaan:\n*Penugasan XIITKJ2*"
      );
    }

    let kelasTarget = args.slice(1).join(" "); // Ambil teks setelah "Penugasan"

    pendingAssignment[sender] = {
      // ...
    };
  }

  // 2. User mengetik "start"
  if (message.body.toLowerCase() === "start") {
    const user = await prisma.user.findFirst({
      where: { phone: sender.replace("@c.us", "") },
    });

    if (!user) {
      return await message.reply(
        "⚠️ Anda belum terdaftar di sistem. Silakan hubungi admin untuk pendaftaran."
      );
    }

    const logoPath = path.join(__dirname, "../../../public/logo.png");
    const media = MessageMedia.fromFilePath(logoPath);

    let greeting = `Halo ${user.nama},\n\n`;
    if (user.role === "guru") {
      greeting += "Anda terdaftar sebagai Guru. 📚\n\n";
      greeting += "✨ Fitur yang tersedia:\n";
      greeting +=
        "1️⃣ *Penugasan [kelas]* - Membuat tugas untuk kelas tertentu.\n";
      greeting += "   📌 Contoh: _Penugasan XIITKJ2_\n";
      greeting +=
        "2️⃣ *Lihat Tugas* - Melihat daftar tugas yang telah dibuat.\n";
      greeting += "   📌 Contoh: _Lihat Tugas_\n";
      greeting += "3️⃣ *Hapus Tugas [id]* - Menghapus tugas berdasarkan ID.\n";
      greeting += "   📌 Contoh: _Hapus Tugas 123_\n";
      greeting += "4️⃣ *Broadcast [pesan]* - Mengirim pesan ke semua siswa.\n";
      greeting += "   📌 Contoh: _Broadcast Selamat belajar, siswa-siswaku!_\n";
      greeting += "5️⃣ *Statistik* - Melihat statistik aktivitas siswa.\n";
      greeting += "   📌 Contoh: _Statistik_\n";
      greeting += "\n💡 Tetap semangat mendidik generasi penerus bangsa! 🌟";
    } else if (user.role === "siswa") {
      greeting += "Anda terdaftar sebagai Siswa. 🎓\n\n";
      greeting += "✨ Fitur yang tersedia:\n";
      greeting +=
        "1️⃣ *Lihat Tugas* - Melihat daftar tugas yang diberikan oleh guru.\n";
      greeting += "   📌 Contoh: _Lihat Tugas_\n";
      greeting += "2️⃣ *Kirim Tugas [id]* - Mengirimkan tugas berdasarkan ID.\n";
      greeting += "   📌 Contoh: _Kirim Tugas 123_\n";
      greeting += "3️⃣ *Tanya Guru [pesan]* - Mengirim pertanyaan ke guru.\n";
      greeting += "   📌 Contoh: _Tanya Guru Apa deadline tugas ini?_\n";
      greeting +=
        "4️⃣ *Lihat Nilai* - Melihat nilai tugas yang telah dinilai.\n";
      greeting += "   📌 Contoh: _Lihat Nilai_\n";
      greeting +=
        "\n💡 Jangan menyerah, teruslah belajar dan raih impianmu! 🚀";
    }

    await client.sendMessage(sender, media, { caption: greeting });

    await client.sendMessage(sender, media, { caption: greeting });
  }

  // Fitur Convert Gambar ke PDF
  if (message.body.toLowerCase() === "convert") {
    await message.reply(
      "Selamat datang di tools convert JPG to PDF! 📷\n\nSilakan lampirkan gambar yang ingin di-convert (bisa satu atau lebih)."
    );
    pendingAssignment[sender] = { step: "upload_images", images: [] }; // Tandai pengguna sedang dalam mode upload gambar
  }

  // Proses gambar yang dikirim
  else if (
    pendingAssignment[sender]?.step === "upload_images" &&
    message.hasMedia
  ) {
    const media = await message.downloadMedia();

    // Pastikan file adalah gambar (JPG/PNG)
    if (!media.mimetype.startsWith("image")) {
      return await message.reply(
        "⚠️ Hanya file gambar (JPG/PNG) yang diperbolehkan!"
      );
    }

    // Simpan gambar ke dalam array
    pendingAssignment[sender].images.push(Buffer.from(media.data, "base64"));

    await message.reply(
      "✅ Gambar berhasil diterima. Anda bisa mengirim gambar lagi atau ketik *selesai* untuk melanjutkan."
    );
  }

  // Jika pengguna mengetik "selesai"
  else if (
    pendingAssignment[sender]?.step === "upload_images" &&
    message.body.toLowerCase() === "selesai"
  ) {
    if (pendingAssignment[sender].images.length === 0) {
      return await message.reply("⚠️ Anda belum mengirim gambar apa pun.");
    }

    await message.reply(
      "📎 Silakan kirimkan nama file yang diinginkan untuk PDF . \n\nGunakan nama file *tanpa spasi*\nContoh : Tugas_Tkj "
    );
    pendingAssignment[sender].step = "request_filename"; // Lanjut ke langkah meminta nama file
  }

  // Proses nama file yang diminta
  else if (pendingAssignment[sender]?.step === "request_filename") {
    const fileName = message.body.trim();

    if (!fileName) {
      return await message.reply("⚠️ Nama file tidak boleh kosong.");
    }

    // Pastikan nama file memiliki ekstensi .pdf
    const pdfFileName = fileName.endsWith(".pdf")
      ? fileName
      : `${fileName}.pdf`;
    const pdfFilePath = path.join(__dirname, pdfFileName);

    try {
      // Konversi gambar ke PDF
      await convertImagesToPDF(pendingAssignment[sender].images, pdfFilePath);

      // Kirim PDF ke pengguna
      const media = MessageMedia.fromFilePath(pdfFilePath);
      await client.sendMessage(sender, media, {
        caption: `✅ Gambar berhasil diubah menjadi PDF dengan nama file *${pdfFileName}*.`,
      });

      // Hapus file PDF sementara
      fs.unlinkSync(pdfFilePath);

      // Reset status pengguna
      delete pendingAssignment[sender];
    } catch (error) {
      console.error("Error converting images to PDF:", error);
      await message.reply(
        "❌ Terjadi kesalahan saat mengonversi gambar ke PDF."
      );
    }
  }

  // 1. Guru mengetik "penugasan" atau "penugasan XTKJ2"
  if (message.body.toLowerCase().startsWith("penugasan")) {
    const guru = await prisma.user.findFirst({
      where: { phone: sender.replace("@c.us", ""), role: "guru" },
    });

    if (!guru) {
      return await message.reply(
        "⚠️ Anda bukan guru atau belum terdaftar di sistem."
      );
    }

    // Menentukan target kelas
    const args = message.body.split(" ");
    if (args.length < 2) {
      return await message.reply(
        "⚠️ Anda harus menyebutkan kelas tujuan!\n\n📌 Contoh penggunaan:\n*Penugasan XIITKJ2*"
      );
    }

    let kelasTarget = args.slice(1).join(" ");

    // ✅ Validasi kelas ada di database
    const kelasAda = await prisma.user.findFirst({
      where: { kelas: kelasTarget, role: "siswa" },
    });
    if (!kelasAda) {
      return await message.reply(
        `⚠️ Kelas *${kelasTarget}* tidak ditemukan di sistem.\nPastikan Anda mengetik nama kelas dengan benar.`
      );
    }

    pendingAssignment[sender] = {
      step: 1,
      guruId: guru.id,
      kelasTarget: kelasTarget,
    };

    await message.reply(
      "📌 Silakan kirimkan tugas dalam format berikut:\n\n- Kode:\n- Judul:\n- Deskripsi:\n- Lampirkan PDF: ya/tidak\n- Deadline: (opsional, dalam hari)\n\nContoh:\n- Kode: MTK24\n- Judul: Matematika Dasar\n- Deskripsi: Kerjakan soal halaman 45\n- Lampirkan PDF: ya\n- Deadline: 7"
    );
  }

  // 🔥 Command reset/batal
  else if (message.body.toLowerCase() === "batal") {
    if (pendingAssignment[sender]) {
      delete pendingAssignment[sender];
      await message.reply(
        "❌ Penugasan dibatalkan. Mulai lagi dengan *penugasan [kelas]*."
      );
    } else {
      await message.reply("⚠️ Tidak ada penugasan yang sedang berlangsung.");
    }
  }

  // 2. Menyimpan kode, judul, deskripsi tugas, dan pilihan lampiran PDF
  // 2. Menyimpan kode, judul, deskripsi tugas, dan pilihan lampiran PDF
  else if (pendingAssignment[sender]?.step === 1 && !message.hasMedia) {
    const lines = message.body.split("\n");
    if (lines.length < 4) {
      return await message.reply(
        "Format tidak valid. Kirim dengan format:\n- Kode:\n- Judul:\n- Deskripsi:\n- Lampirkan PDF: ya/tidak\n- Deadline: (opsional, dalam hari)"
      );
    }

    const kodeTugas = lines[0].replace("- Kode:", "").trim();
    const judulTugas = lines[1].replace("- Judul:", "").trim();
    const deskripsiTugas = lines[2].replace("- Deskripsi:", "").trim();
    const lampirkanPDF =
      lines[3].replace("- Lampirkan PDF:", "").trim().toLowerCase() === "ya";

    // Ambil deadline opsional
    let deadlineDays = 7; // default
    if (lines[4]) {
      const deadlineLine = lines[4].replace("- Deadline:", "").trim();
      const parsedDays = parseInt(deadlineLine);
      if (!isNaN(parsedDays) && parsedDays > 0) {
        deadlineDays = parsedDays;
      }
    }

    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + deadlineDays);

    // Cek apakah tugas dengan kode itu sudah ada
    const tugasSudahAda = await prisma.assignment.findUnique({
      where: { kode: kodeTugas },
    });

    if (tugasSudahAda) {
      return await message.reply(
        `❌ Tugas dengan kode *${kodeTugas}* sudah pernah dibuat!\n\n📖 *${tugasSudahAda.judul} (${tugasSudahAda.kode})*\n📝 ${tugasSudahAda.deskripsi}`
      );
    }

    // Simpan data sementara
    pendingAssignment[sender] = {
      step: lampirkanPDF ? 2 : 3, // 2 = menunggu PDF, 3 = langsung buat tugas
      guruId: pendingAssignment[sender].guruId,
      kode: kodeTugas,
      judul: judulTugas,
      deskripsi: deskripsiTugas,
      lampirkanPDF: lampirkanPDF,
      deadline: deadlineDate,
      kelas: pendingAssignment[sender].kelasTarget,
    };

    if (lampirkanPDF) {
      // Minta file PDF, tapi TIDAK buat tugas dulu
      await message.reply(
        `📎 Silakan kirimkan file PDF tugas.\nKode tugas: *${kodeTugas}*`
      );
    } else {
      // Baru kalau TIDAK butuh PDF, buat tugas sekarang
      const newTugas = await prisma.assignment.create({
        data: {
          guruId: pendingAssignment[sender].guruId,
          kode: kodeTugas,
          judul: judulTugas,
          deskripsi: deskripsiTugas,
          pdfUrl: null,
          deadline: pendingAssignment[sender].deadline,
          kelas: pendingAssignment[sender].kelas,
        },
      });

      const siswaList = await prisma.user.findMany({
        where: {
          role: "siswa",
          kelas: pendingAssignment[sender].kelas,
        },
      });

      await prisma.assignmentStatus.createMany({
        data: siswaList.map((siswa) => ({
          siswaId: siswa.id,
          tugasId: newTugas.id,
          status: "BELUM_SELESAI",
        })),
      });

      await message.reply(
        `✅ Tugas berhasil dibuat!\nGunakan: *kirim [kode_tugas] [kelas]* untuk mengirim ke kelas tujuan.\n\nContoh: *kirim mtk24 XTKJ1*`
      );
      delete pendingAssignment[sender];
    }
  }

  // 3. Mengunggah PDF ke Supabase
  else if (pendingAssignment[sender]?.step === 2 && message.hasMedia) {
    const media = await message.downloadMedia();
    if (!media.mimetype.includes("pdf")) {
      return await message.reply("⚠️ Hanya file PDF yang diperbolehkan!");
    }

    try {
      const fileName = `assignments/${Date.now()}.pdf`;
      const { data, error } = await supabase.storage
        .from("assignments")
        .upload(fileName, Buffer.from(media.data, "base64"), {
          contentType: media.mimetype,
        });

      if (error) throw error;

      const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/assignments/${fileName}`;

      const newTugas = await prisma.assignment.create({
        data: {
          guruId: pendingAssignment[sender].guruId,
          kode: pendingAssignment[sender].kode,
          judul: pendingAssignment[sender].judul,
          deskripsi: pendingAssignment[sender].deskripsi,
          pdfUrl: pdfUrl,
          deadline: pendingAssignment[sender].deadline,
          kelas: pendingAssignment[sender].kelas,
        },
      });

      const siswaList = await prisma.user.findMany({
        where: {
          role: "siswa",
          kelas: pendingAssignment[sender].kelasTarget,
        },
      });

      await prisma.assignmentStatus.createMany({
        data: siswaList.map((siswa) => ({
          siswaId: siswa.id,
          tugasId: newTugas.id,
          status: "BELUM_SELESAI",
        })),
      });

      await message.reply(
        `✅ Tugas berhasil dibuat!\nGunakan: *kirim [kode_tugas] [kelas]* untuk mengirim ke kelas tujuan.\n\nContoh: *kirim mtk24 XTKJ1*`
      );
      delete pendingAssignment[sender];
    } catch (err) {
      console.error("❌ Gagal mengunggah PDF ke Supabase:", err);
      await message.reply(
        "❌ Terjadi kesalahan saat mengunggah file PDF. Coba kirim ulang."
      );
    }
  }

  if (message.body.toLowerCase() === "start") {
    const user = await prisma.user.findFirst({
      where: { phone: sender.replace("@c.us", "") },
    });

    if (!user) {
      return await message.reply(
        "⚠️ Anda belum terdaftar di sistem. Silakan hubungi admin untuk pendaftaran."
      );
    }

    const logoPath = path.join(__dirname, "../../../public/logo.png");
    const media = MessageMedia.fromFilePath(logoPath);

    let greeting = `Halo ${user.nama},\n\n`;
    if (user.role === "guru") {
      greeting += "Anda terdaftar sebagai Guru. 📚\n\n";
      greeting += "✨ Fitur yang tersedia:\n";
      greeting +=
        "1️⃣ *Penugasan [kelas]* - Membuat tugas untuk kelas tertentu.\n";
      greeting += "   📌 Contoh: _Penugasan XIITKJ2_\n";
      greeting +=
        "2️⃣ *Rekap Penugasan* - Melihat rekap tugas yang telah dibuat.\n";
      greeting += "   📌 Contoh: _Rekap Penugasan_\n";
      greeting +=
        "3️⃣ *List Penugasan* - Melihat daftar tugas yang telah dibuat.\n";
      greeting += "   📌 Contoh: _List Penugasan_\n";
      greeting += "4️⃣ *List Siswa* - Melihat daftar siswa di kelas tertentu.\n";
      greeting += "   📌 Contoh: _List Siswa XIITKJ2_\n";
      greeting += "5️⃣ *Convert [gambar]* - Mengonversi gambar ke PDF.\n";
      greeting += "   📌 Contoh: _Convert_\n";
      greeting += "\n💡 Tetap semangat mendidik generasi penerus bangsa! 🌟";
    } else if (user.role === "siswa") {
      greeting += "Anda terdaftar sebagai Siswa. 🎓\n\n";
      greeting += "✨ Fitur yang tersedia:\n";
      greeting +=
        "1️⃣ *Lihat Tugas* - Melihat daftar tugas yang diberikan oleh guru.\n";
      greeting += "   📌 Contoh: _Lihat Tugas_\n";
      greeting +=
        "2️⃣ *Kumpulkan Tugas [id]* - Mengumpulkan tugas berdasarkan ID.\n";
      greeting += "   📌 Contoh: _Kumpulkan Tugas 123_\n";
      greeting += "3️⃣ *Convert [gambar]* - Mengonversi gambar ke PDF.\n";
      greeting += "   📌 Contoh: _Convert_\n";
      greeting +=
        "\n💡 Jangan menyerah, teruslah belajar dan raih impianmu! 🚀";
    }

    await client.sendMessage(sender, media, { caption: greeting });
  }

  // 📝 Fitur "kirim tugas"
  else if (message.body.toLowerCase().startsWith("kirim ")) {
    const parts = message.body.split(" ");

    if (parts.length < 3) {
      return await message.reply(
        `⚠️ Format salah! Gunakan: *kirim [kode_tugas] [kelas]*\n\nContoh: *kirim mtk24 XTKJ1*`
      );
    }

    const kodeTugas = parts[1];
    const kelasTujuan = parts.slice(2).join(" ");

    const tugasTerakhir = await prisma.assignment.findUnique({
      where: { kode: kodeTugas },
      include: { guru: true },
    });

    if (!tugasTerakhir) {
      return await message.reply(
        `❌ Tidak ada tugas dengan kode *${kodeTugas}*.`
      );
    }

    const siswaList = await prisma.user.findMany({
      where: { role: "siswa", kelas: kelasTujuan },
    });

    if (siswaList.length === 0) {
      return await message.reply(
        `⚠️ Tidak ada siswa di kelas *${kelasTujuan}*.`
      );
    }

    // Format tanggal deadline agar mudah dibaca siswa
    const options = { day: "numeric", month: "long", year: "numeric" };
    const deadlineFormatted = tugasTerakhir.deadline.toLocaleDateString(
      "id-ID",
      options
    );

    // Kirim tugas ke siswa
    for (const siswa of siswaList) {
      const recipient = `${siswa.phone}@c.us`;
      const pesan = `📚 *Tugas Baru dari ${
        tugasTerakhir.guru.nama
      }*\n\n🔖 *Kode:* ${tugasTerakhir.kode}\n📝 *Judul:* ${
        tugasTerakhir.judul
      }\n📄 *Deskripsi:* ${
        tugasTerakhir.deskripsi
      }\n\n🕒 *Deadline:* ${deadlineFormatted}\n${
        tugasTerakhir.pdfUrl ? `📎 *Unduh PDF:* ${tugasTerakhir.pdfUrl}` : ""
      }\n\n*Segera kerjakan sebelum deadline ya!* 📚💪`;

      await client.sendMessage(recipient, pesan);
      console.log(`📨 Tugas dikirim ke ${siswa.nama} (${siswa.phone})`);
    }

    await message.reply(
      `✅ Tugas dengan kode *${kodeTugas}* telah dikirim ke kelas *${kelasTujuan}*.`
    );
  }

  // 📝 Fitur "list tugas"
  if (message.body.toLowerCase() === "list penugasan") {
    const guru = await prisma.user.findFirst({
      where: { phone: sender.replace("@c.us", ""), role: "guru" },
    });

    if (!guru) {
      return await message.reply(
        "⚠️ Anda bukan guru atau belum terdaftar di sistem."
      );
    }

    const tugasList = await prisma.assignment.findMany({
      where: { guruId: guru.id },
      orderBy: { createdAt: "desc" },
    });

    if (tugasList.length === 0) {
      return await message.reply("📭 Anda belum pernah mengirim tugas.");
    }

    let pesan = "📚 *Daftar Tugas Anda:*\n";
    tugasList.forEach((tugas, index) => {
      pesan += `\n${index + 1}. *${tugas.judul}* (*${tugas.kode}*)\n   ${
        tugas.deskripsi
      }\n   📎 ${tugas.pdfUrl}\n`;
    });

    await message.reply(pesan);
  }

  // 📊 Fitur "list siswa"
  else if (message.body.toLowerCase().startsWith("list siswa")) {
    const guru = await prisma.user.findFirst({
      where: { phone: sender.replace("@c.us", ""), role: "guru" },
    });

    if (!guru) {
      return await message.reply(
        "⚠️ Anda bukan guru atau belum terdaftar di sistem."
      );
    }

    // Cek apakah ada kelas yang diminta
    const args = message.body.split(" ");
    let kelasFilter = args.length > 2 ? args.slice(2).join(" ") : null;

    const siswaList = await prisma.user.findMany({
      where: {
        role: "siswa",
        ...(kelasFilter ? { kelas: kelasFilter } : {}), // Filter kelas jika ada
      },
      orderBy: { nama: "asc" },
    });

    if (siswaList.length === 0) {
      return await message.reply(
        kelasFilter
          ? `📭 Tidak ada siswa di kelas *${kelasFilter}*.`
          : "📭 Belum ada siswa terdaftar."
      );
    }

    // Buat file Excel
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data Siswa");

    // Header
    worksheet.columns = [
      { header: "No", key: "no", width: 5 },
      { header: "Nama", key: "nama", width: 20 },
      { header: "Nomor WA", key: "phone", width: 15 },
      { header: "Kelas", key: "kelas", width: 10 },
    ];

    // Isi data
    siswaList.forEach((siswa, index) => {
      worksheet.addRow({
        no: index + 1,
        nama: siswa.nama,
        phone: siswa.phone,
        kelas: siswa.kelas,
      });
    });

    // Simpan sebagai buffer
    const buffer = await workbook.xlsx.writeBuffer();
    const media = new MessageMedia(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer.toString("base64"),
      kelasFilter ? `Data_Siswa_${kelasFilter}.xlsx` : "Data_Siswa.xlsx"
    );

    // Kirim file ke WhatsApp
    await client.sendMessage(sender, media);
    await message.reply("📄 Data siswa telah dikirim dalam format Excel.");
  }

  // 📌 Fitur "list tugas" untuk siswa
  if (message.body.toLowerCase() === "list tugas") {
    const siswa = await prisma.user.findFirst({
      where: { phone: sender.replace("@c.us", ""), role: "siswa" },
    });

    if (!siswa) {
      return await message.reply(
        "⚠️ Anda bukan siswa atau belum terdaftar di sistem."
      );
    }

    // Ambil semua tugas yang belum selesai oleh siswa
    const tugasBelumSelesai = await prisma.assignmentStatus.findMany({
      where: {
        siswa: { phone: sender.replace("@c.us", "") },
        status: "BELUM_SELESAI",
      },
      include: { tugas: { include: { guru: true } } },
    });

    if (tugasBelumSelesai.length === 0) {
      return await message.reply(
        "✅ Anda tidak memiliki tugas yang belum selesai."
      );
    }

    let response = "📌 *Daftar Tugas Anda:*\n\n";
    tugasBelumSelesai.forEach((item, index) => {
      response += `${index + 1}. 👨‍🏫 *${item.tugas.guru.nama}*\n📖 *Judul:* ${
        item.tugas.judul
      }\n🔖 *Kode:* ${item.tugas.kode}\n\n`;
    });
    await message.reply(response);
  }

  // 📌 Fitur "selesai " untuk siswa menyelesaikan tugas
  if (message.body.toLowerCase().startsWith("selesai ")) {
    const kodeTugas = message.body.split(" ")[1];

    // Periksa apakah tugas ada dan belum selesai
    const tugasSiswa = await prisma.assignmentStatus.findFirst({
      where: {
        siswa: { phone: sender.replace("@c.us", "") },
        tugas: { kode: kodeTugas },
        status: "BELUM_SELESAI",
      },
    });

    if (!tugasSiswa) {
      return await message.reply(
        "⚠️ Tugas tidak ditemukan atau sudah selesai."
      );
    }

    // Perbarui status tugas menjadi selesai
    await prisma.assignmentStatus.update({
      where: { id: tugasSiswa.id },
      data: { status: "SELESAI" },
    });

    await message.reply(
      `✅ Tugas *${kodeTugas}* telah ditandai sebagai selesai.`
    );
  }

  if (message.body.toLowerCase().startsWith("kumpul")) {
    const args = message.body.split(" ");
    if (args.length < 2) {
      return await message.reply("⚠️ Gunakan format: *kumpul [kode_tugas]*");
    }

    const kodeTugas = args[1].toUpperCase();
    const nomorHp = sender.replace("@c.us", "");

    // Cari ID siswa berdasarkan nomor HP
    const siswa = await prisma.user.findFirst({
      where: { phone: nomorHp, role: "siswa" },
      select: { id: true },
    });

    if (!siswa) {
      return await message.reply("❌ Anda belum terdaftar sebagai siswa.");
    }

    const tugas = await prisma.assignment.findUnique({
      where: { kode: kodeTugas },
    });

    if (!tugas) {
      return await message.reply(
        `❌ Tugas dengan kode *${kodeTugas}* tidak ditemukan.`
      );
    }

    pendingAssignment[sender] = {
      step: tugas.pdfUrl ? 1 : 2, // Jika tugas membutuhkan PDF, tunggu PDF
      kodeTugas: kodeTugas,
      tugasId: tugas.id,
      siswaId: siswa.id, // Gunakan ID siswa dari database
    };

    if (tugas.pdfUrl) {
      await message.reply("📎 Silakan kirimkan file PDF tugas Anda.");
    } else {
      // Simpan langsung jika PDF tidak diperlukan
      await prisma.assignmentSubmission.create({
        data: {
          siswaId: siswa.id, // Gunakan ID siswa yang sudah dikonversi
          tugasId: tugas.id,
          pdfUrl: null,
        },
      });
      const tugasSiswa = await prisma.assignmentStatus.findFirst({
        where: {
          siswa: { phone: sender.replace("@c.us", "") },
          tugas: { kode: kodeTugas },
          status: "BELUM_SELESAI",
        },
      });
      // Perbarui status tugas menjadi selesai
      await prisma.assignmentStatus.update({
        where: { id: tugasSiswa.id },
        data: { status: "SELESAI" },
      });

      await message.reply("✅ Tugas berhasil dikumpulkan tanpa lampiran PDF!");
      await message.reply(
        `✅ Tugas *${kodeTugas}* telah ditandai sebagai selesai.`
      );
      delete pendingAssignment[sender];
    }
  }

  // Siswa mengirimkan file PDF sebagai tugas
  else if (pendingAssignment[sender]?.step === 1 && message.hasMedia) {
    const kodeTugas = pendingAssignment[sender]?.kodeTugas; // Ambil kode tugas dari pendingAssignment

    if (!kodeTugas) {
      return await message.reply(
        "⚠️ Terjadi kesalahan, kode tugas tidak ditemukan."
      );
    }

    const media = await message.downloadMedia();
    if (!media.mimetype.includes("pdf")) {
      return await message.reply("⚠️ Hanya file PDF yang diperbolehkan!");
    }

    const fileName = `submissions/${Date.now()}.pdf`;
    const { data, error } = await supabase.storage
      .from("submissions")
      .upload(fileName, Buffer.from(media.data, "base64"), {
        contentType: media.mimetype,
      });

    if (error) {
      console.error("❌ Gagal mengunggah PDF ke Supabase:", error);
      return await message.reply("Terjadi kesalahan saat menyimpan file.");
    }

    const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/submissions/${fileName}`;

    await prisma.assignmentSubmission.create({
      data: {
        siswaId: pendingAssignment[sender].siswaId, // Gunakan ID siswa yang benar
        tugasId: pendingAssignment[sender].tugasId,
        pdfUrl: pdfUrl,
      },
    });

    await message.reply(
      `✅ Tugas berhasil dikumpulkan!\n📎 PDF Anda: ${pdfUrl}`
    );

    // Cari siswa dengan status belum selesai
    const tugasSiswa = await prisma.assignmentStatus.findFirst({
      where: {
        siswa: { phone: sender.replace("@c.us", "") },
        tugas: { kode: kodeTugas }, // ✅ kodeTugas sudah didefinisikan di awal
        status: "BELUM_SELESAI",
      },
    });

    if (tugasSiswa) {
      // Perbarui status tugas menjadi selesai
      await prisma.assignmentStatus.update({
        where: { id: tugasSiswa.id },
        data: { status: "SELESAI" },
      });
    }

    await message.reply(
      `✅ Tugas *${kodeTugas}* telah ditandai sebagai selesai.`
    );
    delete pendingAssignment[sender];
  }

  if (message.body.toLowerCase().startsWith("rekap")) {
    const guru = await prisma.user.findFirst({
      where: { phone: sender.replace("@c.us", ""), role: "guru" },
    });

    if (!guru) {
      return await message.reply(
        "⚠️ Anda bukan guru atau belum terdaftar di sistem."
      );
    }

    const args = message.body.split(" ");
    if (args.length < 2) {
      return await message.reply(
        "⚠️ Format salah! Gunakan: *rekap [kode_tugas]*"
      );
    }

    const kodeTugas = args[1].toUpperCase();

    // Cek tugas berdasarkan kode
    const tugas = await prisma.assignment.findUnique({
      where: { kode: kodeTugas },
      include: {
        status: {
          include: { siswa: true },
        },
      },
    });

    if (!tugas) {
      return await message.reply(
        `❌ Tugas dengan kode *${kodeTugas}* tidak ditemukan.`
      );
    }

    // Ambil semua siswa di kelas yang sesuai dengan tugas ini
    const semuaSiswa = await prisma.user.findMany({
      where: {
        role: "siswa",
        kelas: tugas.kelas, // Pastikan hanya siswa di kelas terkait
      },
    });

    // Ambil semua pengumpulan tugas terkait
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { tugasId: tugas.id },
      select: {
        siswaId: true,
        pdfUrl: true,
      },
    });

    // Mapping siswa yang sudah mengumpulkan tugas
    const siswaSudahMengumpulkan = new Map();
    submissions.forEach((sub) => {
      siswaSudahMengumpulkan.set(sub.siswaId, sub.pdfUrl);
    });

    let laporan = `📌 *Rekap Pengumpulan Tugas ${tugas.judul} (${tugas.kode})*\n\n`;
    let dataExcel = [["Nama", "Nomor HP", "Status", "Link File"]];

    semuaSiswa.forEach((siswa, index) => {
      const sudahMengumpulkan = siswaSudahMengumpulkan.has(siswa.id);
      const tanda = sudahMengumpulkan ? "✅" : "❌";
      const linkFile = sudahMengumpulkan
        ? siswaSudahMengumpulkan.get(siswa.id)
        : "-";

      laporan += `${index + 1}. ${siswa.nama} ${tanda}\n`;
      dataExcel.push([
        siswa.nama,
        siswa.phone,
        sudahMengumpulkan ? "Sudah" : "Belum",
        linkFile,
      ]);
    });

    // Kirim rekap ke guru
    await message.reply(laporan);
    async function buatExcel(data) {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Rekap Tugas");

      // Tambahkan header
      worksheet.addRow(["Nama", "Nomor HP", "Status", "Link File"]);

      // Tambahkan data siswa
      data.forEach((row) => {
        worksheet.addRow(row);
      });

      // Simpan ke buffer
      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    }

    const dirPath = path.resolve(__dirname, "rekap_files");
    const filePath = path.resolve(dirPath, "rekap_tugas.xlsx"); // Dideklarasikan di luar
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Pastikan buatExcel mengembalikan buffer
      const excelBuffer = await buatExcel(dataExcel);
      if (!excelBuffer) {
        throw new Error("Gagal membuat buffer Excel!");
      }

      // Simpan buffer ke file
      await fs.promises.writeFile(filePath, excelBuffer);
      console.log("✅ Rekap tugas berhasil disimpan di:", filePath);
    } catch (error) {
      console.error("❌ Terjadi kesalahan saat membuat rekap:", error);
    }

    // Kirim file Excel
    // Pastikan file ada sebelum dikirim
    if (!fs.existsSync(filePath)) {
      console.error("❌ File tidak ditemukan:", filePath);
      return await message.reply(
        "⚠️ Terjadi kesalahan, file rekap tidak ditemukan."
      );
    }

    // Konversi file ke format media WhatsApp
    const media = await MessageMedia.fromFilePath(filePath);

    // Kirim file menggunakan sendMessage()
    await message.client.sendMessage(message.from, media, {
      caption: "📎 Berikut adalah rekap pengumpulan dalam bentuk Excel.",
    });
  }

  // Fungsi untuk membuat file Excel
  async function buatExcel(data) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Rekap Tugas");

    // Tambahkan data ke worksheet
    worksheet.addRows(data);

    // Simpan ke buffer
    return await workbook.xlsx.writeBuffer();
  }
});

async function broadcastPagi() {
  try {
    const siswaList = await prisma.user.findMany({
      where: { role: "siswa" },
    });

    const today = new Date();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const tanggalHariIni = today.toLocaleDateString("id-ID", options);

    // 🎯 Array pesan semangat random
    const pesanSemangatList = [
      "Tetap semangat menggapai impianmu! 🚀",
      "Hari baru, kesempatan baru! 💪",
      "Jangan takut gagal, takutlah untuk tidak mencoba. ✨",
      "Setiap langkah kecil hari ini membawa dampak besar besok! 🌱",
      "Belajar adalah investasi terbaik untuk masa depanmu. 📚",
      "Tantangan hari ini adalah kekuatanmu besok! 🔥",
      "Lakukan yang terbaik, Tuhan akan melakukan sisanya. 🙏",
      "Sukses adalah kumpulan usaha kecil yang dilakukan setiap hari. 🏆",
      "Berani bermimpi, berani bertindak! 🎯",
      "Hari ini penuh peluang, jangan sia-siakan! 🌟",
    ];

    // Ambil pesan random
    const pesanSemangatRandom =
      pesanSemangatList[Math.floor(Math.random() * pesanSemangatList.length)];

    for (const siswa of siswaList) {
      const tugasBelumSelesai = await prisma.assignmentStatus.findMany({
        where: {
          siswaId: siswa.id,
          status: "BELUM_SELESAI",
        },
        include: {
          tugas: true,
        },
      });

      let tugasListText = "";
      if (tugasBelumSelesai.length === 0) {
        tugasListText = "✅ Tidak ada tugas yang belum diselesaikan.";
      } else {
        tugasBelumSelesai.forEach((item, index) => {
          const deadlineFormatted = item.tugas.deadline
            ? new Date(item.tugas.deadline).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            : "-";
          tugasListText += `${index + 1}. 📖 *${
            item.tugas.judul
          }*\n   🕒 Deadline: ${deadlineFormatted}\n`;
        });
      }

      const pesan = `🌅 *Selamat Pagi ${siswa.nama}!*\n\n📅 *Hari ini:* ${tanggalHariIni}\n\n💬 *Pesan Semangat:*\n_"${pesanSemangatRandom}"_\n\n📝 *Daftar Tugas Anda:*\n${tugasListText}\n\nHave a nice day! 🌟`;

      const recipient = `${siswa.phone}@c.us`;
      await client.sendMessage(recipient, pesan);
      console.log(`📨 Broadcast pagi dikirim ke ${siswa.nama}`);
    }
  } catch (error) {
    console.error("❌ Error broadcast pagi:", error);
  }
}

async function broadcastSore() {
  try {
    const siswaList = await prisma.user.findMany({
      where: { role: "siswa" },
    });

    const today = new Date();
    const options = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    const tanggalHariIni = today.toLocaleDateString("id-ID", options);

    for (const siswa of siswaList) {
      const tugasBelumSelesai = await prisma.assignmentStatus.findMany({
        where: {
          siswaId: siswa.id,
          status: "BELUM_SELESAI",
        },
        include: {
          tugas: true,
        },
      });

      if (tugasBelumSelesai.length === 0) {
        continue; // ✅ Skip siswa yang sudah mengerjakan semua tugas
      }

      let tugasListText = "";
      tugasBelumSelesai.forEach((item, index) => {
        const deadlineFormatted = item.tugas.deadline
          ? new Date(item.tugas.deadline).toLocaleDateString("id-ID", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "-";
        tugasListText += `${index + 1}. 📖 *${
          item.tugas.judul
        }*\n   🕒 Deadline: ${deadlineFormatted}\n`;
      });

      const pesan = `🌇 *Selamat Sore ${siswa.nama}!* \n\n📅 *Hari ini:* ${tanggalHariIni}\n\n📝 *Reminder Tugas Anda:*\n${tugasListText}\n\n💬 *Ayo selesaikan tugasmu sebelum deadline!*\nSemangat terus ya! 🚀`;

      const recipient = `${siswa.phone}@c.us`;
      await client.sendMessage(recipient, pesan);
      console.log(`📨 Reminder sore dikirim ke ${siswa.nama}`);
    }
  } catch (error) {
    console.error("❌ Error broadcast sore:", error);
  }
}

process.on("SIGINT", async () => {
  console.log("Menutup koneksi Prisma...");
  await prisma.$disconnect();
  process.exit();
});

client.initialize();
