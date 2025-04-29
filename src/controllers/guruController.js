const { prisma } = require("../config/prisma");
const path = require("path");
const ExcelJS = require("exceljs"); // Pastikan sudah install: npm install exceljs
const fs = require("fs");
const { MessageMedia } = require("whatsapp-web.js");
const { supabase, SUPABASE_URL } = require("../config/supabase");
const { PDFDocument } = require("pdf-lib");
const sharp = require("sharp");
const { client } = require("../client");

let pendingAssignment = {};

async function handleGuruCommand(message) {
  const sender = message.from;
  const body = message.body.toLowerCase();

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

  // 1. Guru mengetik "penugasan" atau "penugasan XTKJ2"
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
  } // 📝 Fitur "list tugas"
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

  // 📊 Fitur "convert JPGtoPDF"
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
    message.body.trim().toLowerCase() === "selesai"
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

module.exports = { handleGuruCommand };
