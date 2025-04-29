const { prisma } = require("../config/prisma");
const { client } = require("../client");
const path = require("path");
const fs = require("fs");
const { MessageMedia } = require("whatsapp-web.js");
const { supabase, SUPABASE_URL } = require("../config/supabase");
const { PDFDocument } = require("pdf-lib");
const sharp = require("sharp");
const { client } = require("../client");

async function handleSiswaCommand(message) {
  const sender = message.from;
  const body = message.body.toLowerCase();

  let pendingAssignment = {};

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

  // 2. User mengetik "start"
  else if (message.body.toLowerCase() === "start") {
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
  } // Fitur Convert Gambar ke PDF
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
}

module.exports = { handleSiswaCommand };
