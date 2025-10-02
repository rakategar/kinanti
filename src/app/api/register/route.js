import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const { nama, phone, password, kelas } = await req.json();

    // Pastikan kelas yang dikirim sesuai dengan enum
    const kelasEnum = [
      "XTKJ1",
      "XTKJ2",
      "XITKJ1",
      "XITKJ2",
      "XIITKJ1",
      "XIITKJ2",
      "TPTUP"
    ];
    if (!kelasEnum.includes(kelas)) {
      return new Response(
        JSON.stringify({ message: "❌ Kelas tidak valid." }),
        { status: 400 }
      );
    }

    // Cek apakah nomor WhatsApp sudah terdaftar
    const existingUser = await prisma.user.findUnique({
      where: { phone },
    });

    if (existingUser) {
      return new Response(
        JSON.stringify({ message: "❌ Nomor WhatsApp sudah terdaftar." }),
        { status: 400 }
      );
    }

    // Hash password sebelum menyimpan ke database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Simpan user baru dengan kelas sebagai enum
    const newUser = await prisma.user.create({
      data: {
        nama,
        phone,
        password: hashedPassword,
        role: "siswa", // Default sebagai siswa
        kelas, // Simpan sebagai enum
      },
    });

    return new Response(
      JSON.stringify({ message: "✅ Registrasi berhasil!", user: newUser }),
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error saat register:", error);
    return new Response(
      JSON.stringify({ message: "❌ Terjadi kesalahan saat registrasi." }),
      { status: 500 }
    );
  }
}
