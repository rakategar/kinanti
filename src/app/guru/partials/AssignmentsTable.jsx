"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FiShare2, FiFileText, FiTrash2, FiX, FiEdit3 } from "react-icons/fi";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const TZ = "Asia/Jakarta";

function fmtWIB(d) {
  if (!d) return "—";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: TZ,
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(d));
  } catch {
    return String(d);
  }
}

function rel(d) {
  if (!d) return "";
  const now = new Date();
  const t = new Date(d);
  const diff = t.getTime() - now.getTime();
  const oneDay = 86400000;
  const days = Math.round(diff / oneDay);
  if (diff < 0) return "• sudah lewat";
  if (days === 0) return "• hari ini";
  if (days === 1) return "• besok";
  return `• ${days} hari lagi`;
}

function PillButton({ children, active, onClick, title, disabled }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`px-3 py-1 text-xs font-semibold rounded-full border transition ${
        active
          ? "bg-gray-900 text-white border-gray-900"
          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );
}

export default function GuruAssignmentsTable({
  data,
  onBroadcast,
  onRekap,
  onDelete,
}) {
  const router = useRouter();
  const [uiBusy, setUiBusy] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusActiveTab, setStatusActiveTab] = useState("belum");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusData, setStatusData] = useState({
    assignment: null,
    count: { belum: 0, terlambat: 0, selesai: 0 },
    belumList: [],
    terlambatList: [],
    selesaiList: [],
  });

  // State untuk Modal Broadcast
  const [broadcastModalOpen, setBroadcastModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [broadcastKelas, setBroadcastKelas] = useState("");
  const [kelasDropdownOpen, setKelasDropdownOpen] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);

  const kelasOptions = [
    "XTKJ1",
    "XTKJ2",
    "XITKJ1",
    "XITKJ2",
    "XIITKJ1",
    "XIITKJ2",
    "TPTUP",
  ];

  const rows = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    });
    return copy;
  }, [data]);

  async function confirmDelete({ id, kode, judul }) {
    const res = await Swal.fire({
      title: "Hapus tugas ini?",
      html: `
        <div class="text-left text-sm">
          <div><b>Kode:</b> ${kode || "-"}</div>
          <div><b>Judul:</b> ${judul || "-"}</div>
          <div class="mt-2 text-gray-600">Aksi ini tidak dapat dibatalkan.</div>
        </div>
      `,
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Ya, hapus",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      focusCancel: true,
      reverseButtons: true,
    });
    if (!res.isConfirmed) return;
    onDelete && onDelete(id);
  }

  async function openStatusModal(assignment) {
    setStatusActiveTab("belum");
    setStatusModalOpen(true);
    setStatusLoading(true);
    try {
      const res = await fetch(
        `/api/guru/assignments?detail=1&assignmentId=${assignment.id}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (!res.ok)
        throw new Error(json?.error || "Gagal memuat daftar status.");
      setStatusData({
        assignment: json.assignment ?? null,
        count: json.count ?? { belum: 0, terlambat: 0, selesai: 0 },
        belumList: Array.isArray(json.belumList) ? json.belumList : [],
        terlambatList: Array.isArray(json.terlambatList)
          ? json.terlambatList
          : [],
        selesaiList: Array.isArray(json.selesaiList) ? json.selesaiList : [],
      });
    } catch (e) {
      console.error(e);
      setStatusData({
        assignment: assignment,
        count: { belum: 0, terlambat: 0, selesai: 0 },
        belumList: [],
        terlambatList: [],
        selesaiList: [],
      });
      await Swal.fire({
        icon: "error",
        title: "Gagal",
        text: e.message || "Gagal memuat data.",
      });
    } finally {
      setStatusLoading(false);
    }
  }

  function closeStatusModal() {
    setStatusModalOpen(false);
    setStatusData({
      assignment: null,
      count: { belum: 0, terlambat: 0, selesai: 0 },
      belumList: [],
      terlambatList: [],
      selesaiList: [],
    });
  }

  // Fungsi untuk membuka modal broadcast
  function openBroadcastModal(assignment) {
    setSelectedAssignment(assignment);
    setBroadcastKelas(assignment.kelas || "");
    setBroadcastModalOpen(true);
  }

  function closeBroadcastModal() {
    setBroadcastModalOpen(false);
    setSelectedAssignment(null);
    setBroadcastKelas("");
    setKelasDropdownOpen(false);
  }

  // Filter kelas untuk dropdown
  const filteredKelas = kelasOptions.filter((k) =>
    k.toLowerCase().includes(broadcastKelas.toLowerCase())
  );

  function handleBroadcastKelasChange(e) {
    setBroadcastKelas(e.target.value);
    setKelasDropdownOpen(true);
  }

  function selectBroadcastKelas(kelasValue) {
    setBroadcastKelas(kelasValue);
    setKelasDropdownOpen(false);
  }

  // Fungsi broadcast dengan logika membuat tugas baru atau broadcast ulang
  async function handleBroadcastSubmit() {
    if (!selectedAssignment || !broadcastKelas.trim()) {
      await Swal.fire({
        icon: "warning",
        title: "Kelas Belum Dipilih",
        text: "Silakan pilih kelas terlebih dahulu",
      });
      return;
    }

    const normalizedKelas = broadcastKelas.toUpperCase().replace(/\s+/g, "");
    const originalKelas = (selectedAssignment.kelas || "")
      .toUpperCase()
      .replace(/\s+/g, "");

    setBroadcasting(true);

    try {
      // Cek apakah kelas berbeda
      if (normalizedKelas !== originalKelas) {
        // Buat tugas baru (salinan)
        const res = await Swal.fire({
          title: "Buat Tugas Baru?",
          html: `
            <div class="text-left text-sm">
              <p class="mb-2">Kelas yang dipilih berbeda dengan tugas asli.</p>
              <div><b>Tugas Asli:</b> ${selectedAssignment.kode} - ${originalKelas}</div>
              <div><b>Tugas Baru:</b> ${selectedAssignment.kode}-SALINAN - ${normalizedKelas}</div>
              <p class="mt-2 text-gray-600">Sistem akan membuat tugas baru dan broadcast ke kelas tersebut.</p>
            </div>
          `,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Ya, Buat & Broadcast",
          cancelButtonText: "Batal",
          confirmButtonColor: "#7c3aed",
          cancelButtonColor: "#6b7280",
          reverseButtons: true,
        });

        if (!res.isConfirmed) {
          setBroadcasting(false);
          return;
        }

        // Cari nomor increment untuk kode salinan
        const existingAssignments = data.filter((a) =>
          a.kode.startsWith(selectedAssignment.kode + "-SALINAN")
        );
        const incrementNumber = existingAssignments.length + 1;
        const newKode = `${selectedAssignment.kode}-SALINAN${incrementNumber}`;

        // Buat tugas baru via API
        const createRes = await fetch("/api/assignments/duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            originalId: selectedAssignment.id,
            newKode,
            newKelas: normalizedKelas,
          }),
        });

        if (!createRes.ok) {
          const errorData = await createRes.json();
          throw new Error(errorData.error || "Gagal membuat tugas baru");
        }

        const newAssignment = await createRes.json();

        // Broadcast tugas baru
        if (onBroadcast) {
          await onBroadcast({
            kode: newKode,
            kelas: normalizedKelas,
          });
        }

        await Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: `Tugas baru ${newKode} berhasil dibuat dan di-broadcast ke ${normalizedKelas}`,
        });

        closeBroadcastModal();
        window.location.reload();
      } else {
        // Broadcast ulang ke kelas yang sama
        const res = await Swal.fire({
          title: "Broadcast Ulang?",
          html: `
            <div class="text-left text-sm">
              <div><b>Kode:</b> ${selectedAssignment.kode}</div>
              <div><b>Kelas:</b> ${normalizedKelas}</div>
              <p class="mt-2 text-gray-600">Broadcast pesan ke kelas ini.</p>
            </div>
          `,
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "Ya, Broadcast",
          cancelButtonText: "Batal",
          confirmButtonColor: "#7c3aed",
          cancelButtonColor: "#6b7280",
          reverseButtons: true,
        });

        if (!res.isConfirmed) {
          setBroadcasting(false);
          return;
        }

        if (onBroadcast) {
          await onBroadcast({
            kode: selectedAssignment.kode,
            kelas: normalizedKelas,
          });
        }

        await Swal.fire({
          icon: "success",
          title: "Berhasil!",
          text: `Broadcast berhasil dikirim ke ${normalizedKelas}`,
        });

        closeBroadcastModal();
      }
    } catch (error) {
      console.error("Broadcast error:", error);
      await Swal.fire({
        icon: "error",
        title: "Gagal",
        text: error.message || "Terjadi kesalahan saat broadcast",
      });
    } finally {
      setBroadcasting(false);
    }
  }

  async function handleRekap({ kode, kelas }) {
    if (uiBusy) return;

    const res = await Swal.fire({
      title: "Buat Rekap Excel?",
      html: `
        <div class="text-left text-sm">
          <div><b>Kode:</b> ${kode}</div>
          <div><b>Kelas:</b> ${kelas}</div>
        </div>
      `,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, buat",
      cancelButtonText: "Batal",
      confirmButtonColor: "#059669",
      cancelButtonColor: "#6b7280",
      reverseButtons: true,
      focusCancel: true,
    });
    if (!res.isConfirmed) return;

    setUiBusy(true);

    // Toast loading di top-end (non-blocking)
    const loadingToast = Swal.fire({
      toast: true,
      position: "top-end",
      icon: "info",
      title: "Memproses rekap…",
      showConfirmButton: false,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      console.log("Starting fetch to /api/guru/rekap...");

      const resp = await fetch("/api/guru/rekap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode, kelas }),
      });

      console.log("Fetch response status:", resp.status);

      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        throw new Error(j?.error || "Gagal membuat rekap.");
      }

      const blob = await resp.blob();
      console.log("Blob size:", blob.size);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap_${kode}_${kelas}.xlsx`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      // Tutup loading toast
      loadingToast.close();

      // Success toast
      await Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title: "Rekap berhasil dibuat",
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
    } catch (e) {
      console.error("Rekap error:", e);

      // Tutup loading toast
      loadingToast.close();

      // Error alert
      await Swal.fire({
        icon: "error",
        title: "Gagal",
        text: e.message || "Gagal membuat rekap.",
      });
    } finally {
      setUiBusy(false);
    }
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                <th className="text-left p-3 w-10">No</th>
                <th className="text-left p-3">Kode</th>
                <th className="text-left p-3">Judul</th>
                <th className="text-left p-3">Kelas</th>
                <th className="text-left p-3">Deadline</th>
                <th className="text-left p-3">Status</th>
                <th className="text-left p-3">Lampiran</th>
                <th className="text-center p-3 w-20">Oto. Penilaian</th>
                <th className="text-left p-3 w-[320px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((a, i) => {
                const isOverdue =
                  a.deadline && new Date(a.deadline).getTime() < Date.now();
                const sum = a.statusSummary || {
                  belum: 0,
                  terlambat: 0,
                  selesai: 0,
                };

                const disableClass = uiBusy
                  ? "opacity-50 cursor-not-allowed"
                  : "";

                return (
                  <tr
                    key={a.id}
                    className={`hover:bg-gray-50 transition ${
                      isOverdue ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="p-3">{i + 1}</td>
                    <td className="p-3 font-medium">{a.kode}</td>
                    <td className="p-3">{a.judul}</td>
                    <td className="p-3">{a.kelas || "—"}</td>
                    <td className="p-3">
                      {a.deadline ? (
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {fmtWIB(a.deadline)}
                          </span>
                          <span className="text-[11px] text-gray-500">
                            {rel(a.deadline)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>

                    <td className="p-3">
                      <button
                        className={`inline-flex items-center gap-2 px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 transition ${disableClass}`}
                        onClick={() => !uiBusy && openStatusModal(a)}
                        title="Klik untuk melihat daftar siswa per status"
                        disabled={uiBusy}
                      >
                        <span>
                          Belum ({sum.belum}) • Terlambat ({sum.terlambat})
                        </span>
                      </button>
                    </td>

                    <td className="p-3">
                      {a.pdfUrl ? (
                        <a
                          href={uiBusy ? undefined : a.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`text-blue-600 hover:underline ${
                            uiBusy ? "pointer-events-none opacity-50" : ""
                          }`}
                          aria-disabled={uiBusy}
                          tabIndex={uiBusy ? -1 : 0}
                        >
                          📎 Lihat
                        </a>
                      ) : (
                        <span className="text-gray-400">Tidak ada</span>
                      )}
                    </td>

                    {/* Kolom Oto. Penilaian */}
                    <td className="p-3 text-center">
                      {a.kunciJawaban ? (
                        <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-green-100 animate-pulse">
                          <div className="w-4 h-4 rounded-full bg-green-500"></div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-lg">—</span>
                      )}
                    </td>

                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <button
                          className={`inline-flex items-center px-2 py-1 rounded bg-amber-500 text-white hover:bg-amber-600 text-xs ${disableClass}`}
                          onClick={() =>
                            !uiBusy && router.push(`/guru/nilai/${a.id}`)
                          }
                          title="Nilai tugas siswa"
                          disabled={uiBusy}
                        >
                          <FiEdit3 className="mr-1" />
                          Nilai
                        </button>

                        <button
                          className={`inline-flex items-center px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 text-xs ${disableClass}`}
                          onClick={() => !uiBusy && openBroadcastModal(a)}
                          title="Broadcast ke kelas"
                          disabled={uiBusy}
                        >
                          <FiShare2 className="mr-1" />
                          Broadcast
                        </button>

                        <button
                          className={`inline-flex items-center px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-xs ${disableClass}`}
                          onClick={() =>
                            !uiBusy &&
                            handleRekap({
                              kode: a.kode,
                              kelas: a.kelas || kelasOptions[0],
                            })
                          }
                          title="Download rekap Excel"
                          disabled={uiBusy}
                        >
                          <FiFileText className="mr-1" />
                          Rekap
                        </button>

                        <button
                          className={`inline-flex items-center px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-xs ${disableClass}`}
                          onClick={() =>
                            !uiBusy &&
                            confirmDelete({
                              id: a.id,
                              kode: a.kode,
                              judul: a.judul,
                            })
                          }
                          title="Hapus tugas"
                          disabled={uiBusy}
                        >
                          <FiTrash2 className="mr-1" />
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td className="p-4 text-center text-gray-500" colSpan={9}>
                    Belum ada tugas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {statusModalOpen && (
        <div className="fixed inset-0 z-[999] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-xl shadow-2xl">
            <div className="flex items-start justify-between p-4 border-b">
              <div>
                <h3 className="text-lg font-bold text-gray-800">
                  Status Pengumpulan — {statusData.assignment?.kode || "-"}{" "}
                  <span className="text-gray-500 font-normal">
                    ({statusData.assignment?.judul || "—"})
                  </span>
                </h3>
                <p className="text-sm text-gray-600">
                  Kelas:{" "}
                  <span className="font-medium">
                    {statusData.assignment?.kelas || "-"}
                  </span>{" "}
                  • Deadline:{" "}
                  {statusData.assignment?.deadline
                    ? fmtWIB(statusData.assignment.deadline)
                    : "—"}
                </p>
              </div>
              <button
                onClick={closeStatusModal}
                className="p-2 rounded hover:bg-gray-100 text-gray-600"
                title="Tutup"
              >
                <FiX />
              </button>
            </div>

            <div className="flex gap-2 p-3 border-b">
              <PillButton
                active={statusActiveTab === "belum"}
                onClick={() => setStatusActiveTab("belum")}
                title="Belum mengumpulkan"
                disabled={uiBusy}
              >
                Belum ({statusData.count?.belum ?? 0})
              </PillButton>
              <PillButton
                active={statusActiveTab === "terlambat"}
                onClick={() => setStatusActiveTab("terlambat")}
                title="Mengumpulkan setelah deadline"
                disabled={uiBusy}
              >
                Terlambat ({statusData.count?.terlambat ?? 0})
              </PillButton>
              <PillButton
                active={statusActiveTab === "selesai"}
                onClick={() => setStatusActiveTab("selesai")}
                title="Selesai tepat waktu"
                disabled={uiBusy}
              >
                Selesai ({statusData.count?.selesai ?? 0})
              </PillButton>
            </div>

            <div className="p-4">
              {statusLoading ? (
                <div className="h-40 rounded-lg bg-gray-100 animate-pulse" />
              ) : (
                <div className="max-h-[55vh] overflow-auto border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-gray-700">
                        <th className="text-left p-2 w-12">No</th>
                        <th className="text-left p-2">Nama</th>
                        <th className="text-left p-2">Kelas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(() => {
                        const list =
                          statusActiveTab === "belum"
                            ? statusData.belumList
                            : statusActiveTab === "terlambat"
                            ? statusData.terlambatList
                            : statusData.selesaiList;
                        if (!list || list.length === 0) {
                          return (
                            <tr>
                              <td
                                className="p-3 text-center text-gray-500"
                                colSpan={3}
                              >
                                Tidak ada data.
                              </td>
                            </tr>
                          );
                        }
                        return list.map((r) => (
                          <tr key={r.siswaId}>
                            <td className="p-2">{r.no}</td>
                            <td className="p-2">{r.nama}</td>
                            <td className="p-2">{r.kelas}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="p-3 border-t text-right">
              <button
                onClick={closeStatusModal}
                className="inline-flex items-center px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Broadcast */}
      {broadcastModalOpen && (
        <div className="fixed inset-0 z-[999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 ">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-purple-600 text-white p-6 rounded-t-xl">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FiShare2 />
                Broadcast Tugas
              </h2>
              <p className="text-violet-100 text-sm mt-1">
                {selectedAssignment?.kode} - {selectedAssignment?.judul}
              </p>
            </div>

            {/* Content */}
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-3">
                  <strong>Kelas Asli:</strong>{" "}
                  {selectedAssignment?.kelas || "-"}
                </p>
              </div>

              {/* Dropdown Kelas Searchable */}
              <div className="relative mb-6">
                <label className="block font-semibold mb-2 text-gray-700">
                  Pilih Kelas Tujuan <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 transition-all"
                  placeholder="Ketik atau pilih kelas..."
                  value={broadcastKelas}
                  onChange={handleBroadcastKelasChange}
                  onFocus={() => setKelasDropdownOpen(true)}
                  onBlur={() =>
                    setTimeout(() => setKelasDropdownOpen(false), 200)
                  }
                  autoComplete="off"
                />

                {/* Dropdown Options */}
                {kelasDropdownOpen && filteredKelas.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredKelas.map((kelasOption) => (
                      <button
                        key={kelasOption}
                        type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-violet-50 transition-colors border-b border-gray-100 last:border-0"
                        onClick={() => selectBroadcastKelas(kelasOption)}
                      >
                        {kelasOption}
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500 mt-2">
                  💡 Ketik untuk mencari atau pilih dari dropdown
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-xs text-blue-800">
                  <strong>ℹ️ Catatan:</strong>
                  <br />• Jika kelas sama: Broadcast ulang ke kelas yang sama
                  <br />• Jika kelas berbeda: Buat tugas baru (salinan) &
                  broadcast
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 border-t flex gap-3 justify-end rounded-b-xl">
              <button
                type="button"
                onClick={closeBroadcastModal}
                className="px-4 py-2 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-all"
                disabled={broadcasting}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleBroadcastSubmit}
                className="px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-semibold rounded-lg hover:from-violet-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 shadow-lg transition-all flex items-center gap-2"
                disabled={broadcasting || !broadcastKelas.trim()}
              >
                {broadcasting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <FiShare2 />
                    <span>Broadcast</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
