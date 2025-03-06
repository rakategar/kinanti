import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export async function POST(req) {
  try {
    const body = await req.json();
    const { nama, kelas, phone, password } = body;

    // Cek apakah nomor WhatsApp sudah terdaftar
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

    // Simpan data ke database
    const newUser = await prisma.user.create({
      data: {
        nama,
        kelas,
        phone,
        password: hashedPassword,
        role: "siswa", // Default role
      },
    });

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
