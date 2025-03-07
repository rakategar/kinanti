const qrcode = require("qrcode-terminal");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@supabase/supabase-js");
const ExcelJS = require("exceljs"); // Pastikan sudah install: npm install exceljs
const fs = require("fs");
const prisma = new PrismaClient();
const path = require("path");
const os = require("os");

const SUPABASE_URL = "https://wgdxgzraacfhfbxvxuzy.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZHhnenJhYWNmaGZieHZ4dXp5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0MTAzNjM5OCwiZXhwIjoyMDU2NjEyMzk4fQ._dVS_wha-keEbaBb1xapdAeSpgJwwEAnWcrdnjDQ9nA";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const executablePath =
  os.platform() === "win32" || "win64"
    ? "C:\\Chromium\\chrome.exe"
    : "/usr/bin/google-chrome";

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("ready", async () => {
  await prisma.$disconnect();
  console.log("Client is ready! ✨");
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

client.on("message", async (message) => {
  const sender = message.from;

  // 1. Guru mengetik "tugas" atau "tugas XTKJ2"
  if (message.body.toLowerCase().startsWith("penugasan")) {
    const guru = await prisma.user.findFirst({
      where: { phone: sender.replace("@c.us", ""), role: "guru" },
    });

    if (!guru) {
      return await message.reply(
        "⚠️ Anda bukan guru atau belum terdaftar di sistem."
      );
    }

    // Menentukan target kelas (jika ada)
    const args = message.body.split(" ");
    let kelasTarget = args.length > 1 ? args.slice(1).join(" ") : null;

    pendingAssignment[sender] = {
      step: 1,
      guruId: guru.id, // Simpan ID guru dengan benar
      kelasTarget: message.body.split(" ")[1] || null, // Jika ada kelas
    };

    if (!pendingAssignment[sender]?.guruId) {
      console.log(
        "DEBUG: pendingAssignment[sender]",
        pendingAssignment[sender]
      );
      return await message.reply(
        "⚠️ Terjadi kesalahan: Guru ID tidak ditemukan. Coba ulangi."
      );
    }
    console.log(pendingAssignment[sender]);
    await message.reply(
      "📌 Silakan kirimkan tugas dalam format berikut:\n\n- Kode:\n- Judul:\n- Deskripsi:\n- Lampirkan PDF: ya/tidak\n\nContoh:\n- Kode: MTK24\n- Judul: Matematika Dasar\n- Deskripsi: Kerjakan soal halaman 45\n- Lampirkan PDF: ya"
    );
  }

  // 2. Menyimpan kode, judul, deskripsi tugas, dan pilihan lampiran PDF
  else if (pendingAssignment[sender]?.step === 1 && !message.hasMedia) {
    const lines = message.body.split("\n");
    if (lines.length < 4) {
      return await message.reply(
        "Format tidak valid. Kirim dengan format:\n- Kode:\n- Judul:\n- Deskripsi:\n- Lampirkan PDF: ya/tidak"
      );
    }

    const kodeTugas = lines[0].replace("- Kode:", "").trim();
    const judulTugas = lines[1].replace("- Judul:", "").trim();
    const deskripsiTugas = lines[2].replace("- Deskripsi:", "").trim();
    const lampirkanPDF =
      lines[3].replace("- Lampirkan PDF:", "").trim().toLowerCase() === "ya";

    // Cek apakah tugas dengan kode tersebut sudah ada
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
      step: lampirkanPDF ? 2 : 3, // Langsung ke penyimpanan tugas jika tidak perlu PDF
      guruId: pendingAssignment[sender].guruId,
      kode: kodeTugas,
      judul: judulTugas,
      deskripsi: deskripsiTugas,
      lampirkanPDF: lampirkanPDF,
    };

    if (lampirkanPDF) {
      await message.reply(
        `📎 Silakan kirimkan file PDF tugas.\nKode tugas: *${kodeTugas}*`
      );
    } else {
      // Langsung simpan tugas ke database tanpa menunggu PDF
      const newTugas = await prisma.assignment.create({
        data: {
          guruId: pendingAssignment[sender].guruId,
          kode: kodeTugas,
          judul: judulTugas,
          deskripsi: deskripsiTugas,
          pdfUrl: null, // Tidak ada file PDF
        },
      });
      // Cari siswa berdasarkan kelas (atau semua siswa jika kelasTarget tidak ditentukan)
      const siswaList = await prisma.user.findMany({
        where: {
          role: "siswa",
          ...(pendingAssignment[sender].kelasTarget
            ? { kelas: pendingAssignment[sender].kelasTarget }
            : {}),
        },
      });
      // Tambahkan tugas ke daftar siswa (belum selesai)
      await prisma.assignmentStatus.createMany({
        data: siswaList.map((siswa) => ({
          siswaId: siswa.id,
          tugasId: newTugas.id,
          status: "BELUM_SELESAI",
        })),
      });

      await message.reply(
        `✅ Tugas berhasil dibuat ! \n Gunakan: *kirim [kode_tugas] [kelas]* untuk mengirim ke kelas tujuan\n\nContoh: *kirim mtk24 XTKJ1* `
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

    const fileName = `assignments/${Date.now()}.pdf`;
    const { data, error } = await supabase.storage
      .from("assignments")
      .upload(fileName, Buffer.from(media.data, "base64"), {
        contentType: media.mimetype,
      });

    if (error) {
      console.error("❌ Gagal mengunggah PDF ke Supabase:", error);
      return await message.reply("Terjadi kesalahan saat menyimpan file.");
    }

    // Simpan ke database Prisma
    const pdfUrl = `${SUPABASE_URL}/storage/v1/object/public/assignments/${fileName}`;

    // Cek apakah guruId tersedia
    if (!pendingAssignment[sender]?.guruId) {
      console.error(
        "❌ Guru ID tidak ditemukan, pendingAssignment:",
        pendingAssignment[sender]
      );
      return await message.reply(
        "⚠️ Terjadi kesalahan: Guru ID tidak ditemukan. Coba ulangi."
      );
    }

    // Simpan tugas ke database
    const newTugas = await prisma.assignment.create({
      data: {
        guruId: pendingAssignment[sender].guruId,
        kode: pendingAssignment[sender].kode,
        judul: pendingAssignment[sender].judul,
        deskripsi: pendingAssignment[sender].deskripsi,
        pdfUrl: pdfUrl,
      },
    });

    // Cari siswa berdasarkan kelas (atau semua siswa jika kelasTarget tidak ditentukan)
    const siswaList = await prisma.user.findMany({
      where: {
        role: "siswa",
        ...(pendingAssignment[sender].kelasTarget
          ? { kelas: pendingAssignment[sender].kelasTarget }
          : {}),
      },
    });

    // Tambahkan tugas ke daftar siswa (belum selesai)
    await prisma.assignmentStatus.createMany({
      data: siswaList.map((siswa) => ({
        siswaId: siswa.id,
        tugasId: newTugas.id,
        status: "BELUM_SELESAI",
      })),
    });

    await message.reply(
      `✅ Tugas berhasil dibuat ! \n Gunakan: *kirim [kode_tugas] [kelas]* untuk mengirim ke kelas tujuan\natau *kirim [kode_tugas]* untuk mengirim ke semua kelas\n\nContoh: *kirim mtk24 XTKJ1* `
    );
    delete pendingAssignment[sender];
  } else if (message.body.toLowerCase().startsWith("kirim ")) {
    const parts = message.body.split(" ");

    if (parts.length < 3) {
      return await message.reply(
        `⚠️ Format salah! Gunakan: *kirim [kode_tugas] [kelas]*\n\nContoh: *kirim mtk24 XTKJ1*`
      );
    }

    const kodeTugas = parts[1]; // Ambil kode tugas
    const kelasTujuan = parts.slice(2).join(" "); // Ambil nama kelas

    // Cari tugas berdasarkan kode
    const tugasTerakhir = await prisma.assignment.findUnique({
      where: { kode: kodeTugas },
      include: { guru: true }, // Ambil informasi guru
    });

    if (!tugasTerakhir) {
      return await message.reply(
        `❌ Tidak ada tugas dengan kode *${kodeTugas}*.`
      );
    }

    // Cari siswa yang berada di kelas yang ditentukan
    const siswaList = await prisma.user.findMany({
      where: { role: "siswa", kelas: kelasTujuan },
    });

    if (siswaList.length === 0) {
      return await message.reply(
        `⚠️ Tidak ada siswa di kelas *${kelasTujuan}*.`
      );
    }

    // Kirim tugas ke siswa di kelas yang dipilih
    for (const siswa of siswaList) {
      const recipient = `${siswa.phone}@c.us`;
      const pesan = `📚 *Tugas Baru dari ${tugasTerakhir.guru.nama}*\n🔖 *Kode:* ${tugasTerakhir.kode}\n*Judul:* ${tugasTerakhir.judul}\n📄 *Deskripsi:* ${tugasTerakhir.deskripsi}\n📎 Unduh PDF: ${tugasTerakhir.pdfUrl}`;
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

process.on("SIGINT", async () => {
  console.log("Menutup koneksi Prisma...");
  await prisma.$disconnect();
  process.exit();
});

client.initialize();
