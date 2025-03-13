"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";

export default function TugasTable({ assignments, userId }) {
  const [selectedTugas, setSelectedTugas] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isUploading, setUploading] = useState(false);

  // 🔹 Modal Upload Handler
  const openModal = (tugas) => {
    setSelectedTugas(tugas);
    setModalOpen(true);
  };

  const closeModal = () => {
    setSelectedTugas(null);
    setModalOpen(false);
  };

  // 🔹 Drag & Drop Setup
  const onDrop = async (acceptedFiles) => {
    const file = acceptedFiles[0];

    if (!file.type.includes("pdf")) {
      alert("⚠️ Hanya file PDF yang diperbolehkan!");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("userId", userId);
    formData.append("tugasId", selectedTugas.id);

    try {
      const res = await fetch("/api/upload-tugas", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        alert("✅ Tugas berhasil dikumpulkan!");
        closeModal();
        // 🔄 Reload data agar status berubah
        window.location.reload();
      } else {
        alert("❌ " + data.error);
      }
    } catch (err) {
      console.error("Error:", err);
      alert("❌ Terjadi kesalahan saat mengunggah tugas.");
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: "application/pdf",
  });

  return (
    <div>
      {/* 📌 TABEL */}
      <table className="w-full mt-4 border-collapse border border-gray-300">
        <thead>
          <tr className="bg-blue-500 text-white">
            <th className="border border-gray-300 p-2">No</th>
            <th className="border border-gray-300 p-2">Kode Tugas</th>
            <th className="border border-gray-300 p-2">Judul Tugas</th>
            <th className="border border-gray-300 p-2">Status</th>
            <th className="border border-gray-300 p-2">Lampiran</th>
            <th className="border border-gray-300 p-2">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((assignment, index) => (
            <tr key={assignment.id} className="text-center">
              <td className="border border-gray-300 p-2">{index + 1}</td>
              <td className="border border-gray-300 p-2">
                {assignment.kodeTugas}
              </td>
              <td className="border border-gray-300 p-2">{assignment.judul}</td>
              <td className="border border-gray-300 p-2">
                {assignment.status === "SELESAI"
                  ? "✅ Selesai"
                  : "⏳ Belum Selesai"}
              </td>
              <td className="border border-gray-300 p-2">
                {assignment.lampiranPDF ? (
                  <a
                    href={assignment.lampiranPDF}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    📎 Lihat
                  </a>
                ) : (
                  "❌ Tidak Ada"
                )}
              </td>
              <td className="border border-gray-300 p-2">
                {assignment.status === "SELESAI" ? (
                  <a
                    href={assignment.lampiranDikumpulkan?.replace(/['"]+/g, "")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    📄 Tugas Saya
                  </a>
                ) : (
                  <button
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                    onClick={() => openModal(assignment)}
                  >
                    Kumpulkan
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 📌 MODAL UPLOAD */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-bold mb-4">Upload Tugas</h2>
            <p className="text-gray-600">
              Kode Tugas: {selectedTugas.kodeTugas}
            </p>

            <div
              {...getRootProps()}
              className={`mt-4 p-6 border-2 border-dashed rounded-lg text-center cursor-pointer ${
                isDragActive ? "border-blue-500 bg-blue-100" : "border-gray-300"
              }`}
            >
              <input {...getInputProps()} />
              {isDragActive ? (
                <p className="text-blue-500">Lepaskan file di sini...</p>
              ) : (
                <p>
                  📂 Tarik & Lepaskan file PDF di sini, atau klik untuk memilih
                </p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                onClick={closeModal}
                disabled={isUploading}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
