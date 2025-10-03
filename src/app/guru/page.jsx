"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { motion } from "framer-motion";
import { FiPlus, FiRefreshCw, FiLogOut } from "react-icons/fi";
import GuruAssignmentsTable from "./partials/AssignmentsTable";
import AssignmentFormModal from "./partials/AssignmentFormModal";

async function fetchServerSession() {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default function GuruDashboard() {
  const { data: session, status } = useSession();

  const [guruId, setGuruId] = useState(null);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Cari guruId dari beberapa sumber: useSession -> /api/auth/session -> localStorage
  useEffect(() => {
    (async () => {
      if (status === "loading") return;
      if (status === "unauthenticated") {
        window.location.replace("/login");
        return;
      }

      // 1) dari useSession()
      const idFromHook = session?.user?.id ? Number(session.user.id) : null;
      if (idFromHook) {
        setGuruId(idFromHook);
        return;
      }

      // 2) dari /api/auth/session (server)
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

      // 3) fallback terakhir: localStorage
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

      // jika semua gagal:
      setGuruId(null);
    })();
  }, [status, session]);

  useEffect(() => {
    if (!guruId) {
      setLoading(false);
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guruId]);

  async function fetchData() {
    try {
      setLoading(true);
      if (!guruId) return;
      const res = await fetch(`/api/guru/assignments?guruId=${guruId}`);
      if (!res.ok) {
        console.error("Load assignments failed:", res.status);
        setItems([]);
        return;
      }
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
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

  function handleLogout() {
    try {
      localStorage.removeItem("guruId");
      localStorage.removeItem("user");
    } catch {}
    signOut({ callbackUrl: "/login" });
  }

  async function onDeleteAssignment(id) {
    if (!id) return;
    const yakin = confirm("Hapus tugas ini? Aksi tidak dapat dibatalkan.");
    if (!yakin) return;
    try {
      const res = await fetch(`/api/guru/assignments?id=${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Gagal menghapus tugas.");
        return;
      }
      await fetchData();
      alert("Tugas berhasil dihapus.");
    } catch (e) {
      console.error(e);
      alert("Gagal menghapus tugas.");
    }
  }

  async function onBroadcast(kode, kelas) {
    if (!kode || !kelas) {
      alert("Masukkan kode dan kelas.");
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
        alert(data.error || "Broadcast gagal.");
        return false;
      }
      alert(data.message || "Broadcast diproses.");
      return true;
    } catch (e) {
      console.error(e);
      alert("Broadcast gagal terkirim.");
      return false;
    }
  }

  async function onRekap(kode, kelas) {
    try {
      const res = await fetch("/api/guru/rekap", {
        method: "POST",
        body: JSON.stringify({ kode, kelas }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Gagal membuat rekap.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rekap_${kode}_${kelas}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("Gagal mengunduh rekap.");
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
              Kelola penugasan, broadcast, dan rekap kelas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchData()}
              className="inline-flex items-center px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
              title="Refresh"
              disabled={!guruId}
            >
              <FiRefreshCw className="mr-2" />
              Refresh
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-3 py-2 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              disabled={!guruId}
            >
              <FiPlus className="mr-2" />
              Buat Tugas
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

        <div className="mt-4">
          {loading ? (
            <div className="animate-pulse h-64 bg-gray-200 rounded" />
          ) : (
            <GuruAssignmentsTable
              data={filtered}
              onBroadcast={async ({ kode, kelas }) => {
                const ok = await onBroadcast(kode, kelas);
                if (ok) fetchData();
              }}
              onRekap={async ({ kode, kelas }) => {
                await onRekap(kode, kelas);
              }}
              onDelete={onDeleteAssignment}
            />
          )}
        </div>
      </div>

      {showForm && (
        <AssignmentFormModal
          guruId={guruId}
          onClose={() => setShowForm(false)}
          onCreated={fetchData}
        />
      )}
    </motion.div>
  );
}
