"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { FiPlus, FiRefreshCw, FiLogOut } from "react-icons/fi";
import GuruAssignmentsTable from "./partials/AssignmentsTable";
import AssignmentFormModal from "./partials/AssignmentFormModal";
import AssessmentsTable from "./partials/AssessmentsTable";
import AssessmentFormModal from "./partials/AssessmentFormModal";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

async function fetchServerSession() {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// SweetAlert2 helpers
function toastError(message = "Terjadi kesalahan.") {
  return Swal.fire({
    icon: "error",
    title: "Gagal",
    text: message,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });
}

function notifySuccess(title = "Berhasil", text = "") {
  return Swal.fire({
    icon: "success",
    title,
    text,
    confirmButtonText: "OK",
    allowOutsideClick: false,
    allowEscapeKey: true,
  });
}

async function confirmDialog({
  title = "Yakin?",
  text = "Aksi ini tidak dapat dibatalkan.",
  confirmText = "Ya, lanjutkan",
  cancelText = "Batal",
  icon = "question",
}) {
  const res = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    focusCancel: true,
    reverseButtons: true,
    allowOutsideClick: false,
  });
  return res.isConfirmed;
}

export default function GuruDashboard() {
  const { data: session, status } = useSession();

  const [guruId, setGuruId] = useState(null);

  // assignments
  const [items, setItems] = useState([]);
  const [loadingAssign, setLoadingAssign] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // assessments (penilaian)
  const [assessments, setAssessments] = useState([]);
  const [loadingAssess, setLoadingAssess] = useState(true);
  const [showAssessmentForm, setShowAssessmentForm] = useState(false);

  const [q, setQ] = useState("");

  // Resolve guruId
  useEffect(() => {
    (async () => {
      if (status === "loading") return;
      if (status === "unauthenticated") {
        window.location.replace("/login");
        return;
      }

      const idFromHook = session?.user?.id ? Number(session.user.id) : null;
      if (idFromHook) {
        setGuruId(idFromHook);
        return;
      }

      const s = await fetchServerSession();
      const idFromApi = s?.user?.id ? Number(s.user.id) : null;
      if (idFromApi) {
        setGuruId(idFromApi);
        try {
          localStorage.setItem("user", JSON.stringify(s.user));
          if ((s.user.role || "").toLowerCase() === "guru") {
            localStorage.setItem("guruId", String(idFromApi));
          }
        } catch {}
        return;
      }

      try {
        const gid = localStorage.getItem("guruId");
        if (gid) {
          setGuruId(Number(gid));
          return;
        }
        const rawUser = localStorage.getItem("user");
        if (rawUser) {
          const u = JSON.parse(rawUser);
          if (u?.id) {
            setGuruId(Number(u.id));
            return;
          }
        }
      } catch {}

      setGuruId(null);
    })();
  }, [status, session]);

  useEffect(() => {
    if (!guruId) {
      setLoadingAssign(false);
      setLoadingAssess(false);
      return;
    }
    fetchAssignments();
    fetchAssessments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guruId]);

  async function fetchAssignments() {
    try {
      setLoadingAssign(true);
      const res = await fetch(`/api/guru/assignments?guruId=${guruId}`);
      if (!res.ok) {
        setItems([]);
        await toastError("Gagal memuat data tugas.");
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setItems([]);
      await toastError("Gagal terhubung ke server (tugas).");
    } finally {
      setLoadingAssign(false);
    }
  }

  async function fetchAssessments() {
    try {
      setLoadingAssess(true);
      const res = await fetch(`/api/guru/assessments?guruId=${guruId}`);
      if (!res.ok) {
        setAssessments([]);
        await toastError("Gagal memuat data penilaian.");
        return;
      }
      const data = await res.json();
      // dukung format {ok, data} atau array langsung
      const list = Array.isArray(data) ? data : data?.data ?? [];
      setAssessments(list);
    } catch (e) {
      console.error(e);
      setAssessments([]);
      await toastError("Gagal terhubung ke server (penilaian).");
    } finally {
      setLoadingAssess(false);
    }
  }

  const filteredAssignments = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter((a) => {
      const kode = (a.kode || "").toLowerCase();
      const judul = (a.judul || "").toLowerCase();
      const kelas = (a.kelas || "").toLowerCase();
      const statusRingkas = (a.statusRingkas || "").toLowerCase();
      return (
        kode.includes(s) ||
        judul.includes(s) ||
        kelas.includes(s) ||
        statusRingkas.includes(s)
      );
    });
  }, [q, items]);

  const filteredAssessments = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return assessments;
    return assessments.filter((a) => {
      const kode = (a.kode || a.code || "").toLowerCase();
      const judul = (a.judul || a.title || "").toLowerCase();
      const kelas = (a.kelas || a.className || "").toLowerCase();
      const status = (a.status || "").toLowerCase();
      return (
        kode.includes(s) ||
        judul.includes(s) ||
        kelas.includes(s) ||
        status.includes(s)
      );
    });
  }, [q, assessments]);

  function handleLogout() {
    try {
      localStorage.removeItem("guruId");
      localStorage.removeItem("user");
    } catch {}
    signOut({ callbackUrl: "/login" });
  }

  // ASSIGNMENTS actions (sudah ada)
  async function onDeleteAssignment(id) {
    if (!id) return;
    const yakin = await confirmDialog({
      title: "Hapus tugas ini?",
      text: "Aksi tidak dapat dibatalkan.",
      confirmText: "Ya, hapus",
      icon: "warning",
    });
    if (!yakin) return;

    try {
      const res = await fetch(`/api/guru/assignments?id=${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await toastError(data.error || "Gagal menghapus tugas.");
        return;
      }
      await fetchAssignments();
      await notifySuccess("Tugas berhasil dihapus.");
    } catch (e) {
      console.error(e);
      await toastError("Gagal menghapus tugas.");
    }
  }

  async function onBroadcast(kode, kelas) {
    if (!kode || !kelas) {
      await toastError("Masukkan kode dan kelas.");
      return false;
    }
    try {
      const res = await fetch("/api/guru/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode, kelas }),
      });
      const data = await res.json();
      if (!res.ok) {
        await toastError(data.error || "Broadcast gagal.");
        return false;
      }
      await notifySuccess("Broadcast dikirim.", data.message || "");
      return true;
    } catch (e) {
      console.error(e);
      await toastError("Broadcast gagal terkirim.");
      return false;
    }
  }

  async function onRekapAssignment(kode, kelas) {
    try {
      const res = await fetch("/api/guru/rekap", {
        method: "POST",
        body: JSON.stringify({ kode, kelas }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await toastError(data.error || "Gagal membuat rekap.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap_${kode}_${kelas}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);

      await notifySuccess("Rekap siap diunduh.", "File Excel telah diunduh.");
    } catch (e) {
      console.error(e);
      await toastError("Gagal mengunduh rekap.");
    }
  }

  // ASSESSMENTS actions (baru)
  async function onDeleteAssessment(id) {
    const yakin = await confirmDialog({
      title: "Hapus penilaian ini?",
      text: "Aksi tidak dapat dibatalkan.",
      confirmText: "Ya, hapus",
      icon: "warning",
    });
    if (!yakin) return;

    try {
      const res = await fetch(`/api/guru/assessments?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        await toastError(
          data?.error || data?.message || "Gagal menghapus penilaian."
        );
        return;
      }
      await notifySuccess("Penilaian dihapus.");
      fetchAssessments();
    } catch (e) {
      console.error(e);
      await toastError("Gagal menghapus penilaian.");
    }
  }

  async function onRekapAssessment(kode, kelas) {
    try {
      const res = await fetch("/api/guru/penilaian/rekap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode, kelas }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        await toastError(data.error || "Gagal membuat rekap penilaian.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap_penilaian_${kode}_${kelas}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      await notifySuccess("Rekap siap diunduh.");
    } catch (e) {
      console.error(e);
      await toastError("Gagal mengunduh rekap penilaian.");
    }
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-amber-50 to-rose-100 p-4 md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-4 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
              Dashboard Guru
            </h1>
            <p className="text-gray-600">
              Kelola penugasan, broadcast, rekap, dan penilaian kelas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchAssignments();
                fetchAssessments();
              }}
              className="inline-flex items-center px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
              title="Refresh"
              disabled={!guruId}
            >
              <FiRefreshCw className="mr-2" />
              Refresh
            </button>

            {/* Buat Tugas */}
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-3 py-2 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              disabled={!guruId}
            >
              <FiPlus className="mr-2" />
              Buat Tugas
            </button>

            {/* Buat Penilaian */}
            <button
              onClick={() => setShowAssessmentForm(true)}
              className="inline-flex items-center px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
              disabled={!guruId}
            >
              <FiPlus className="mr-2" />
              Buat Penilaian
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center px-3 py-2 rounded-md bg-gray-800 text-white hover:bg-black"
              title="Keluar"
            >
              <FiLogOut className="mr-2" />
              Keluar
            </button>
          </div>
        </div>

        {!guruId && status !== "loading" && (
          <div className="mt-4 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-sm">
            Tidak ditemukan <b>guruId</b> dari session. Silakan login kembali.
          </div>
        )}

        <div className="mt-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kode, judul, kelas, status…"
            className="w-full md:w-1/2 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        {/* TABEL PENUGASAN */}
        <div className="mt-4">
          {loadingAssign ? (
            <div className="animate-pulse h-56 bg-gray-200 rounded" />
          ) : (
            <GuruAssignmentsTable
              data={filteredAssignments}
              onBroadcast={async ({ kode, kelas }) => {
                const ok = await onBroadcast(kode, kelas);
                if (ok) fetchAssignments();
              }}
              onRekap={onRekapAssignment}
              onDelete={onDeleteAssignment}
            />
          )}
        </div>

        {/* TABEL PENILAIAN */}
        <div className="mt-6">
          {loadingAssess ? (
            <div className="animate-pulse h-56 bg-gray-200 rounded" />
          ) : (
            <AssessmentsTable
              data={filteredAssessments}
              onRekap={({ kode, kelas }) => onRekapAssessment(kode, kelas)}
              onDelete={(id) => onDeleteAssessment(id)}
            />
          )}
        </div>
      </div>

      {/* MODAL FORM */}
      {showForm && (
        <AssignmentFormModal
          guruId={guruId}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            fetchAssignments();
          }}
        />
      )}

      {showAssessmentForm && (
        <AssessmentFormModal
          guruId={guruId}
          onClose={() => setShowAssessmentForm(false)}
          onCreated={(newId) => {
            setShowAssessmentForm(false);
            fetchAssessments();
            // opsional: langsung arahkan ke halaman soal
            // router.push(`/guru/penilaian/${newId}/soal`);
          }}
        />
      )}
    </motion.div>
  );
}
