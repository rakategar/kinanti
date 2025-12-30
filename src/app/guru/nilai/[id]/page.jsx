"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  FiArrowLeft,
  FiSave,
  FiX,
  FiExternalLink,
  FiEye,
} from "react-icons/fi";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const TZ = "Asia/Jakarta";

function fmtWIB(d) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: TZ,
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(d));
  } catch {
    return String(d);
  }
}

// Grade options
const GRADE_OPTIONS = ["A", "B", "C", "D", "E", ""];

export default function NilaiTugasPage() {
  const params = useParams();
  const router = useRouter();
  const assignmentId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assignment, setAssignment] = useState(null);
  const [rows, setRows] = useState([]);
  const [originalRows, setOriginalRows] = useState([]);

  // Preview modal state
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewName, setPreviewName] = useState("");

  // Fetch data
  useEffect(() => {
    if (!assignmentId) return;
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  async function fetchData() {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/guru/penilaian?assignmentId=${assignmentId}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal memuat data.");
      }
      const data = await res.json();
      setAssignment(data.assignment);
      setRows(data.rows || []);
      // Deep clone untuk perbandingan
      setOriginalRows(JSON.parse(JSON.stringify(data.rows || [])));
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: e.message,
      });
    } finally {
      setLoading(false);
    }
  }

  // Check if row has changes
  const hasChanges = useCallback(
    (row, index) => {
      const original = originalRows[index];
      if (!original) return false;
      return (
        row.grade !== original.grade ||
        row.score !== original.score ||
        row.evaluation !== original.evaluation
      );
    },
    [originalRows]
  );

  // Check if any row has changes
  const anyChanges = useMemo(() => {
    return rows.some((row, index) => hasChanges(row, index));
  }, [rows, hasChanges]);

  // Update row value
  function updateRow(index, field, value) {
    setRows((prev) => {
      const newRows = [...prev];
      newRows[index] = { ...newRows[index], [field]: value };
      return newRows;
    });
  }

  // Handle save
  async function handleSave() {
    if (!anyChanges) {
      Swal.fire({
        icon: "info",
        title: "Tidak ada perubahan",
        text: "Tidak ada data yang perlu disimpan.",
        timer: 2000,
        showConfirmButton: false,
      });
      return;
    }

    const confirm = await Swal.fire({
      title: "Simpan Perubahan?",
      html: `
        <p class="text-sm text-gray-600">
          Anda akan menyimpan perubahan penilaian untuk tugas ini.
        </p>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Simpan",
      cancelButtonText: "Batal",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#6b7280",
      reverseButtons: true,
    });

    if (!confirm.isConfirmed) return;

    try {
      setSaving(true);

      // Filter only changed rows
      const changedRows = rows
        .map((row, index) => ({
          ...row,
          index,
          changed: hasChanges(row, index),
        }))
        .filter((row) => row.changed)
        .map((row) => ({
          siswaId: row.siswaId,
          tugasId: parseInt(assignmentId),
          grade: row.grade || null,
          score:
            row.score !== "" && row.score !== null ? parseInt(row.score) : null,
          evaluation: row.evaluation || null,
        }));

      const res = await fetch("/api/guru/penilaian", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: changedRows }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Gagal menyimpan.");
      }

      // Update original rows setelah berhasil simpan
      setOriginalRows(JSON.parse(JSON.stringify(rows)));

      await Swal.fire({
        icon: "success",
        title: "Berhasil!",
        text: `${changedRows.length} penilaian berhasil disimpan.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (e) {
      console.error(e);
      Swal.fire({
        icon: "error",
        title: "Gagal",
        text: e.message,
      });
    } finally {
      setSaving(false);
    }
  }

  // Handle exit
  async function handleExit() {
    if (anyChanges) {
      const confirm = await Swal.fire({
        title: "Keluar tanpa menyimpan?",
        text: "Perubahan yang belum disimpan akan hilang.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Ya, Keluar",
        cancelButtonText: "Batal",
        confirmButtonColor: "#dc2626",
        cancelButtonColor: "#6b7280",
        reverseButtons: true,
      });

      if (!confirm.isConfirmed) return;
    }

    router.push("/guru");
  }

  // Open preview modal
  function openPreview(url, nama) {
    setPreviewUrl(url);
    setPreviewName(nama);
  }

  function closePreview() {
    setPreviewUrl(null);
    setPreviewName("");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-rose-100 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-gray-200 rounded w-1/3"></div>
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-rose-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-4 md:p-6 mb-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Left: Info */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-xl md:text-2xl font-bold text-gray-800">
                  Penilaian Tugas
                </h1>
              </div>
              <div className="text-sm text-gray-600 space-y-1 ">
                <p>
                  <span className="font-semibold">Kode:</span>{" "}
                  {assignment?.kode || "—"} •{" "}
                  <span className="font-semibold">Judul:</span>{" "}
                  {assignment?.judul || "—"}
                </p>
                <p>
                  <span className="font-semibold">Kelas:</span>{" "}
                  {assignment?.kelas || "—"} •{" "}
                  <span className="font-semibold">Deadline:</span>{" "}
                  {fmtWIB(assignment?.deadline)}
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 ml-10 md:ml-0">
              <span className="text-xs text-gray-500 hidden md:block">
                Klik untuk menyimpan perubahan →
              </span>
              <button
                onClick={handleSave}
                disabled={saving || !anyChanges}
                className={`inline-flex items-center px-4 py-2 rounded-lg font-semibold text-white transition shadow-lg ${
                  anyChanges
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-gray-400 cursor-not-allowed"
                } ${saving ? "opacity-50" : ""}`}
              >
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <FiSave className="mr-2" />
                    Simpan
                  </>
                )}
              </button>
              <button
                onClick={handleExit}
                disabled={saving}
                className="inline-flex items-center px-4 py-2 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition"
              >
                <FiX className="mr-2" />
                Keluar
              </button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                  <th className="text-left p-3 w-10">No</th>
                  <th className="text-left p-3">Nama Siswa</th>
                  <th className="text-left p-3 w-20">Kelas</th>
                  <th className="text-left p-3 w-36">Waktu Kumpul</th>
                  <th className="text-center p-3 w-28">File</th>
                  <th className="text-center p-3 w-20">Grade</th>
                  <th className="text-center p-3 w-24">Score</th>
                  <th className="text-left p-3 min-w-[250px]">Evaluasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((row, index) => {
                  const isChanged = hasChanges(row, index);
                  const hasSubmission = !!row.pdfUrl;

                  return (
                    <tr
                      key={row.siswaId}
                      className={`transition ${
                        isChanged
                          ? "bg-yellow-100 hover:bg-yellow-100"
                          : "hover:bg-gray-50"
                      } ${!hasSubmission ? "bg-gray-50/50" : ""}`}
                    >
                      <td className="p-3 text-gray-500">{index + 1}</td>
                      <td className="p-3 font-medium">{row.nama || "—"}</td>
                      <td className="p-3">{row.kelas || "—"}</td>
                      <td className="p-3 text-xs">
                        {row.submittedAt ? (
                          fmtWIB(row.submittedAt)
                        ) : (
                          <span className="text-red-500 font-medium">
                            Belum Kumpul
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {row.pdfUrl ? (
                          <button
                            onClick={() => openPreview(row.pdfUrl, row.nama)}
                            className="inline-flex items-center px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs font-medium transition"
                            title="Lihat file tugas"
                          >
                            <FiEye className="mr-1" />
                            Lihat
                          </button>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <select
                          value={row.grade || ""}
                          onChange={(e) =>
                            updateRow(index, "grade", e.target.value)
                          }
                          disabled={!hasSubmission}
                          className={`w-full px-2 py-1 rounded border text-center font-semibold ${
                            hasSubmission
                              ? "border-gray-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          {GRADE_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                              {g || "—"}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={row.score ?? ""}
                          onChange={(e) =>
                            updateRow(index, "score", e.target.value)
                          }
                          disabled={!hasSubmission}
                          placeholder="0-100"
                          className={`w-full px-2 py-1 rounded border text-center ${
                            hasSubmission
                              ? "border-gray-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                        />
                      </td>
                      <td className="p-3">
                        <textarea
                          value={row.evaluation || ""}
                          onChange={(e) =>
                            updateRow(index, "evaluation", e.target.value)
                          }
                          disabled={!hasSubmission}
                          placeholder="Tulis evaluasi..."
                          rows={2}
                          className={`w-full px-2 py-1 rounded border text-xs resize-none ${
                            hasSubmission
                              ? "border-gray-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      Tidak ada siswa di kelas ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-300"></div>
            <span>Baris dengan perubahan (belum disimpan)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-100 border border-gray-300"></div>
            <span>Siswa belum mengumpulkan</span>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-[999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-5xl h-[85vh] rounded-xl shadow-2xl flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-bold text-gray-800">Preview Tugas</h3>
                <p className="text-sm text-gray-500">{previewName}</p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm font-medium transition"
                >
                  <FiExternalLink className="mr-1" />
                  Buka di Tab Baru
                </a>
                <button
                  onClick={closePreview}
                  className="p-2 rounded hover:bg-gray-100 text-gray-600"
                >
                  <FiX className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="flex-1 bg-gray-100">
              <iframe
                src={`${previewUrl}#toolbar=1&navpanes=0`}
                className="w-full h-full"
                title="PDF Preview"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
