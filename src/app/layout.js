"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import Head from "next/head";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  return (
    <>
      <Head>
        <title>Kinantiku - WhatsApp Bot LMS</title>
        <meta
          name="description"
          content="Tingkatkan produktivitas dan kelola tugas dengan Kinanti Ku. Solusi terbaik untuk manajemen tugas dan komunikasi."
        />
        <meta
          name="keywords"
          content="Kinanti Ku, produktivitas, manajemen tugas, komunikasi, bot otomatis"
        />
        <meta name="author" content="Raka - Made With <3" />
        <link rel="icon" href="/icon.jpg" />
      </Head>
      <html lang="en-US">
        <body className={inter.className}>
          <SessionProvider>{children}</SessionProvider>
        </body>
      </html>
    </>
  );
}
