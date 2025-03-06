import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        phone: { label: "Phone", type: "text", placeholder: "62xxxxxxxxxxx" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials.phone || !credentials.password) {
          throw new Error("Nomor WhatsApp dan password diperlukan");
        }

        // Cari user berdasarkan phone
        const user = await prisma.user.findUnique({
          where: { phone: credentials.phone },
        });

        if (!user) {
          throw new Error("Nomor WhatsApp tidak terdaftar");
        }

        // Periksa password
        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordValid) {
          throw new Error("Password salah");
        }

        return {
          id: user.id,
          name: user.nama,
          phone: user.phone,
          role: user.role,
        };
      },
    }),
  ],
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
