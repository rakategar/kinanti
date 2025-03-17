"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";

export default function TugasTable({ assignments, userId }) {
  const [selectedTugas, setSelectedTugas] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null); // State untuk file yang diupload

  // 🔹 Modal Upload Handler
  const openModal = (tugas) => {
    setSelectedTugas(tugas);
    setModalOpen(true);
  };

  const closeModal = () => {
    setSelectedTugas(null);
    setUploadedFile(null); // Reset file yang diupload
    setModalOpen(false);
  };

  // 🔹 Drag & Drop Setup
  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];

    if (!file.type.includes("pdf")) {
      showAlert("⚠️ Hanya file PDF yang diperbolehkan!");
      return;
    }

    // Simpan file yang diupload untuk preview
    setUploadedFile({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      file: file, // Simpan file asli untuk proses upload nanti
    });
  };

  // 🔹 Fungsi untuk menampilkan alert custom
  const showAlert = (message) => {
    const alertDiv = document.createElement("div");
    alertDiv.className =
      "fixed top-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 flex items-center";
    alertDiv.innerHTML = `
      <span class="mr-2">${message}</span>
      <button onclick="this.parentElement.remove()" class="text-gray-500 hover:text-gray-700">
        &times;
      </button>
    `;
    document.body.appendChild(alertDiv);

    // Hapus alert setelah 3 detik
    setTimeout(() => {
      alertDiv.remove();
    }, 3000);
  };

  // 🔹 Fungsi untuk menyimpan file ke database
  const handleSave = async () => {
    if (!uploadedFile) {
      showAlert("⚠️ Silakan pilih file terlebih dahulu!");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", uploadedFile.file);
    formData.append("userId", userId);
    formData.append("tugasId", selectedTugas.id);

    try {
      const res = await fetch("/api/upload-tugas", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok) {
        showAlert("✅ Tugas berhasil dikumpulkan!");
        closeModal();
        // 🔄 Reload data agar status berubah
        window.location.reload();
      } else {
        showAlert(`❌ ${data.error}`);
      }
    } catch (err) {
      console.error("Error:", err);
      showAlert("❌ Terjadi kesalahan saat mengunggah tugas.");
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

            {/* Area Upload */}
            <div
              {...getRootProps()}
              className="mt-4 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all"
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center justify-center">
                <div className="bg-gray-100 rounded-full p-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-blue-500"
                  >
                    <path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" />
                    <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                    <path d="m5 12-3 3 3 3" />
                    <path d="m9 18 3-3-3-3" />
                  </svg>
                </div>
                <p className="mt-4 text-gray-700">
                  {isDragActive
                    ? "Lepaskan file di sini..."
                    : "Tarik & Lepaskan file PDF di sini, atau klik untuk memilih"}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  Hanya file PDF yang diperbolehkan (maks. 2MB).
                </p>
              </div>
            </div>

            {/* Preview File */}
            {uploadedFile && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-gray-700">
                  <strong>Nama File:</strong> {uploadedFile.name}
                </p>
                <p className="text-gray-700">
                  <strong>Ukuran:</strong>{" "}
                  {(uploadedFile.size / 1024).toFixed(2)} KB
                </p>
                <p className="text-gray-700">
                  <strong>Tanggal:</strong>{" "}
                  {new Date(uploadedFile.lastModified).toLocaleDateString()}
                </p>
              </div>
            )}

            {/* Tombol Simpan dan Ganti */}
            <div className="mt-4 flex justify-between">
              <button
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 disabled:opacity-50"
                onClick={closeModal}
                disabled={isUploading}
              >
                Batal
              </button>
              {uploadedFile && (
                <button
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
                  onClick={() => setUploadedFile(null)} // Reset file yang diupload
                >
                  Ganti File
                </button>
              )}
              <button
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
                onClick={handleSave}
                disabled={!uploadedFile || isUploading}
              >
                {isUploading ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
