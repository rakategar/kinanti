"use client";

import { useMemo, useState } from "react";
import { FiFileText, FiTrash2 } from "react-icons/fi";

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

export default function AssessmentsTable({ data, onRekap, onDelete }) {
  const [kelasInput, setKelasInput] = useState({});

  const rows = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const da = a.timeClose || a.deadline;
      const db = b.timeClose || b.deadline;
      const ta = da ? new Date(da).getTime() : Infinity;
      const tb = db ? new Date(db).getTime() : Infinity;
      return ta - tb;
    });
    return copy;
  }, [data]);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-indigo-700 text-white px-3 py-2 font-semibold">
        Penilaian (Pilihan Ganda)
      </div>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-indigo-700/90 text-white">
              <th className="text-left p-3 w-10">No</th>
              <th className="text-left p-3">Kode</th>
              <th className="text-left p-3">Judul</th>
              <th className="text-left p-3">Kelas</th>
              <th className="text-left p-3">Deadline</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3 w-[220px]">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((a, i) => {
              const id = a.id;
              const kode = a.kode || a.code;
              const judul = a.judul || a.title;
              const kelas = a.kelas || a.className;
              const deadline = a.timeClose || a.deadline;
              const pending = Number(a.pendingCount ?? 0);

              const kelasVal = kelasInput[id] ?? kelas ?? "";

              return (
                <tr key={id} className="hover:bg-gray-50 transition">
                  <td className="p-3">{i + 1}</td>
                  <td className="p-3 font-medium">{kode}</td>
                  <td className="p-3">{judul}</td>
                  <td className="p-3">{kelas || "—"}</td>
                  <td className="p-3">
                    {deadline ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{fmtWIB(deadline)}</span>
                        <span className="text-[11px] text-gray-500">
                          {rel(deadline)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 text-red-700 px-2 py-0.5 border border-red-200">
                      <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
                      {pending} belum
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <input
                        className="w-28 rounded border px-2 py-1 text-xs"
                        placeholder="Kelas (XITKJ2)"
                        value={kelasVal}
                        onChange={(e) =>
                          setKelasInput((s) => ({
                            ...s,
                            [id]: e.target.value
                              .toUpperCase()
                              .replace(/\s+/g, ""),
                          }))
                        }
                        title="Kelas untuk rekap"
                      />
                      <button
                        className="inline-flex items-center px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 text-xs"
                        onClick={() =>
                          onRekap &&
                          onRekap({
                            kode,
                            kelas: (kelasInput[id] || kelas || "")
                              .toString()
                              .toUpperCase(),
                          })
                        }
                        title="Download rekap Excel"
                      >
                        <FiFileText className="mr-1" />
                        Rekap
                      </button>
                      <button
                        className="inline-flex items-center px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 text-xs"
                        onClick={() => onDelete && onDelete(id)}
                        title="Hapus penilaian"
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
                <td className="p-4 text-center text-gray-500" colSpan={7}>
                  Belum ada penilaian. Klik <b>+ Buat Penilaian</b> untuk mulai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
