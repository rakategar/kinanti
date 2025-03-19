"use client";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import Head from "next/head";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({ children }) {
  const meta = {
    title: "Kinantiku - Sistem Pengelolaan Tugas Siswa SMKN 3 Buduran",
    description:
      "Kinantiku adalah sistem pintar pengelolaan tugas siswa yang terintegrasi dengan Bot WhatsApp, dirancang untuk SMKN 3 Buduran.",
    image: "https://kinantiku.com/logo.png", // URL absolut
    type: "website",
  };

  const isBrowser = typeof window !== "undefined";
  const currentUrl = isBrowser ? window.location.href : "https://kinantiku.com";

  return (
    <>
      <Head>
        <title>{meta.title}</title>
        <meta
          name="facebook-domain-verification"
          content="ljh1l7z61w8t8mespc4u99njkeprr0"
        />
        <meta name="description" content={meta.description} />
        <meta
          name="keywords"
          content="Kinantiku, SMKN 3 Buduran, pengelolaan tugas, bot WhatsApp, sistem tugas online, manajemen tugas siswa, LMS, learning management system"
        />
        <meta name="author" content="Raka - Made With <3" />
        <meta name="robots" content="index, follow" />
        <link rel="icon" href="/icon.ico" /> {/* Ikon web */}
        {/* Open Graph Meta Tags */}
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:image" content={meta.image} />
        <meta property="og:url" content={currentUrl} />
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
              url: currentUrl,
              image: meta.image,
              publisher: {
                "@type": "Organization",
                name: "SMKN 3 Buduran",
                logo: {
                  "@type": "ImageObject",
                  url: "https://kinantiku.com/logo.jpg", // Ganti dengan logo sekolah jika ada
                },
              },
            }),
          }}
        ></script>
        {/* Canonical Link */}
        <link rel="canonical" href={currentUrl} />
      </Head>
      <html lang="id">
        {/* Ganti ke 'id' jika target audiens Indonesia */}
        <body className={inter.className}>
          <SessionProvider>{children}</SessionProvider>
          <SpeedInsights />
        </body>
      </html>
    </>
  );
}
