"use client";

import { useState } from "react";

export default function AssignmentFormModal({ guruId, onClose, onCreated }) {
  const [kode, setKode] = useState("");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [kelas, setKelas] = useState("");
  const [deadlineHari, setDeadlineHari] = useState(""); // N hari dari sekarang
  const [lampirPdf, setLampirPdf] = useState(false);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!guruId) {
      alert("Guru tidak dikenali.");
      return;
    }
    if (!kode || !judul || !kelas) {
      alert("Kode, Judul, dan Kelas wajib diisi.");
      return;
    }
    if (lampirPdf && !file) {
      alert("Kamu memilih melampirkan PDF, pilih file-nya.");
      return;
    }

    setSaving(true);
    try {
      const form = new FormData();
      form.append("guruId", String(guruId));
      form.append("kode", kode.toUpperCase());
      form.append("judul", judul);
      form.append("deskripsi", deskripsi);
      form.append("kelas", kelas.toUpperCase().replace(/\s+/g, ""));
      form.append("deadlineHari", String(deadlineHari || ""));
      form.append("lampirPdf", lampirPdf ? "ya" : "tidak");
      if (file) form.append("file", file);

      const res = await fetch("/api/guru/create-assignment", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Gagal membuat tugas.");
        return;
      }
      alert(data.message || "Tugas berhasil dibuat.");
      onCreated?.();
    } catch (e) {
      console.error("create err:", e);
      alert("Gagal membuat tugas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Buat Tugas</h2>
          <button
            className="text-gray-500 hover:text-gray-700"
            onClick={onClose}
            disabled={saving}
          >
            ✕
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kode</label>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="MTK-101"
              value={kode}
              onChange={(e) => setKode(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Kelas</label>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="XITKJ2"
              value={kelas}
              onChange={(e) =>
                setKelas(e.target.value.toUpperCase().replace(/\s+/g, ""))
              }
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Judul</label>
            <input
              className="w-full rounded border px-3 py-2"
              placeholder="Tugas Bab 3 Persamaan Kuadrat"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Deskripsi</label>
            <textarea
              className="w-full rounded border px-3 py-2 min-h-[100px]"
              placeholder="Instruksi untuk siswa…"
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Deadline (hari)
            </label>
            <input
              type="number"
              min="0"
              className="w-full rounded border px-3 py-2"
              placeholder="3 (opsional)"
              value={deadlineHari}
              onChange={(e) => setDeadlineHari(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Kosongkan jika tanpa deadline.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Lampirkan PDF Guru?
            </label>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={lampirPdf}
                onChange={(e) => setLampirPdf(e.target.checked)}
              />
              <span className="text-sm">Ya, lampirkan file PDF</span>
            </div>
            {lampirPdf && (
              <div className="mt-2">
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <p className="text-xs text-gray-500 mt-1">Maks ~10MB.</p>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            className="px-4 py-2 rounded-md bg-gray-200 hover:bg-gray-300"
            onClick={onClose}
            disabled={saving}
          >
            Batal
          </button>
          <button
            className="px-4 py-2 rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}
