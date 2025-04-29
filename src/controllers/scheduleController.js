const cron = require("node-cron");
const { client } = require("../client");
const { prisma } = require("../config/prisma");

// Semua broadcast
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

async function reminderDeadlineBesok() {
  try {
    const siswaList = await prisma.user.findMany({
      where: { role: "siswa" },
    });

    const today = new Date();
    const besok = new Date(today);
    besok.setDate(today.getDate() + 1);

    const besokTanggal = besok.toISOString().split("T")[0]; // Format yyyy-mm-dd untuk pencocokan

    for (const siswa of siswaList) {
      // Cari tugas yang belum selesai dan deadline-nya besok
      const tugasBesok = await prisma.assignmentStatus.findMany({
        where: {
          siswaId: siswa.id,
          status: "BELUM_SELESAI",
          tugas: {
            deadline: {
              gte: new Date(`${besokTanggal}T00:00:00.000Z`),
              lt: new Date(`${besokTanggal}T23:59:59.999Z`),
            },
          },
        },
        include: {
          tugas: true,
        },
      });

      if (tugasBesok.length === 0) {
        continue; // ✅ Skip siswa yang tidak ada tugas deadline besok
      }

      let tugasListText = "";
      tugasBesok.forEach((item, index) => {
        const deadlineFormatted = new Date(
          item.tugas.deadline
        ).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        });
        tugasListText += `${index + 1}. 📖 *${
          item.tugas.judul
        }* - 🕒 Deadline: ${deadlineFormatted}\n`;
      });

      const pesan = `🔔 *Reminder Tugas!* \n\nHai ${siswa.nama} 👋,\nBesok adalah deadline tugas berikut:\n\n${tugasListText}\n\n💬 Segera selesaikan tugasmu ya biar tidak terlambat! Semangat! 🚀`;

      const recipient = `${siswa.phone}@c.us`;
      await client.sendMessage(recipient, pesan);
      console.log(`📨 Reminder deadline besok dikirim ke ${siswa.nama}`);
    }
  } catch (error) {
    console.error("❌ Error reminder deadline besok:", error);
  }
}

function setupSchedules() {
  cron.schedule(
    "0 7 * * *",
    async () => {
      console.log("⏰ Broadcast pagi");
      await broadcastPagi();
    },
    { timezone: "Asia/Jakarta" }
  );

  cron.schedule(
    "0 17 * * *",
    async () => {
      console.log("⏰ Broadcast sore + reminder deadline besok");
      await broadcastSore();
      await reminderDeadlineBesok();
    },
    { timezone: "Asia/Jakarta" }
  );
}

module.exports = { setupSchedules };
