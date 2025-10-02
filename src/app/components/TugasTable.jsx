"use client";

import { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";

/** =========================
 *  Helpers tanggal (WIB)
 *  ========================= */
const LOCALE_TZ = "Asia/Jakarta";
function fmtWIB(dateLike) {
  if (!dateLike) return "-";
  try {
    const d = new Date(dateLike);
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: LOCALE_TZ,
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return String(dateLike);
  }
}

function relDeadline(dateLike) {
  if (!dateLike) return "";
  const now = new Date();
  const d = new Date(dateLike);
  const ms = d.getTime() - now.getTime();
  const oneDay = 24 * 60 * 60 * 1000;
  const days = Math.round(ms / oneDay);

  if (ms < 0) return "• sudah lewat";
  if (days === 0) return "• hari ini";
  if (days === 1) return "• besok";
  if (days > 1) return `• ${days} hari lagi`;
  // lewat tapi tidak jauh → absolut saja
  return "• sudah lewat";
}

/** =========================
 *  Badge status
 *  ========================= */
function StatusBadge({ status, deadline }) {
  const now = new Date();
  const hasDeadline = !!deadline;
  const isOverdue =
    status !== "SELESAI" &&
    hasDeadline &&
    new Date(deadline).getTime() < now.getTime();

  if (status === "SELESAI")
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
        ✅ Selesai
      </span>
    );

  if (isOverdue)
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
        🔴 Terlambat
      </span>
    );

  return (
    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
      ⏳ Belum Selesai
    </span>
  );
}

/** =========================
 *  Komponen utama
 *  ========================= */
export default function TugasTable({ assignments, userId }) {
  const [selectedTugas, setSelectedTugas] = useState(null);
  const [isModalOpen, setModalOpen] = useState(false);
  const [isUploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  // Urutkan by deadline (null di akhir), lalu by status
  const rows = useMemo(() => {
    const copy = [...assignments];
    copy.sort((a, b) => {
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      // opsional: SELESAI di bawah
      const as = a.status === "SELESAI" ? 1 : 0;
      const bs = b.status === "SELESAI" ? 1 : 0;
      return as - bs;
    });
    return copy;
  }, [assignments]);

  // ================== Modal Upload ==================
  const openModal = (tugas) => {
    setSelectedTugas(tugas);
    setModalOpen(true);
  };

  const closeModal = () => {
    setSelectedTugas(null);
    setUploadedFile(null);
    setModalOpen(false);
  };

  // ================== Drag & Drop ==================
  const onDrop = (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file || !file.type.includes("pdf")) {
      showAlert("⚠️ Hanya file PDF yang diperbolehkan!");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showAlert("⚠️ Ukuran maksimum 2MB.");
      return;
    }
    setUploadedFile({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      file,
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    multiple: false,
  });

  // ================== Alert ringan ==================
  const showAlert = (message) => {
    const alertDiv = document.createElement("div");
    alertDiv.className =
      "fixed top-4 right-4 bg-white p-4 rounded-lg shadow-lg border border-gray-200 flex items-center z-[1000]";
    alertDiv.innerHTML = `
      <span class="mr-3">${message}</span>
      <button onclick="this.parentElement.remove()" class="text-gray-500 hover:text-gray-700 font-bold">×</button>
    `;
    document.body.appendChild(alertDiv);
    setTimeout(() => alertDiv.remove(), 3000);
  };

  // ================== Simpan upload ==================
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
        // reload agar status & link ikut ter-update
        window.location.reload();
      } else {
        showAlert(`❌ ${data.error || "Gagal mengunggah."}`);
      }
    } catch (err) {
      console.error("Error:", err);
      showAlert("❌ Terjadi kesalahan saat mengunggah tugas.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      {/* Tabel */}
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <th className="text-left p-3 w-12">No</th>
                <th className="text-left p-3">Kode</th>
                <th className="text-left p-3">Judul</th>
                <th className="text-left p-3">Deadline</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Lampiran</th>
                <th className="text-left p-3">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((assignment, index) => {
                const kode = assignment.kodeTugas || assignment.kode;
                const isSelesai = assignment.status === "SELESAI";
                const isOverdue =
                  !isSelesai &&
                  assignment.deadline &&
                  new Date(assignment.deadline).getTime() < Date.now();

                return (
                  <tr
                    key={assignment.id}
                    className={`hover:bg-gray-50 transition ${
                      isOverdue ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="p-3">{index + 1}</td>
                    <td className="p-3 font-medium">{kode}</td>
                    <td className="p-3">{assignment.judul}</td>

                    {/* Deadline */}
                    <td className="p-3">
                      {assignment.deadline ? (
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {fmtWIB(assignment.deadline)}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {relDeadline(assignment.deadline)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    {/* Status (Selesai / Terlambat / Belum Selesai) */}
                    <td className="p-3">
                      <StatusBadge
                        status={assignment.status}
                        deadline={assignment.deadline}
                      />
                    </td>

                    {/* Lampiran (dari guru) */}
                    <td className="p-3">
                      {assignment.lampiranPDF || assignment.pdfUrl ? (
                        <a
                          href={(
                            assignment.lampiranPDF || assignment.pdfUrl
                          ).replace(/['"]+/g, "")}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          📎 Lihat
                        </a>
                      ) : (
                        <span className="text-gray-400">Tidak ada</span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="p-3">
                      {isSelesai ? (
                        assignment.lampiranDikumpulkan ? (
                          <a
                            href={assignment.lampiranDikumpulkan.replace(
                              /['"]+/g,
                              ""
                            )}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            📄 Tugas Saya
                          </a>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )
                      ) : (
                        <button
                          className="bg-green-500 text-white px-3 py-1.5 rounded-md hover:bg-green-600 transition disabled:opacity-50"
                          onClick={() => openModal(assignment)}
                          disabled={isUploading}
                          title={
                            isOverdue
                              ? "Sudah terlambat, tetap bisa upload"
                              : "Kumpulkan PDF"
                          }
                        >
                          Kumpulkan
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Upload */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl p-6">
            <h2 className="text-xl font-bold mb-1">Upload Tugas</h2>
            <p className="text-gray-600 text-sm">
              Kode Tugas:{" "}
              <span className="font-semibold">
                {selectedTugas?.kodeTugas || selectedTugas?.kode}
              </span>
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
                    width="26"
                    height="26"
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
                <p className="mt-3 text-gray-700">
                  {isDragActive
                    ? "Lepaskan file di sini…"
                    : "Tarik & lepaskan file PDF di sini, atau klik untuk memilih"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Hanya PDF (maks. 2MB).
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
                  {(uploadedFile.size / 1024).toFixed(1)} KB
                </p>
                <p className="text-gray-700">
                  <strong>Tanggal:</strong>{" "}
                  {new Date(uploadedFile.lastModified).toLocaleDateString(
                    "id-ID"
                  )}
                </p>
              </div>
            )}

            {/* Tombol */}
            <div className="mt-5 flex items-center justify-between">
              <button
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300 disabled:opacity-50"
                onClick={closeModal}
                disabled={isUploading}
              >
                Batal
              </button>

              <div className="flex items-center gap-2">
                {uploadedFile && (
                  <button
                    className="bg-yellow-400 text-gray-900 px-4 py-2 rounded-md hover:bg-yellow-500"
                    onClick={() => setUploadedFile(null)}
                    disabled={isUploading}
                  >
                    Ganti File
                  </button>
                )}
                <button
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
                  onClick={handleSave}
                  disabled={!uploadedFile || isUploading}
                >
                  {isUploading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
