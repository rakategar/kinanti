"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import TugasTable from "../app/components/TugasTable"; // ✅ Import komponen

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "authenticated") {
      loadAssignments(session?.user?.id);
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
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="absolute top-4 right-4 px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          Logout
        </button>

        <h1 className="text-2xl font-bold text-gray-800">
          Selamat datang, {session?.user?.name}!
        </h1>
        <p className="text-gray-600">
          Berikut adalah tugas yang harus kamu selesaikan:
        </p>

        {loading ? (
          <p className="text-gray-500 mt-4">Memuat tugas...</p>
        ) : assignments.length === 0 ? (
          <p className="text-gray-500 mt-4">Tidak ada tugas yang tersedia.</p>
        ) : (
          <TugasTable assignments={assignments} userId={session?.user?.id} />
        )}
      </div>
    </div>
  );
}
