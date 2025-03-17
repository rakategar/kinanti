"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FiLogOut } from "react-icons/fi";
import { FaTasks } from "react-icons/fa";
import TugasTable from "../app/components/TugasTable";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();

  const handleLogout = () => {
    localStorage.removeItem("hasShownConfetti"); // Hapus status confetti
    signOut({ callbackUrl: "/login" }); // Proses logout
  };

  useEffect(() => {
    if (status === "authenticated") {
      loadAssignments(session?.user?.id);

      // Periksa apakah confetti sudah pernah ditampilkan
      const hasShownConfetti = localStorage.getItem("hasShownConfetti");

      if (!hasShownConfetti) {
        // Tampilkan confetti hanya jika belum pernah ditampilkan
        setShowConfetti(true);

        // Simpan status di localStorage
        localStorage.setItem("hasShownConfetti", "true");

        // Sembunyikan confetti setelah 10 detik
        const timer = setTimeout(() => {
          setShowConfetti(false);
        }, 10000);

        // Bersihkan timer saat komponen di-unmount
        return () => clearTimeout(timer);
      }
    }
  }, [status, session]);

  const loadAssignments = async (userId) => {
    try {
      const res = await fetch(`/api/assignments?userId=${userId}`);
      if (!res.ok) {
        throw new Error("Gagal mengambil data");
      }
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") return <p>Loading session...</p>;

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Confetti */}
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={200}
          colors={["#FFC0CB", "#FF69B4", "#FF1493", "#C71585", "#DB7093"]}
          initialVelocityX={{ min: -10, max: 10 }}
          initialVelocityY={{ min: -10, max: 10 }}
          gravity={0.1}
          wind={0.05}
        />
      )}

      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-xl relative">
        <button
          onClick={handleLogout}
          className="absolute top-4 right-4 flex items-center px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-all"
        >
          <FiLogOut className="mr-2" /> Logout
        </button>

        <motion.h1
          className="text-3xl font-bold text-gray-800 mb-2"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          Selamat datang, {session?.user?.name}!
        </motion.h1>

        <motion.p
          className="text-gray-600 flex items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <FaTasks className="text-blue-500 mr-2" /> Berikut adalah tugas yang
          harus kamu selesaikan:
        </motion.p>

        {loading ? (
          <p className="text-gray-500 mt-4">Memuat tugas...</p>
        ) : assignments.length === 0 ? (
          <p className="text-gray-500 mt-4">Tidak ada tugas yang tersedia.</p>
        ) : (
          <TugasTable assignments={assignments} userId={session?.user?.id} />
        )}
      </div>
    </motion.div>
  );
}
