import CredentialsProvider from "next-auth/providers/credentials";
import NextAuth from "next-auth";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Penting:
 * - authorize() harus return 'id'
 * - jwt() simpan id ke token (token.id & token.sub) + role, kelas
 * - session() mapping token.id ke session.user.id
 */
export const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        phone: { label: "Nomor HP", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const phone = (credentials?.phone || "").trim();
        const password = credentials?.password || "";
        if (!phone || !password) return null;

        // cari user by phone
        const user = await prisma.user.findUnique({
          where: { phone },
          // ambil field yang kita butuhkan
          select: {
            id: true,
            nama: true,
            phone: true,
            role: true, // enum di schema kamu kemungkinan "guru" | "siswa"
            kelas: true, // kalau ada
            password: true,
          },
        });
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        // Kembalikan payload minimal untuk NextAuth
        return {
          id: String(user.id), // << WAJIB, sebagai id user
          name: user.nama || "User",
          phone: user.phone,
          role: user.role, // "guru" | "siswa"
          kelas: user.kelas || null,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // Saat login pertama kali, user ada → isi token
      if (user) {
        token.id = user.id; // simpan sebagai string
        token.sub = user.id; // NextAuth biasanya pakai 'sub' sebagai subject id
        token.role = user.role || token.role;
        token.kelas = user.kelas ?? token.kelas;
        token.name = user.name || token.name;
        token.phone = user.phone || token.phone;
      }
      return token;
    },

    async session({ session, token }) {
      // Pastikan objek session.user selalu ada
      session.user = session.user || {};

      // Masukkan id ke session.user.id (ini yang kamu butuhkan di /guru)
      session.user.id = token.id || token.sub || null;

      // Teruskan role & kelas agar bisa routing/guard di FE
      session.user.role = token.role || null;
      session.user.kelas = token.kelas || null;

      // (Opsional) sinkronkan name/phone
      if (token.name) session.user.name = token.name;
      if (token.phone) session.user.phone = token.phone;

      return session;
    },
  },
};
