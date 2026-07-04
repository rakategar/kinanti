// src/utils/hotsPdf.js
// Generator PDF soal HOTS (client-side) memakai jsPDF + jspdf-autotable.
// Menghasilkan DUA file terpisah: PDF Soal dan PDF Kunci Jawaban (berisi soal + jawaban).
import { jsPDF } from "jspdf";

const BLOOM_LABEL = {
  C4: "C4 – Analisis",
  C5: "C5 – Evaluasi",
  C6: "C6 – Kreasi",
};

const OPSI_KEYS = ["A", "B", "C", "D", "E"];

function levelLabel(level) {
  const key = String(level || "").toUpperCase().slice(0, 2);
  return BLOOM_LABEL[key] || level || "-";
}

function sanitizeFilePart(s) {
  return (
    String(s || "soal")
      .trim()
      .replace(/[^a-z0-9]+/gi, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "soal"
  );
}

function normalize(data, meta) {
  const soalList = Array.isArray(data?.soal) ? data.soal : [];
  return {
    soalList,
    isPg: (data?.jenisSoal || meta.jenisSoal) === "Pilihan Ganda",
    mataPelajaran: data?.mataPelajaran || meta.mataPelajaran || "-",
    judul: data?.judul || meta.judulSoal || "-",
    jenisSoal: data?.jenisSoal || meta.jenisSoal || "-",
    jumlahSoal: soalList.length || meta.jumlahSoal || 0,
  };
}

// Renderer kecil dengan auto page-break dan text wrapping.
function newRenderer() {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimit = pageHeight - 56;
  let y = 48;

  const ensureSpace = (needed) => {
    if (y + needed > bottomLimit) {
      doc.addPage();
      y = 48;
    }
  };

  const writeWrapped = (text, x, options = {}) => {
    const {
      fontSize = 11,
      fontStyle = "normal",
      lineGap = 4,
      maxWidth = contentWidth - (x - marginX),
    } = options;
    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(String(text ?? ""), maxWidth);
    const lineHeight = fontSize + lineGap;
    for (const line of lines) {
      ensureSpace(lineHeight);
      doc.text(line, x, y);
      y += lineHeight;
    }
  };

  const hr = (color = 220) => {
    ensureSpace(14);
    doc.setDrawColor(color);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 16;
  };

  const gap = (n) => {
    y += n;
  };

  return {
    doc,
    marginX,
    pageWidth,
    get y() {
      return y;
    },
    ensureSpace,
    writeWrapped,
    hr,
    gap,
  };
}

function drawHeader(r, title, info) {
  const { doc, marginX, pageWidth } = r;
  const tanggal = new Date().toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("NAMA SEKOLAH", pageWidth / 2, r.y, { align: "center" });
  r.gap(20);
  doc.setFontSize(13);
  doc.text(title, pageWidth / 2, r.y, { align: "center" });
  r.gap(22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  const rows = [
    ["Mata Pelajaran", info.mataPelajaran],
    ["Judul", info.judul],
    ["Jenis Soal", info.jenisSoal],
    ["Jumlah Soal", `${info.jumlahSoal} soal`],
    ["Tanggal", tanggal],
  ];
  for (const [label, value] of rows) {
    r.ensureSpace(16);
    doc.text(String(label), marginX, r.y);
    doc.text(":", marginX + 90, r.y);
    doc.text(String(value), marginX + 100, r.y);
    r.gap(16);
  }
  r.gap(4);
  r.hr(150);
  r.gap(4);
}

/**
 * PDF SOAL: hanya soal (tanpa kunci/pembahasan).
 */
export function generateHotsSoalPdf(data, meta = {}) {
  const info = normalize(data, meta);
  const r = newRenderer();
  drawHeader(r, "SOAL ULANGAN HOTS", info);

  info.soalList.forEach((s, idx) => {
    const nomor = s?.nomor ?? idx + 1;
    r.ensureSpace(40);
    r.writeWrapped(`No. ${nomor}   |   Level: ${levelLabel(s?.levelBloom)}`, r.marginX, {
      fontStyle: "bold",
    });
    r.writeWrapped(s?.pertanyaan || "", r.marginX);
    r.gap(4);

    if (info.isPg) {
      const opsi = s?.opsi || {};
      OPSI_KEYS.forEach((key) => {
        if (opsi[key] != null && String(opsi[key]).trim() !== "") {
          r.writeWrapped(`${key}. ${opsi[key]}`, r.marginX + 14);
        }
      });
    } else {
      // Ruang jawaban kosong (garis)
      for (let i = 0; i < 4; i++) {
        r.ensureSpace(20);
        r.gap(16);
        r.doc.setDrawColor(200);
        r.doc.line(r.marginX + 6, r.y, r.pageWidth - r.marginX, r.y);
      }
      r.gap(4);
    }

    r.gap(10);
    r.hr();
  });

  const filename = `HOTS_SOAL_${sanitizeFilePart(info.mataPelajaran)}_${Date.now()}.pdf`;
  r.doc.save(filename);
  return filename;
}

/**
 * PDF KUNCI JAWABAN: berisi soal + jawaban benar / pembahasan / rubrik.
 */
export function generateHotsKunciPdf(data, meta = {}) {
  const info = normalize(data, meta);
  const r = newRenderer();
  drawHeader(r, "KUNCI JAWABAN & PEMBAHASAN", info);

  info.soalList.forEach((s, idx) => {
    const nomor = s?.nomor ?? idx + 1;
    r.ensureSpace(40);
    r.writeWrapped(`No. ${nomor}   |   Level: ${levelLabel(s?.levelBloom)}`, r.marginX, {
      fontStyle: "bold",
    });
    r.writeWrapped(s?.pertanyaan || "", r.marginX);
    r.gap(4);

    if (info.isPg) {
      const opsi = s?.opsi || {};
      const benar = String(s?.jawabanBenar ?? "").toUpperCase();
      OPSI_KEYS.forEach((key) => {
        if (opsi[key] != null && String(opsi[key]).trim() !== "") {
          const mark = key === benar ? " ✓" : "";
          r.writeWrapped(`${key}. ${opsi[key]}${mark}`, r.marginX + 14, {
            fontStyle: key === benar ? "bold" : "normal",
          });
        }
      });
      r.gap(4);
      r.writeWrapped(`Jawaban Benar: ${benar || "-"}`, r.marginX, { fontStyle: "bold" });
      r.writeWrapped(`Pembahasan: ${s?.pembahasan ?? "-"}`, r.marginX);
    } else {
      r.gap(4);
      r.writeWrapped(`Kunci Jawaban: ${s?.jawabanKunci ?? "-"}`, r.marginX, { fontStyle: "bold" });
      r.writeWrapped(`Rubrik Penilaian: ${s?.rubrikPenilaian ?? "-"}`, r.marginX);
      r.writeWrapped(`Skor Maksimal: ${s?.skorMaksimal ?? "-"}`, r.marginX);
    }

    r.gap(10);
    r.hr();
  });

  const filename = `HOTS_KUNCI_${sanitizeFilePart(info.mataPelajaran)}_${Date.now()}.pdf`;
  r.doc.save(filename);
  return filename;
}

/**
 * Generate kedua PDF sekaligus (soal + kunci) dan unduh keduanya.
 * @returns {{ soal: string, kunci: string }} nama file yang dihasilkan
 */
export function generateHotsPdf(data, meta = {}) {
  const soal = generateHotsSoalPdf(data, meta);
  const kunci = generateHotsKunciPdf(data, meta);
  return { soal, kunci };
}
