"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const toastErr = (text) =>
  Swal.fire({
    icon: "error",
    title: "Gagal",
    text,
    toast: true,
    position: "top-end",
    timer: 2200,
    showConfirmButton: false,
  });
const modalOK = (title, text = "") =>
  Swal.fire({ icon: "success", title, text, confirmButtonText: "OK" });

export default function BuatSoalPage() {
  const { kode } = useParams();
  const sp = useSearchParams();
  const router = useRouter();

  // metadata dari query (sumber modal)
  const metaFromQuery = {
    title: sp.get("title") || "",
    className: sp.get("kelas") || "",
    guruId: sp.get("guruId") ? Number(sp.get("guruId")) : null,
    timeClose: sp.get("deadline") || "",
  };

  const [serverMode, setServerMode] = useState(false); // true kalau assessment sudah ada di DB
  const [assessment, setAssessment] = useState(null);
  const [questions, setQuestions] = useState([]); // list tampil
  const [buffer, setBuffer] = useState([]); // list lokal untuk mode draft (belum disimpan)

  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // editor state
  const [qText, setQText] = useState("");
  const [qImageUrl, setQImageUrl] = useState("");
  const [opsi, setOpsi] = useState({ A: "", B: "", C: "", D: "" });
  const [opsiImg, setOpsiImg] = useState({ A: "", B: "", C: "", D: "" });
  const [kunci, setKunci] = useState("A");

  const jumlahSoal = useMemo(
    () => (serverMode ? questions.length : buffer.length),
    [serverMode, questions, buffer]
  );

  useEffect(() => {
    (async () => {
      try {
        // Coba ambil assessment by code
        const res = await fetch(
          `/api/guru/assessments/${encodeURIComponent(kode)}`
        );
        if (res.ok) {
          const data = await res.json();
          setServerMode(true);
          setAssessment(data.data.assessment);
          setQuestions(data.data.questions || []);
          if ((data.data.questions || []).length) {
            loadToEditor(data.data.questions[0]);
          }
        } else {
          // 404 → mode draft lokal
          setServerMode(false);
          setAssessment({
            code: kode.toUpperCase(),
            title: metaFromQuery.title,
            className: metaFromQuery.className,
          });
          // jika ada buffer di sessionStorage (misal refresh)
          try {
            const raw = sessionStorage.getItem(`buffer-${kode}`);
            if (raw) {
              const arr = JSON.parse(raw);
              setBuffer(Array.isArray(arr) ? arr : []);
              if (arr?.length) loadToEditor(arr[0]);
            }
          } catch {}
        }
      } catch (e) {
        toastErr("Gagal memuat halaman.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kode]);

  function loadToEditor(q) {
    setQText(q?.text || "");
    setQImageUrl(q?.imageUrl || (q?.media?.[0]?.url ?? ""));
    const mapOpt = {};
    (q?.options || []).forEach((o) => {
      mapOpt[o.label] = o.text || "";
    });
    setOpsi({
      A: mapOpt.A || "",
      B: mapOpt.B || "",
      C: mapOpt.C || "",
      D: mapOpt.D || "",
    });
    const mapImg = {};
    (q?.options || []).forEach((o) => {
      mapImg[o.label] = o.media?.[0]?.url || "";
    });
    setOpsiImg({
      A: mapImg.A || "",
      B: mapImg.B || "",
      C: mapImg.C || "",
      D: mapImg.D || "",
    });
    setKunci(q?.answerKeyLabel || "A");
  }

  function clearEditor() {
    setQText("");
    setQImageUrl("");
    setOpsi({ A: "", B: "", C: "", D: "" });
    setOpsiImg({ A: "", B: "", C: "", D: "" });
    setKunci("A");
  }

  async function saveCurrentQuestion(nextDirection = 0) {
    // validasi
    if (!qText.trim()) return toastErr("Pertanyaan belum diisi.");
    if (!opsi.A && !opsiImg.A) return toastErr("Opsi A kosong.");
    if (!opsi.B && !opsiImg.B) return toastErr("Opsi B kosong.");
    if (!opsi.C && !opsiImg.C) return toastErr("Opsi C kosong.");
    if (!opsi.D && !opsiImg.D) return toastErr("Opsi D kosong.");

    const payload = {
      text: qText,
      options: [
        { label: "A", text: opsi.A, imageUrl: opsiImg.A },
        { label: "B", text: opsi.B, imageUrl: opsiImg.B },
        { label: "C", text: opsi.C, imageUrl: opsiImg.C },
        { label: "D", text: opsi.D, imageUrl: opsiImg.D },
      ],
      answerKeyLabel: kunci,
      imageUrl: qImageUrl || null,
    };

    try {
      setSaving(true);
      if (serverMode) {
        // langsung simpan ke server
        const res = await fetch(
          `/api/guru/assessments/${encodeURIComponent(kode)}/questions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        const data = await res.json();
        if (!res.ok || data?.ok === false)
          throw new Error(data?.message || "Tidak bisa menyimpan soal.");
        const list = data.data.questions;
        setQuestions(list);
        // navigasi indeks
        let newIdx = idx;
        if (nextDirection !== 0) {
          newIdx = Math.max(0, Math.min(list.length - 1, idx + nextDirection));
          loadToEditor(list[newIdx]);
          setIdx(newIdx);
        } else {
          clearEditor();
          setIdx(list.length);
        }
      } else {
        // simpan di buffer lokal
        const draft = {
          text: payload.text,
          imageUrl: payload.imageUrl,
          answerKeyLabel: payload.answerKeyLabel,
          options: payload.options.map((o) => ({
            label: o.label,
            text: o.text,
            media: o.imageUrl ? [{ url: o.imageUrl }] : [],
          })),
          media: payload.imageUrl ? [{ url: payload.imageUrl }] : [],
        };
        const next = [...buffer, draft];
        setBuffer(next);
        try {
          sessionStorage.setItem(`buffer-${kode}`, JSON.stringify(next));
        } catch {}
        // navigasi
        if (nextDirection !== 0) {
          const newIdx = Math.max(
            0,
            Math.min(next.length - 1, idx + nextDirection)
          );
          loadToEditor(next[newIdx]);
          setIdx(newIdx);
        } else {
          clearEditor();
          setIdx(next.length);
        }
      }
      await Swal.fire({
        icon: "success",
        title: "Tersimpan",
        timer: 700,
        showConfirmButton: false,
      });
    } catch (e) {
      toastErr(e.message || "Gagal menyimpan soal.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSelesai() {
    try {
      const ok = await Swal.fire({
        icon: "question",
        title: "Selesai menyusun?",
        text: serverMode
          ? "Perubahan sudah tersimpan. Kembali ke Dashboard Guru."
          : "Penilaian akan dibuat lalu semua soal buffer akan dikirim ke server.",
        showCancelButton: true,
        confirmButtonText: "Selesai & Kembali",
      });
      if (!ok.isConfirmed) return;

      if (!serverMode) {
        // 1) buat assessment
        const resA = await fetch("/api/guru/assessments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            guruId: metaFromQuery.guruId,
            kode: assessment.code,
            title: metaFromQuery.title,
            className: metaFromQuery.className,
            timeClose: metaFromQuery.timeClose || null,
            questions: buffer, // seluruh soal JSON
          }),
        });
        const dA = await resA.json();
        if (!resA.ok || dA?.ok === false)
          throw new Error(dA?.message || "Gagal membuat penilaian.");

        try {
          sessionStorage.removeItem(`buffer-${kode}`);
        } catch {}
      } else {
        await modalOK("Disimpan", "Kembali ke Dashboard Guru.");
        router.push("/guru");
      }
    } catch (e) {
      toastErr(e.message || "Gagal menyelesaikan.");
    }
  }

  async function handleBatal() {
    const ask = await Swal.fire({
      icon: "warning",
      title: "Batalkan pembuatan penilaian?",
      text: serverMode
        ? "Draft & soal yang tersimpan di server akan dihapus."
        : "Soal buffer lokal akan dibuang.",
      showCancelButton: true,
      confirmButtonText: "Ya, batalkan",
    });
    if (!ask.isConfirmed) return;

    try {
      if (serverMode) {
        const res = await fetch(
          `/api/guru/assessments/${encodeURIComponent(kode)}`,
          { method: "DELETE" }
        );
        const data = await res.json();
        if (!res.ok || data?.ok === false)
          throw new Error(data?.message || "Gagal membatalkan.");
      } else {
        try {
          sessionStorage.removeItem(`buffer-${kode}`);
        } catch {}
      }
      await modalOK("Dihapus");
      router.push("/guru");
    } catch (e) {
      toastErr(e.message);
    }
  }

  if (loading) return <div className="p-6">Memuat…</div>;

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* TOP BAR */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-white sticky top-0">
        <div className="text-sm">
          <div className="font-semibold">
            {assessment?.title || metaFromQuery.title || "Penilaian Baru"} •{" "}
            {assessment?.className || metaFromQuery.className}
          </div>
          <div className="text-gray-500">Kode: {assessment?.code || kode}</div>
        </div>

        <div className="text-sm font-medium">Soal dibuat: {jumlahSoal}</div>

        <div className="flex gap-2">
          <button
            onClick={handleBatal}
            className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
          >
            Batal
          </button>
          <button
            onClick={handleSelesai}
            className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
          >
            Selesai
          </button>
        </div>
      </div>

      {/* EDITOR */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="mb-3 text-sm text-gray-600">
            Soal ke-{Math.min(idx + 1, jumlahSoal + 1)}
          </div>

          <label className="block text-sm font-medium mb-1">Pertanyaan</label>
          <textarea
            className="w-full rounded border p-3 mb-3"
            rows={4}
            placeholder="Tulis pertanyaan di sini…"
            value={qText}
            onChange={(e) => setQText(e.target.value)}
          />

          <label className="block text-sm font-medium mb-1">
            Lampiran gambar (URL)
          </label>
          <input
            className="w-full rounded border p-2 mb-4"
            placeholder="https://…/gambar.png"
            value={qImageUrl}
            onChange={(e) => setQImageUrl(e.target.value)}
          />
          {qImageUrl ? (
            <img
              src={qImageUrl}
              alt="lampiran-soal"
              className="max-h-56 object-contain mb-4 rounded"
            />
          ) : null}

          {/* OPSI */}
          <div className="grid md:grid-cols-2 gap-3">
            {["A", "B", "C", "D"].map((L) => (
              <div key={L} className="border rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="font-semibold">Opsi {L}</label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="kunci"
                      checked={kunci === L}
                      onChange={() => setKunci(L)}
                    />
                    Kunci
                  </label>
                </div>
                <input
                  className="w-full rounded border p-2 mb-2"
                  placeholder={`Teks opsi ${L}`}
                  value={opsi[L]}
                  onChange={(e) =>
                    setOpsi((s) => ({ ...s, [L]: e.target.value }))
                  }
                />
                <input
                  className="w-full rounded border p-2"
                  placeholder={`URL gambar opsi ${L} (opsional)`}
                  value={opsiImg[L]}
                  onChange={(e) =>
                    setOpsiImg((s) => ({ ...s, [L]: e.target.value }))
                  }
                />
                {opsiImg[L] ? (
                  <img
                    src={opsiImg[L]}
                    alt={`opsi-${L}`}
                    className="max-h-40 object-contain mt-2 rounded"
                  />
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              className="px-3 py-2 rounded-md border bg-white hover:bg-gray-50"
              disabled={saving || (serverMode ? idx <= 0 : idx <= 0)}
              onClick={() => {
                const prev = Math.max(0, idx - 1);
                const list = serverMode ? questions : buffer;
                if (list.length) {
                  const target = list[prev];
                  loadToEditor(target);
                }
                setIdx(prev);
              }}
            >
              ← Soal Sebelumnya
            </button>

            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                disabled={saving}
                onClick={() => saveCurrentQuestion(0)}
                title="Simpan & tetap di sini (lanjut tambah soal baru)"
              >
                Simpan Soal
              </button>
              <button
                className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
                disabled={saving}
                onClick={() => saveCurrentQuestion(+1)}
                title="Simpan & ke soal berikutnya"
              >
                Soal Selanjutnya →
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Penanda sudut untuk layout */}
      <div className="fixed left-3 bottom-3">
        <span className="text-xs text-gray-500">
          Kiri bawah: soal sebelumnya
        </span>
      </div>
      <div className="fixed right-3 bottom-3 text-right">
        <span className="text-xs text-gray-500">
          Kanan bawah: soal selanjutnya
        </span>
      </div>
    </div>
  );
}
