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
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <meta
          name="keywords"
          content="Kinanti Ku, produktivitas, manajemen tugas, komunikasi, bot otomatis, SMKN 3 Buduran, Bot LMS, Learning Management System"
        />
        <meta name="author" content="Raka - Made With <3" />
        <meta name="robots" content="index, follow" />
        <link rel="icon" href="/icon.jpg" />

        {/* Open Graph Meta Tags */}
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:image" content={meta.image} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content={meta.type} />

        {/* Twitter Cards */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={meta.title} />
        <meta name="twitter:description" content={meta.description} />
        <meta name="twitter:image" content={meta.image} />

        {/* Structured Data (JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: meta.title,
              description: meta.description,
              url: window.location.href,
              image: meta.image,
            }),
          }}
        ></script>

        {/* Canonical Link */}
        <link rel="canonical" href={window.location.href} />
      </Head>
      <html lang="en-US">
        <body className={inter.className}>
          <SessionProvider>{children}</SessionProvider>
        </body>
      </html>
    </>
  );
}
