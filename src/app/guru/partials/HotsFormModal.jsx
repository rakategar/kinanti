"use client";

import { useState } from "react";
import Swal from "sweetalert2";
import {
  generateHotsPdf,
  generateHotsSoalPdf,
  generateHotsKunciPdf,
} from "../../../utils/hotsPdf";

function toast(icon, title) {
  return Swal.fire({
    icon,
    title,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true,
  });
}

export default function HotsFormModal({ onClose }) {
  const [form, setForm] = useState({
    mataPelajaran: "",
    judulSoal: "",
    deskripsi: "",
    jenisSoal: "Pilihan Ganda",
    jumlahSoal: 5,
  });
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const setField = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function validate() {
    if (
      !form.mataPelajaran.trim() ||
      !form.judulSoal.trim() ||
      !form.deskripsi.trim() ||
      !form.jenisSoal
    ) {
      return "Semua field wajib diisi.";
    }
    const n = Number(form.jumlahSoal);
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      return "Jumlah soal harus angka 1 sampai 20.";
    }
    return "";
  }

  async function handleGenerate(e) {
    e.preventDefault();
    setError("");

    const msg = validate();
    if (msg) {
      toast("warning", msg);
      setError(msg);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/guru/generate-hots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mataPelajaran: form.mataPelajaran.trim(),
          judulSoal: form.judulSoal.trim(),
          deskripsi: form.deskripsi.trim(),
          jenisSoal: form.jenisSoal,
          jumlahSoal: Number(form.jumlahSoal),
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        const m = json?.error || "Gagal membuat soal HOTS.";
        setError(m);
        toast("error", m);
        return; // jangan tutup modal
      }

      setResult(json.data);
      // Generate + download 2 PDF otomatis: soal & kunci jawaban.
      // (async: menunggu font Unicode ter-load agar rumus & kode ter-render benar)
      try {
        await generateHotsPdf(json.data, form);
        toast("success", "Soal HOTS berhasil dibuat & diunduh (2 file).");
      } catch (pdfErr) {
        const m = "Soal berhasil dibuat, tetapi gagal membuat PDF. Coba unduh ulang.";
        setError(m);
        toast("error", m);
      }
    } catch (err) {
      const m = "Terjadi kesalahan jaringan. Coba lagi.";
      setError(m);
      toast("error", m);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadSoal() {
    if (!result || downloading) return;
    setDownloading(true);
    try {
      await generateHotsSoalPdf(result, form);
    } catch (e) {
      toast("error", "Gagal membuat PDF Soal. Coba lagi.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleDownloadKunci() {
    if (!result || downloading) return;
    setDownloading(true);
    try {
      await generateHotsKunciPdf(result, form);
    } catch (e) {
      toast("error", "Gagal membuat PDF Kunci Jawaban. Coba lagi.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span>🧠</span>
            <span>Buat Soal HOTS</span>
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-white/80 hover:text-white text-2xl leading-none disabled:opacity-50"
            title="Tutup"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <form
          onSubmit={handleGenerate}
          className="px-6 py-5 overflow-y-auto flex-1"
        >
          <p className="text-sm text-gray-600 mb-5">
            Soal dibuat otomatis berbasis taksonomi Bloom (C4 Analisis, C5
            Evaluasi, C6 Kreasi) lalu diunduh sebagai PDF. Rumus matematika &
            potongan kode dirender rapi di dalam PDF.
          </p>

          {/* Mata Pelajaran */}
          <div className="mb-5">
            <label className="block font-semibold mb-2 text-gray-700">
              Mata Pelajaran <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.mataPelajaran}
              onChange={setField("mataPelajaran")}
              placeholder="Contoh: Matematika, IPA, Sejarah"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              disabled={loading}
            />
          </div>

          {/* Judul Soal */}
          <div className="mb-5">
            <label className="block font-semibold mb-2 text-gray-700">
              Judul Soal <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.judulSoal}
              onChange={setField("judulSoal")}
              placeholder="Contoh: Ulangan Harian Bab 3"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              disabled={loading}
            />
          </div>

          {/* Deskripsi / Konteks */}
          <div className="mb-5">
            <label className="block font-semibold mb-2 text-gray-700">
              Deskripsi / Konteks Soal <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={form.deskripsi}
              onChange={setField("deskripsi")}
              placeholder="Topik / materi yang diujikan, mis: Trigonometri segitiga siku-siku"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              disabled={loading}
            />
          </div>

          {/* Jenis & Jumlah */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
            <div>
              <label className="block font-semibold mb-2 text-gray-700">
                Jenis Soal <span className="text-red-500">*</span>
              </label>
              <select
                value={form.jenisSoal}
                onChange={setField("jenisSoal")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all bg-white"
                disabled={loading}
              >
                <option value="Pilihan Ganda">Pilihan Ganda</option>
                <option value="Uraian">Uraian</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-2 text-gray-700">
                Jumlah Soal <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={20}
                value={form.jumlahSoal}
                onChange={setField("jumlahSoal")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                disabled={loading}
              />
            </div>
          </div>

          {/* Error inline */}
          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              ⚠ {error}
            </div>
          )}

          {/* Sukses + download ulang (2 file terpisah) */}
          {result && !loading && (
            <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <p className="mb-2">✅ Soal berhasil dibuat. 2 file PDF diunduh: Soal & Kunci Jawaban.</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadSoal}
                  disabled={downloading}
                  className="inline-flex items-center px-3 py-1.5 rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60 text-sm whitespace-nowrap"
                >
                  {downloading ? "⏳ Menyiapkan..." : "⬇ Download PDF Soal"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadKunci}
                  disabled={downloading}
                  className="inline-flex items-center px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 text-sm whitespace-nowrap"
                >
                  {downloading ? "⏳ Menyiapkan..." : "⬇ Download PDF Kunci Jawaban"}
                </button>
              </div>
            </div>
          )}

          {/* Generate */}
          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-lg hover:from-indigo-700 hover:to-indigo-800 disabled:from-gray-400 disabled:to-gray-500 shadow-lg hover:shadow-xl transition-all"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Sedang membuat soal HOTS...</span>
              </>
            ) : (
              <span>Generate Soal</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t flex justify-end">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-all"
          >
            Batal
          </button>
        </div>
      </div>
    </div>
  );
}
