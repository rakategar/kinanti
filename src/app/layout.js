"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import Head from "next/head";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  const meta = {
    title: "Kinantiku - SMKN 3 Buduran",
    description: `Sistem pintar pengelolaan tugas siswa yang terintegrasi dengan Bot WhatsApp.`,
    image: "/icon.jpg",
    type: "website",
  };
  return (
    <>
      <Head>
        <title>Kinantiku - SMKN 3 Buduran</title>
        <meta
          name="description"
          content="Sistem pintar pengelolaan tugas siswa yang terintegrasi dengan Bot WhatsApp."
        />
        <meta
          name="keywords"
          content="Kinanti Ku, produktivitas, manajemen tugas, komunikasi, bot otomatis, SMKN 3 Buduran, Bot LMS, Learning Management System"
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
