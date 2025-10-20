"use client";

import { useMemo, useState } from "react";
import { FiShare2, FiFileText, FiTrash2 } from "react-icons/fi";
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

function StatusChip({ overdueCount, openCount }) {
  if (overdueCount > 0)
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
        🔴 Terlambat ({overdueCount})
      </span>
    );
  if (openCount > 0)
    return (
      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-700">
        ⏳ Belum Selesai ({openCount})
      </span>
    );
  return (
    <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-700">
      ✅ Selesai
    </span>
  );
}

export default function GuruAssignmentsTable({
  data,
  onBroadcast,
  onRekap,
  onDelete,
}) {
  const [kelasInput, setKelasInput] = useState({});
  const kelasOptions = ["XI RPL", "XI TKJ", "XII RPL", "XII TKJ"];

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

    // lempar ke handler parent (page.jsx) agar urusan API & refresh tetap terpusat
    onDelete && onDelete(id);
  }

  return (
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
              <th className="text-left p-3 w-[280px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((a, i) => {
              const isOverdue =
                a.deadline && new Date(a.deadline).getTime() < Date.now();
              const jid = a.id;
              const kelasVal =
                kelasInput[jid] ?? a.kelas ?? kelasOptions[0] ?? "";

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
                    <StatusChip
                      overdueCount={a.overdueCount || 0}
                      openCount={a.openCount || 0}
                    />
                  </td>

                  <td className="p-3">
                    {a.pdfUrl ? (
                      <a
                        href={a.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        📎 Lihat
                      </a>
                    ) : (
                      <span className="text-gray-400">Tidak ada</span>
                    )}
                  </td>

                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {/* input + datalist: bisa diketik & pilih */}
                      <div className="relative">
                        <input
                          list={`kelas-options-${jid}`}
                          className="w-32 rounded border px-2 py-1 text-xs focus:ring-2 focus:ring-violet-400"
                          value={kelasVal}
                          onChange={(e) =>
                            setKelasInput((s) => ({
                              ...s,
                              [jid]: e.target.value.toUpperCase(),
                            }))
                          }
                          placeholder="Kelas..."
                          title="Ketik atau pilih kelas"
                        />
                        <datalist id={`kelas-options-${jid}`}>
                          {kelasOptions.map((opt) => (
                            <option key={opt} value={opt} />
                          ))}
                        </datalist>
                      </div>

                      <button
                        className="inline-flex items-center px-2 py-1 rounded bg-violet-600 text-white hover:bg-violet-700 text-xs"
                        onClick={() =>
                          onBroadcast &&
                          onBroadcast({
                            kode: a.kode,
                            kelas:
                              kelasInput[jid] || a.kelas || kelasOptions[0],
                          })
                        }
                        title="Broadcast ke kelas"
                      >
                        <FiShare2 className="mr-1" />
                        Broadcast
                      </button>

                      <button
                        className="inline-flex items-center px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-xs"
                        onClick={() =>
                          onRekap &&
                          onRekap({
                            kode: a.kode,
                            kelas:
                              kelasInput[jid] || a.kelas || kelasOptions[0],
                          })
                        }
                        title="Download rekap Excel"
                      >
                        <FiFileText className="mr-1" />
                        Rekap
                      </button>

                      <button
                        className="inline-flex items-center px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-xs"
                        onClick={() =>
                          confirmDelete({
                            id: a.id,
                            kode: a.kode,
                            judul: a.judul,
                          })
                        }
                        title="Hapus tugas"
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
                <td className="p-4 text-center text-gray-500" colSpan={8}>
                  Belum ada tugas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
