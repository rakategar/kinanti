"use client";
import { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { SiGooglegemini } from "react-icons/si";
import {
  KELAS_OPTIONS,
  isValidKelas,
  normalizeKelas,
} from "../../../utils/kelas";

function toast({ icon = "info", title = "", text = "", timer = 2200 }) {
  return Swal.fire({
    icon,
    title,
    text,
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer,
    timerProgressBar: true,
  });
}

export default function AssignmentFormModal({ guruId, onClose, onCreated }) {
  const [kode, setKode] = useState("");
  const [judul, setJudul] = useState("");
  const [deskripsi, setDeskripsi] = useState("");
  const [kelas, setKelas] = useState("");
  const [kelasOptions, setKelasOptions] = useState(KELAS_OPTIONS);
  const [kelasDropdownOpen, setKelasDropdownOpen] = useState(false);
  const [deadlineHari, setDeadlineHari] = useState("");
  const [lampirPdf, setLampirPdf] = useState(false);
  const [file, setFile] = useState(null);
  const [tambahKunciJawaban, setTambahKunciJawaban] = useState(false);
  const [kunciJawabanFile, setKunciJawabanFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [checkingKode, setCheckingKode] = useState(false);
  const [kodeStatus, setKodeStatus] = useState(null); // 'available' | 'taken' | null

  // Filter kelas berdasarkan input
  const normalizedKelas = useMemo(() => normalizeKelas(kelas), [kelas]);
  const kelasValid = isValidKelas(normalizedKelas, kelasOptions);
  const deadlineHariNumber = deadlineHari === "" ? null : Number(deadlineHari);
  const deadlineHariInvalid =
    deadlineHari !== "" &&
    (!Number.isInteger(deadlineHariNumber) || deadlineHariNumber < 0);
  const filteredKelas = kelasOptions.filter((k) =>
    k.toLowerCase().includes(kelas.toLowerCase())
  );

  useEffect(() => {
    let ignore = false;

    async function loadKelasOptions() {
      try {
        const res = await fetch("/api/enums/kelas", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok || !data?.ok || !Array.isArray(data.data)) return;

        const normalizedOptions = data.data
          .map((item) => normalizeKelas(item))
          .filter(Boolean);

        if (!ignore && normalizedOptions.length > 0) {
          setKelasOptions(normalizedOptions);
        }
      } catch (err) {
        console.error("Error loading kelas options:", err);
      }
    }

    loadKelasOptions();

    return () => {
      ignore = true;
    };
  }, []);

  // Pengecekan kode tugas
  async function checkKodeTugas(kodeValue) {
    if (!kodeValue || kodeValue.trim() === "") {
      setKodeStatus(null);
      return;
    }

    setCheckingKode(true);
    try {
      const res = await fetch(
        `/api/assignments/check-kode?kode=${encodeURIComponent(
          kodeValue.toUpperCase()
        )}`
      );
      const data = await res.json();

      if (data.available) {
        setKodeStatus("available");
      } else {
        setKodeStatus("taken");
      }
    } catch (err) {
      console.error("Error checking kode:", err);
      setKodeStatus(null);
    } finally {
      setCheckingKode(false);
    }
  }

  function handleKodeChange(e) {
    const value = e.target.value;
    setKode(value);
    setKodeStatus(null);
  }

  function handleKodeBlur() {
    if (kode.trim()) {
      checkKodeTugas(kode);
    }
  }

  function handleKelasChange(e) {
    setKelas(e.target.value);
    setKelasDropdownOpen(true);
  }

  function selectKelas(kelasValue) {
    setKelas(kelasValue);
    setKelasDropdownOpen(false);
  }

  function handleDeadlineChange(e) {
    const value = e.target.value;
    if (value === "") {
      setDeadlineHari("");
      return;
    }

    if (/^\d+$/.test(value)) {
      setDeadlineHari(value);
    }
  }

  function handleKunciJawabanChange(e) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validasi hanya PDF
    if (selectedFile.type !== "application/pdf") {
      toast({
        icon: "error",
        title: "Format Tidak Valid",
        text: "Kunci jawaban hanya dapat berupa file PDF!",
      });
      e.target.value = "";
      return;
    }

    setKunciJawabanFile(selectedFile);
  }

  function handleFileChange(e) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validasi hanya PDF
    if (selectedFile.type !== "application/pdf") {
      toast({
        icon: "error",
        title: "Format Tidak Valid",
        text: "File tugas hanya dapat berupa PDF!",
      });
      e.target.value = "";
      return;
    }

    setFile(selectedFile);
  }

  async function submit() {
    // Validasi kode tugas sudah dicek dan tersedia
    if (kodeStatus === "taken") {
      toast({
        icon: "error",
        title: "Kode Tugas Sudah Digunakan",
        text: "Silakan gunakan kode tugas yang lain",
      });
      return;
    }

    if (!kode || !judul || !deskripsi || !kelas) {
      toast({
        icon: "warning",
        title: "Data Belum Lengkap",
        text: "Mohon lengkapi semua field yang wajib diisi",
      });
      return;
    }

    if (!kelasValid) {
      toast({
        icon: "warning",
        title: "Kelas Tidak Valid",
        text: "Pilih kelas dari daftar yang tersedia",
      });
      return;
    }

    if (deadlineHariInvalid) {
      toast({
        icon: "warning",
        title: "Deadline Tidak Valid",
        text: "Deadline harus berupa angka 0 atau lebih",
      });
      return;
    }

    if (lampirPdf && !file) {
      toast({
        icon: "warning",
        title: "PDF Belum Dipilih",
        text: "Anda memilih lampirkan PDF, tapi belum memilih file",
      });
      return;
    }

    if (tambahKunciJawaban && !kunciJawabanFile) {
      toast({
        icon: "warning",
        title: "Kunci Jawaban Belum Dipilih",
        text: "Anda memilih tambahkan kunci jawaban, tapi belum memilih file",
      });
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("guruId", guruId);
      formData.append("kode", kode);
      formData.append("judul", judul);
      formData.append("deskripsi", deskripsi);
      formData.append("kelas", normalizedKelas);
      formData.append("deadlineHari", deadlineHari || "");
      formData.append("lampirPdf", lampirPdf);

      if (file) formData.append("file", file);

      formData.append("tambahKunciJawaban", tambahKunciJawaban);
      if (kunciJawabanFile) {
        formData.append("kunciJawabanFile", kunciJawabanFile);
      }

      const res = await fetch("/api/assignments", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal membuat tugas");

      toast({
        icon: "success",
        title: "Berhasil",
        text: "Tugas berhasil dibuat!",
      });

      if (onCreated) onCreated(data.assignment);
      if (onClose) onClose();
    } catch (err) {
      console.error(err);
      toast({
        icon: "error",
        title: "Gagal Menyimpan",
        text: err.message || "Terjadi kesalahan saat menyimpan tugas",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <h2 className="text-2xl font-bold">📝 Buat Tugas Baru</h2>
          <p className="text-blue-100 text-sm mt-1">
            Lengkapi form di bawah untuk membuat tugas baru
          </p>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-1">
          {/* Kode Tugas */}
          <div className="mb-5">
            <label className="block font-semibold mb-2 text-gray-700">
              Kode Tugas <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                className={`w-full border-2 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 transition-all ${
                  kodeStatus === "available"
                    ? "border-green-500 focus:ring-green-200"
                    : kodeStatus === "taken"
                    ? "border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                }`}
                placeholder="Contoh: MTK-001"
                value={kode}
                onChange={handleKodeChange}
                onBlur={handleKodeBlur}
              />
              {checkingKode && (
                <div className="absolute right-3 top-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                </div>
              )}
              {kodeStatus === "available" && (
                <div className="absolute right-3 top-3 text-green-600">✓</div>
              )}
              {kodeStatus === "taken" && (
                <div className="absolute right-3 top-3 text-red-600">✗</div>
              )}
            </div>
            {kodeStatus === "available" && (
              <p className="text-sm text-green-600 mt-1">
                ✓ Kode tugas tersedia
              </p>
            )}
            {kodeStatus === "taken" && (
              <p className="text-sm text-red-600 mt-1">
                ✗ Kode tugas sudah digunakan
              </p>
            )}
          </div>

          {/* Judul */}
          <div className="mb-5">
            <label className="block font-semibold mb-2 text-gray-700">
              Judul Tugas <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              placeholder="Contoh: Tugas Matematika Bab 5"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
            />
          </div>

          {/* Deskripsi */}
          <div className="mb-5">
            <label className="block font-semibold mb-2 text-gray-700">
              Deskripsi <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full border-2 border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all resize-none"
              placeholder="Jelaskan detail tugas yang harus dikerjakan..."
              rows={4}
              value={deskripsi}
              onChange={(e) => setDeskripsi(e.target.value)}
            />
          </div>

          {/* Kelas & Deadline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
            {/* Kelas dengan Dropdown Searchable */}
            <div className="relative">
              <label className="block font-semibold mb-2 text-gray-700">
                Kelas <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className={`w-full border-2 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 transition-all ${
                  !kelas
                    ? "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                    : kelasValid
                    ? "border-green-500 focus:border-green-500 focus:ring-green-200"
                    : "border-red-500 focus:border-red-500 focus:ring-red-200"
                }`}
                placeholder="Ketik atau pilih kelas..."
                value={kelas}
                onChange={handleKelasChange}
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
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
                      onClick={() => selectKelas(kelasOption)}
                    >
                      {kelasOption}
                    </button>
                  ))}
                </div>
              )}

              {kelasDropdownOpen && kelas && filteredKelas.length === 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white border-2 border-gray-300 rounded-lg shadow-lg px-4 py-2.5 text-sm text-gray-500">
                  Kelas tidak ditemukan
                </div>
              )}

              <p className="text-xs text-gray-500 mt-1">
                💡 Ketik untuk mencari atau pilih dari dropdown
              </p>
              {kelas && !kelasValid && (
                <p className="text-xs text-red-600 mt-1">
                  Pilih kelas yang tersedia dari daftar.
                </p>
              )}
            </div>

            {/* Deadline */}
            <div>
              <label className="block font-semibold mb-2 text-gray-700">
                Deadline (hari)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                className={`w-full border-2 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 transition-all ${
                  deadlineHariInvalid
                    ? "border-red-500 focus:border-red-500 focus:ring-red-200"
                    : "border-gray-300 focus:border-blue-500 focus:ring-blue-200"
                }`}
                placeholder="Contoh: 7"
                value={deadlineHari}
                onChange={handleDeadlineChange}
              />
              {deadlineHariInvalid && (
                <p className="text-xs text-red-600 mt-1">
                  Deadline tidak boleh minus.
                </p>
              )}
            </div>
          </div>

          {/* Lampiran PDF Tugas */}
          <div className="mb-5 bg-gray-50 p-4 rounded-lg border border-gray-200">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={lampirPdf}
                onChange={(e) => setLampirPdf(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="font-semibold text-gray-700">
                📎 Lampirkan PDF Tugas
              </span>
            </label>
            {lampirPdf && (
              <div className="mt-3">
                <input
                  type="file"
                  accept=".pdf"
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                  onChange={handleFileChange}
                />
                {file && (
                  <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                    <span>✓</span> File dipilih: {file.name}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Kunci Jawaban */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-5 rounded-lg border-2 border-amber-200">
            <label className="block font-semibold mb-1 text-gray-800 flex items-center gap-2">
              <span className="text-xl">🔑</span>
              Kunci Jawaban
            </label>

            {/* Keterangan Penilaian Otomatis */}
            <div className="flex items-center gap-1.5 mb-3 text-xs text-gray-600">
              <span className="italic">* Penilaian otomatis oleh Gemini</span>
              <SiGooglegemini className="text-blue-500 w-3.5 h-3.5" />
            </div>

            <div className="flex gap-4 mb-3">
              <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all">
                <input
                  type="radio"
                  name="kunciJawaban"
                  checked={tambahKunciJawaban === true}
                  onChange={() => setTambahKunciJawaban(true)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="font-medium">Ya, tambahkan</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer px-4 py-2 bg-white rounded-lg border-2 border-gray-200 hover:border-blue-400 transition-all">
                <input
                  type="radio"
                  name="kunciJawaban"
                  checked={tambahKunciJawaban === false}
                  onChange={() => {
                    setTambahKunciJawaban(false);
                    setKunciJawabanFile(null);
                  }}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="font-medium">Tidak</span>
              </label>
            </div>

            {tambahKunciJawaban && (
              <div className="bg-white p-4 rounded-lg border border-amber-300 shadow-sm">
                <label className="block font-semibold mb-2 text-gray-700">
                  Upload Kunci Jawaban (PDF){" "}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf"
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 cursor-pointer"
                  onChange={handleKunciJawabanChange}
                />
                {kunciJawabanFile && (
                  <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                    <span>✓</span> File dipilih: {kunciJawabanFile.name}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-100 transition-all"
            disabled={saving}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={submit}
            className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            disabled={saving || kodeStatus === "taken"}
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                <span>💾</span>
                <span>Simpan Tugas</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
