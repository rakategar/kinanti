import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./provider";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Kinantiku - Sistem Pengelolaan Tugas Siswa SMKN 3 Buduran",
  description:
    "Kinantiku adalah sistem pintar pengelolaan tugas siswa yang terintegrasi dengan Bot WhatsApp, dirancang untuk SMKN 3 Buduran.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <title>{metadata.title}</title>
        <meta name="description" content={metadata.description} />
        <meta
          name="keywords"
          content="Kinantiku, SMKN 3 Buduran, pengelolaan tugas, bot WhatsApp, sistem tugas online, manajemen tugas siswa, LMS, learning management system"
        />
        <meta name="author" content="Raka - Made With <3" />
        <meta name="robots" content="index, follow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="canonical" href="https://kinantiku.com" />
        <link rel="icon" href="/icon.ico" />

        {/* Open Graph */}
        <meta property="og:title" content={metadata.title} />
        <meta property="og:description" content={metadata.description} />
        <meta property="og:image" content="https://kinantiku.com/logo.png" />
        <meta property="og:url" content="https://kinantiku.com" />
        <meta property="og:type" content="website" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={metadata.title} />
        <meta name="twitter:description" content={metadata.description} />
        <meta name="twitter:image" content="https://kinantiku.com/logo.png" />

        {/* Facebook Verification */}
        <meta
          name="facebook-domain-verification"
          content="ljh1l7z61w8t8mespc4u99njkeprr0"
        />

        {/* Schema.org JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: metadata.title,
              description: metadata.description,
              url: "https://kinantiku.com",
              image: "https://kinantiku.com/logo.png",
              publisher: {
                "@type": "Organization",
                name: "SMKN 3 Buduran",
                logo: {
                  "@type": "ImageObject",
                  url: "https://kinantiku.com/logo.jpg",
                },
              },
            }),
          }}
        ></script>
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <SpeedInsights />
      </body>
    </html>
  );
}
