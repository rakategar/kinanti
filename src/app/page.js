"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";

export default function Dashboard() {
  const { data: session } = useSession();
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false); // State untuk modal logout

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        const res = await fetch("/api/assignments");
        const data = await res.json();
        setAssignments(data);
      } catch (error) {
        console.error("Error fetching assignments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Header dengan tombol logout */}
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md relative">
        <button
          onClick={() => setShowModal(true)}
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
          <table className="w-full mt-4 border-collapse border border-gray-300">
            <thead>
              <tr className="bg-blue-500 text-white">
                <th className="border border-gray-300 p-2">No</th>
                <th className="border border-gray-300 p-2">Judul Tugas</th>
                <th className="border border-gray-300 p-2">Status</th>
                <th className="border border-gray-300 p-2">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((assignment, index) => (
                <tr key={assignment.id} className="text-center">
                  <td className="border border-gray-300 p-2">{index + 1}</td>
                  <td className="border border-gray-300 p-2">
                    {assignment.judul}
                  </td>
                  <td className="border border-gray-300 p-2">
                    {assignment.status === "SELESAI"
                      ? "✅ Selesai"
                      : "⏳ Belum Selesai"}
                  </td>
                  <td className="border border-gray-300 p-2">
                    <a
                      href={`/tugas/${assignment.id}`}
                      className="text-blue-500 hover:underline"
                    >
                      Lihat Tugas
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Konfirmasi Logout */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-gray-900 bg-opacity-50">
          <div className="bg-white p-6 rounded-lg shadow-md text-center">
            <h2 className="text-xl font-bold text-gray-800">
              Konfirmasi Logout
            </h2>
            <p className="text-gray-600 mt-2">
              Apakah Anda yakin ingin logout?
            </p>

            <div className="mt-4 flex justify-center gap-4">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                Iya
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400"
              >
                Tidak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
