"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { FiPlus, FiRefreshCw, FiLogOut } from "react-icons/fi";
import GuruAssignmentsTable from "./partials/AssignmentsTable";
import AssignmentFormModal from "./partials/AssignmentFormModal";
import HotsFormModal from "./partials/HotsFormModal";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";
import KinantiBanner from "../components/KinantiBanner";

async function fetchServerSession() {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

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

function toastSuccess(title = "Berhasil", text = "") {
  return Swal.fire({
    icon: "success",
    title,
    text,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2000,
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

  const [items, setItems] = useState([]);
  const [loadingAssign, setLoadingAssign] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [showHots, setShowHots] = useState(false);
  const [q, setQ] = useState("");
  const [broadcasting, setBroadcasting] = useState(false);

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
      return;
    }
    fetchAssignments();
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

  async function handleLogout() {
    const confirm = await Swal.fire({
      title: "Keluar dari Dashboard?",
      text: "Anda akan keluar dari akun guru.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, Keluar",
      cancelButtonText: "Batal",
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      reverseButtons: true,
    });

    if (!confirm.isConfirmed) return;

    try {
      localStorage.removeItem("guruId");
      localStorage.removeItem("user");
    } catch {}
    signOut({ callbackUrl: "/login" });
  }

  // =============================
  // 🔥 Broadcast lewat tabel
  // =============================
  async function onBroadcast(kode, kelas) {
    if (!kode || !kelas) {
      await toastError("Masukkan kode dan kelas.");
      return false;
    }

    const confirm = await Swal.fire({
      title: "Kirim Broadcast?",
      text: `Tugas ${kode} akan dikirim ke seluruh siswa kelas ${kelas}.`,
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Ya, kirim",
      cancelButtonText: "Batal",
      confirmButtonColor: "#7e22ce",
      cancelButtonColor: "#6b7280",
    });
    if (!confirm.isConfirmed) return false;

    try {
      setBroadcasting(true);

      Swal.fire({
        title: "Sedang memproses broadcast...",
        toast: true,
        position: "top-end",
        icon: "info",
        showConfirmButton: false,
        timerProgressBar: true,
        didOpen: () => Swal.showLoading(),
      });

      const res = await fetch("/api/guru/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kode, kelas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Broadcast gagal.");

      await notifySuccess(
        "Broadcast dikirim!",
        `Pesan berhasil dikirim ke ${data.detail?.sent ?? "beberapa"} siswa.`,
      );
      return true;
    } catch (e) {
      console.error(e);
      await toastError(e.message);
      return false;
    } finally {
      setBroadcasting(false);
    }
  }

  // =============================
  // 🗑️ Hapus tugas (dipanggil dari tabel)
  // =============================
  async function onDeleteAssignment(id) {
    try {
      const res = await fetch(`/api/guru/assignments?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        await toastError(data?.error || "Gagal menghapus tugas.");
        return;
      }
      await toastSuccess("Tugas dihapus.", data?.message || "");
      fetchAssignments(); // refresh tabel
    } catch (e) {
      console.error(e);
      await toastError("Gagal menghapus tugas.");
    }
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-amber-50 to-rose-100 p-4 md:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-lg p-4 md:p-6">
        <KinantiBanner />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
              {`Hai ${session?.user?.name || "Guru"} 👋`}
            </h1>
            <p className="text-gray-600">
              Kelola penugasan, broadcast, rekap, dan penilaian kelas.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                fetchAssignments();
              }}
              className="inline-flex items-center px-3 py-2 rounded-md border bg-white hover:bg-gray-50 disabled:opacity-50"
              title="Refresh"
              disabled={!guruId || broadcasting}
            >
              <FiRefreshCw className="mr-2" />
              Refresh
            </button>

            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-3 py-2 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              disabled={!guruId || broadcasting}
            >
              <FiPlus className="mr-2" />
              Buat Tugas
            </button>

            <button
              onClick={() => setShowHots(true)}
              className="inline-flex items-center px-3 py-2 rounded-md bg-indigo-700 text-white hover:bg-indigo-800 disabled:opacity-50"
              disabled={!guruId || broadcasting}
            >
              <span className="mr-2">🧠</span>
              Buat HOTS
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center px-3 py-2 rounded-md bg-gray-800 text-white hover:bg-black disabled:opacity-50"
              title="Keluar"
              disabled={broadcasting}
            >
              <FiLogOut className="mr-2" />
              Keluar
            </button>
          </div>
        </div>

        {/* Input pencarian */}
        <div className="mt-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari kode, judul, kelas, status…"
            className="w-full md:w-1/2 rounded-lg border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        {/* Tabel Penugasan */}
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
              onDelete={(id) => onDeleteAssignment(id)}
            />
          )}
        </div>
      </div>

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

      {showHots && <HotsFormModal onClose={() => setShowHots(false)} />}
    </motion.div>
  );
}
