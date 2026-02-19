"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useState, useEffect, useMemo } from "react";

/* ====== Floating School Items (buku, pensil, penggaris, dll) ====== */
const SCHOOL_ITEMS = [
  "📚",
  "✏️",
  "📖",
  "🎒",
  "📝",
  "📐",
  "🔬",
  "🎓",
  "📏",
  "🖊️",
  "📓",
  "💡",
  "🧮",
  "📎",
  "✂️",
  "🖍️",
];

function FloatingItems() {
  const items = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        emoji: SCHOOL_ITEMS[i % SCHOOL_ITEMS.length],
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 16 + 18,
        duration: Math.random() * 10 + 8,
        delay: Math.random() * 5,
        rotate: Math.random() * 360,
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((item) => (
        <motion.span
          key={item.id}
          className="absolute select-none"
          style={{ left: `${item.x}%`, top: `${item.y}%`, fontSize: item.size }}
          animate={{
            y: [0, -30, 0],
            x: [0, 10, -10, 0],
            rotate: [
              item.rotate,
              item.rotate + 20,
              item.rotate - 20,
              item.rotate,
            ],
            opacity: [0.15, 0.4, 0.15],
          }}
          transition={{
            duration: item.duration,
            repeat: Infinity,
            delay: item.delay,
            ease: "easeInOut",
          }}
        >
          {item.emoji}
        </motion.span>
      ))}
    </div>
  );
}

/* ====== Open Book SVG Animation ====== */
function OpenBook() {
  return (
    <motion.svg
      width="200"
      height="160"
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      initial={{ scale: 0, rotate: -10 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 100, damping: 12, delay: 0.2 }}
      className="drop-shadow-2xl"
    >
      {/* book shadow */}
      <ellipse cx="100" cy="148" rx="80" ry="8" fill="rgba(0,0,0,0.1)" />

      {/* left page */}
      <motion.path
        d="M100 30 L100 130 Q70 125 20 130 L20 30 Q70 25 100 30Z"
        fill="#fef3c7"
        stroke="#d97706"
        strokeWidth="1.5"
        initial={{ rotateY: -90 }}
        animate={{ rotateY: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      />

      {/* right page */}
      <motion.path
        d="M100 30 L100 130 Q130 125 180 130 L180 30 Q130 25 100 30Z"
        fill="#fefce8"
        stroke="#d97706"
        strokeWidth="1.5"
        initial={{ rotateY: 90 }}
        animate={{ rotateY: 0 }}
        transition={{ delay: 0.5, duration: 0.6 }}
      />

      {/* spine */}
      <line
        x1="100"
        y1="28"
        x2="100"
        y2="132"
        stroke="#b45309"
        strokeWidth="2"
      />

      {/* left page lines */}
      {[48, 58, 68, 78, 88, 98].map((y, i) => (
        <motion.line
          key={`l-${i}`}
          x1="32"
          y1={y}
          x2="88"
          y2={y}
          stroke="#d4a574"
          strokeWidth="0.8"
          strokeDasharray="3 2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.8 + i * 0.08 }}
        />
      ))}

      {/* right page - question mark */}
      <motion.text
        x="140"
        y="90"
        textAnchor="middle"
        fontSize="40"
        fontWeight="bold"
        fill="#b45309"
        opacity="0.3"
        animate={{ opacity: [0.15, 0.35, 0.15] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        ?
      </motion.text>

      {/* bookmark ribbon */}
      <motion.path
        d="M92 25 L92 10 L100 18 L108 10 L108 25"
        fill="#dc2626"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1, type: "spring" }}
      />
    </motion.svg>
  );
}

/* ====== Pencil Writing Animation ====== */
function WritingPencil() {
  return (
    <motion.div
      className="absolute bottom-32 right-8 md:right-24 opacity-20"
      animate={{ rotate: [0, -3, 3, 0], y: [0, -5, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <motion.g
          animate={{ x: [0, 4, -2, 0], y: [0, 2, -1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <rect
            x="25"
            y="8"
            width="10"
            height="55"
            rx="1"
            fill="#f59e0b"
            transform="rotate(25, 30, 35)"
          />
          <polygon
            points="20,58 30,70 40,58"
            fill="#fbbf24"
            transform="rotate(25, 30, 35)"
          />
          <polygon
            points="27,66 30,73 33,66"
            fill="#374151"
            transform="rotate(25, 30, 35)"
          />
        </motion.g>
      </svg>
    </motion.div>
  );
}

/* ====== 404 Digit Animation ====== */
const digitVariants = {
  hidden: { y: 60, opacity: 0, scale: 0.5 },
  visible: (i) => ({
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 150,
      damping: 12,
      delay: 0.4 + i * 0.12,
    },
  }),
};

/* ============================== PAGE ============================== */
export default function NotFound() {
  const tips = [
    "💡 Cek kembali URL yang kamu ketik",
    "📌 Mungkin halaman ini sudah dipindahkan",
    "🔍 Gunakan menu navigasi untuk mencari halaman",
  ];

  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % tips.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [tips.length]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-100 select-none">
      {/* blackboard bg shape */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 w-[90%] max-w-2xl h-64 rounded-xl bg-gradient-to-b from-green-800 to-green-900 shadow-2xl border-8 border-amber-800 opacity-10" />

      {/* floating school items */}
      <FloatingItems />

      {/* writing pencil decoration */}
      <WritingPencil />

      {/* main content */}
      <div className="z-10 flex flex-col items-center px-4">
        {/* open book */}
        <OpenBook />

        {/* 404 number */}
        <div className="mt-6 flex items-center gap-2 md:gap-4">
          {["4", "0", "4"].map((char, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={digitVariants}
              initial="hidden"
              animate="visible"
              className="text-7xl md:text-9xl font-black"
              style={{
                background:
                  "linear-gradient(135deg, #92400e 0%, #d97706 40%, #f59e0b 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                filter: "drop-shadow(0 4px 8px rgba(146,64,14,0.2))",
              }}
            >
              {char}
            </motion.span>
          ))}
        </div>

        {/* title */}
        <motion.h1
          className="mt-3 text-xl md:text-2xl font-bold text-amber-900"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          Halaman Tidak Ditemukan 📄
        </motion.h1>

        {/* subtitle */}
        <motion.p
          className="mt-2 max-w-md text-center text-sm md:text-base text-amber-700/80"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          Seperti buku yang hilang dari perpustakaan, halaman yang kamu cari
          tidak ada di rak ini.
        </motion.p>

        {/* rotating tips */}
        <motion.div
          className="mt-5 h-8 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
        >
          <motion.p
            key={tipIndex}
            className="text-xs md:text-sm text-amber-600 font-medium"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            {tips[tipIndex]}
          </motion.p>
        </motion.div>

        {/* CTA buttons */}
        <motion.div
          className="mt-8 flex flex-col sm:flex-row items-center gap-3"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.3, type: "spring", stiffness: 200 }}
        >
          <Link
            href="/"
            className="group inline-flex items-center gap-2 rounded-full bg-amber-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-amber-600/30 transition-all hover:bg-amber-500 hover:shadow-amber-500/40 hover:scale-105 active:scale-95"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Kembali ke Beranda
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full border-2 border-amber-400 bg-white/60 backdrop-blur-sm px-7 py-3 text-sm font-bold text-amber-700 transition-all hover:bg-amber-100 hover:scale-105 active:scale-95"
          >
            🔑 Login
          </Link>
        </motion.div>
      </div>

      {/* bottom decoration - notebook paper lines */}
      <div className="absolute bottom-0 left-0 w-full h-28 overflow-hidden opacity-20">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="w-full border-b border-blue-300"
            style={{ marginTop: i === 0 ? 8 : 18 }}
          />
        ))}
        <div className="absolute left-16 top-0 h-full border-l-2 border-red-300" />
      </div>

      {/* corner paper fold */}
      <motion.div
        className="absolute top-0 right-0 w-20 h-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
      >
        <svg viewBox="0 0 80 80" fill="none" className="w-full h-full">
          <path d="M80 0 L80 80 L0 0Z" fill="rgba(217,119,6,0.06)" />
          <path
            d="M80 0 L80 80 L0 0Z"
            fill="none"
            stroke="rgba(217,119,6,0.1)"
            strokeWidth="1"
          />
        </svg>
      </motion.div>

      {/* footer credit */}
      <motion.p
        className="absolute bottom-3 text-xs text-amber-400 z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        Kinantiku &mdash; Sistem Pengelolaan Tugas Siswa
      </motion.p>
    </div>
  );
}
