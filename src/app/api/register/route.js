import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Client, LocalAuth } from "whatsapp-web.js";

const prisma = new PrismaClient();
const whatsappClient = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: "/usr/bin/google-chrome",
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

whatsappClient.initialize();

export async function POST(req) {
  try {
    const body = await req.json();
    const { nama, kelas, phone, password } = body;

    // Cek apakah nomor sudah terdaftar
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) {
      return new Response(
        JSON.stringify({ message: "❌ Nomor WhatsApp sudah terdaftar." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Enkripsi password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan user baru ke database
    const newUser = await prisma.user.create({
      data: {
        nama,
        kelas,
        phone,
        password: hashedPassword,
        role: "siswa", // Default role
      },
    });

    // Kirim pesan selamat datang ke WhatsApp user
    const messageText = `🎉 Selamat datang, *${nama}*!\n\nTerima kasih telah mendaftar. Sekarang Anda dapat mengakses layanan kami. 🚀`;

    whatsappClient
      .sendMessage(`${phone}@c.us`, messageText)
      .then(() => console.log(`✅ Pesan selamat datang dikirim ke ${phone}`))
      .catch((err) => console.error(`❌ Gagal mengirim pesan:`, err));

    return new Response(
      JSON.stringify({ message: "✅ Registrasi berhasil!", user: newUser }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ message: "❌ Terjadi kesalahan saat registrasi." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
