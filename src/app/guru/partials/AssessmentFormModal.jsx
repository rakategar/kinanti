"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DEBOUNCE = 400;

// Hardcode daftar kelas (ubah sesuai kebutuhan)
const HARDCODED_KELAS = [
  "X RPL 1",
  "X RPL 2",
  "X TKJ 1",
  "X TKJ 2",
  "XI RPL 1",
  "XI RPL 2",
  "XI TKJ 1",
  "XI TKJ 2",
  "XII RPL 1",
  "XII RPL 2",
  "XII TKJ 1",
  "XII TKJ 2",
];

export default function AssessmentFormModal({ guruId, onClose }) {
  const router = useRouter();

  const [kode, setKode] = useState("");
  const [judul, setJudul] = useState("");
  const [kelas, setKelas] = useState("");
  const [deadline, setDeadline] = useState(""); // datetime-local (opsional)

  const [checking, setChecking] = useState(false);
  const [exists, setExists] = useState(null); // null=belum cek, true=sudah ada, false=unik
  const timer = useRef(null);

  // Kelas dipakai langsung (hardcoded)
  const [kelasEnum] = useState(HARDCODED_KELAS);

  // Cek unik KODE (debounced)
  useEffect(() => {
    if (!kode) {
      setExists(null);
      return;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setChecking(true);
        const r = await fetch(
          `/api/guru/assessments/check-code?code=${encodeURIComponent(
            kode.toUpperCase()
          )}`
        );
        const d = await r.json();
        setExists(d?.exists === true);
      } catch {
        setExists(null);
      } finally {
        setChecking(false);
      }
    }, DEBOUNCE);
    return () => clearTimeout(timer.current);
  }, [kode]);

  const canProceed = useMemo(() => {
    return Boolean(guruId && kode && judul && kelas && exists === false);
  }, [guruId, kode, judul, kelas, exists]);

  function goNext() {
    if (!canProceed) {
      alert("Lengkapi data & pastikan Kode unik.");
      return;
    }
    // kirim meta via query; simpan ke DB nanti saat klik “Selesai” di /buatsoal
    const kelasParam = kelas; // atau: kelas.toUpperCase().replace(/\s+/g, "")
    const q = new URLSearchParams({
      title: judul,
      kelas: kelasParam,
      guruId: String(guruId || ""),
      deadline: deadline ? new Date(deadline).toISOString() : "",
    }).toString();

    router.push(`/buatsoal/${encodeURIComponent(kode.toUpperCase())}?${q}`);
  }

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Buat Penilaian</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          {/* KODE */}
          <div>
            <label className="block text-sm font-medium mb-1">Kode</label>
            <div className="relative">
              <input
                className={`w-full rounded border px-3 py-2 pr-10 ${
                  exists === true
                    ? "border-red-400"
                    : exists === false
                    ? "border-emerald-400"
                    : ""
                }`}
                placeholder="RPL-QUIZ-01"
                value={kode}
                onChange={(e) =>
                  setKode(e.target.value.toUpperCase().replace(/\s+/g, ""))
                }
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs">
                {checking
                  ? "cek..."
                  : exists === true
                  ? "sudah ada"
                  : exists === false
                  ? "unik"
                  : ""}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Kode harus <b>unik</b>. Contoh: <code>RPL-QUIZ-01</code>
            </p>
          </div>

          {/* KELAS (hardcoded) */}
          <div>
            <label className="block text-sm font-medium mb-1">Kelas</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
            >
              <option value="">— pilih kelas —</option>
              {kelasEnum.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Daftar kelas hardcoded.
            </p>
          </div>

          {/* JUDUL */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Judul</label>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="Ulangan Harian Bab 3"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
            />
          </div>

          {/* DEADLINE (opsional) */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">
              Deadline (opsional)
            </label>
            <input
              type="datetime-local"
              className="w-full md:w-1/2 rounded border px-3 py-2"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Jika diisi, siswa tidak dapat mengerjakan setelah waktu ini.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
            onClick={onClose}
          >
            Batal
          </button>
          <button
            className="px-4 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            onClick={goNext}
            disabled={!canProceed}
            title="Lanjut ke pembuat soal (belum menyimpan ke database)"
          >
            Lanjut Buat Soal
          </button>
        </div>
      </div>
    </div>
  );
}
