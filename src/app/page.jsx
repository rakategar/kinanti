"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
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
  const [q, setQ] = useState("");

  const handleLogout = () => {
    Swal.fire({
      title: "Yakin ingin keluar?",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya",
      cancelButtonText: "Tidak",
      confirmButtonColor: "#7e22ce",
      cancelButtonColor: "#6b7280",
    }).then((result) => {
      if (result.isConfirmed) {
        localStorage.removeItem("hasShownConfetti");
        signOut({ callbackUrl: "/login" });
      }
    });
  };

  useEffect(() => {
    if (status === "authenticated") {
      loadAssignments(session?.user?.id);

      const hasShownConfetti = localStorage.getItem("hasShownConfetti");
      if (!hasShownConfetti) {
        setShowConfetti(true);
        localStorage.setItem("hasShownConfetti", "true");
        const timer = setTimeout(() => setShowConfetti(false), 6000);
        return () => clearTimeout(timer);
      }
    }
  }, [status, session]);

  const loadAssignments = async (userId) => {
    try {
      const res = await fetch(`/api/assignments?userId=${userId}`);
      if (!res.ok) throw new Error("Gagal mengambil data");
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  // filter ringan di client
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return assignments;
    return assignments.filter((a) => {
      const kode = (a.kodeTugas || a.kode || "").toLowerCase();
      const judul = (a.judul || "").toLowerCase();
      const status = (a.status || "").toLowerCase();
      return kode.includes(s) || judul.includes(s) || status.includes(s);
    });
  }, [q, assignments]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 to-purple-200 p-4 md:p-6">
        <div className="max-w-5xl mx-auto bg-white p-6 md:p-8 rounded-xl shadow-xl">
          <div className="animate-pulse h-8 bg-gray-300 rounded w-64 mb-4"></div>
          <div className="animate-pulse h-4 bg-gray-300 rounded w-48 mb-6"></div>
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
      transition={{ duration: 0.35 }}
    >
      {showConfetti && (
        <Confetti
          width={width}
          height={height}
          recycle={false}
          numberOfPieces={160}
        />
      )}

      <div className="max-w-5xl mx-auto bg-white p-4 md:p-6 rounded-xl shadow-xl relative">
        {/* Tombol Logout */}
        <button
          onClick={handleLogout}
          className="absolute top-4 right-4 flex items-center px-3 py-1 md:px-4 md:py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition-all"
        >
          <FiLogOut className="mr-1 md:mr-2" />
          <span className="hidden md:inline">Logout</span>
        </button>

        {/* Judul */}
        <motion.h1
          className="text-2xl md:text-3xl font-bold text-gray-800 mb-1"
          initial={{ y: -8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          Selamat datang, {session?.user?.name}!
        </motion.h1>

        <motion.p
          className="text-gray-600 flex items-center text-sm md:text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <FaTasks className="text-blue-500 mr-2" />
          Berikut adalah tugas yang harus kamu selesaikan:
        </motion.p>

        {/* Search */}
        <div className="mt-4">
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kode, judul, atau status…"
            className="w-full md:w-1/2 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400"
          />
        </div>

        {/* Tabel */}
        {loading ? (
          <div className="animate-pulse h-64 bg-gray-300 rounded w-full mt-4"></div>
        ) : filtered.length === 0 ? (
          <p className="text-gray-500 mt-4">Tidak ada tugas yang cocok.</p>
        ) : (
          <div className="overflow-x-auto mt-4">
            <TugasTable assignments={filtered} userId={session?.user?.id} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
