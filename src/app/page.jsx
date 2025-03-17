"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FiLogOut } from "react-icons/fi";
import { FaTasks } from "react-icons/fa";
import TugasTable from "../app/components/TugasTable";
import Confetti from "react-confetti";
import { useWindowSize } from "react-use";
import Swal from "sweetalert2";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();

  const handleLogout = () => {
    Swal.fire({
      title: "Yakin ingin keluar?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya",
      cancelButtonText: "Tidak",
      confirmButtonColor: "#7e22ce", // Warna ungu
      cancelButtonColor: "#6b7280", // Warna abu-abu
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem("hasShownConfetti"); // Hapus status confetti
        signOut({ callbackUrl: "/login" }); // Proses logout
      }
    });
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

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 p-4 md:p-6">
        <div className="max-w-4xl mx-auto bg-white p-4 md:p-6 rounded-xl shadow-xl">
          {/* Skeleton untuk Judul */}
          <div className="animate-pulse h-8 bg-gray-300 rounded w-64 mb-4"></div>

          {/* Skeleton untuk Deskripsi */}
          <div className="animate-pulse h-4 bg-gray-300 rounded w-48 mb-6"></div>

          {/* Skeleton untuk Tabel */}
          <div className="animate-pulse h-64 bg-gray-300 rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 p-4 md:p-6"
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

      <div className="max-w-4xl mx-auto bg-white p-4 md:p-6 rounded-xl shadow-xl relative">
        {/* Tombol Logout */}
        <button
          onClick={handleLogout}
          className="absolute top-4 right-4 flex items-center px-3 py-1 md:px-4 md:py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-all"
        >
          <FiLogOut className="mr-1 md:mr-2" />{" "}
          <span className="hidden md:inline">Logout</span>
        </button>

        {/* Judul Dashboard */}
        <motion.h1
          className="text-2xl md:text-3xl font-bold text-gray-800 mb-2"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          Selamat datang, {session?.user?.name}!
        </motion.h1>

        {/* Deskripsi Tugas */}
        <motion.p
          className="text-gray-600 flex items-center text-sm md:text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <FaTasks className="text-blue-500 mr-2" /> Berikut adalah tugas yang
          harus kamu selesaikan:
        </motion.p>

        {/* Tabel Tugas */}
        {loading ? (
          <div className="animate-pulse h-64 bg-gray-300 rounded w-full mt-4"></div>
        ) : assignments.length === 0 ? (
          <p className="text-gray-500 mt-4">Tidak ada tugas yang tersedia.</p>
        ) : (
          <div className="overflow-x-auto mt-4">
            <TugasTable assignments={assignments} userId={session?.user?.id} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
