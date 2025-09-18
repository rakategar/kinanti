// src/utils/excelUtil.js
const ExcelJS = require("exceljs");

/**
 * Build rekap tugas → return Buffer (.xlsx)
 * @param {Array} rows array of { Kelas, Siswa, Kode, Judul, Status }
 */
async function buildRekap(rows = []) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rekap Tugas");

  // Header
  ws.columns = [
    { header: "Kelas", key: "Kelas", width: 15 },
    { header: "Siswa", key: "Siswa", width: 25 },
    { header: "Kode Tugas", key: "Kode", width: 15 },
    { header: "Judul Tugas", key: "Judul", width: 30 },
    { header: "Status", key: "Status", width: 15 },
  ];

  // Isi
  rows.forEach((r) => ws.addRow(r));

  // Styling sederhana
  ws.getRow(1).font = { bold: true };
  ws.eachRow((row, i) => {
    row.alignment = { vertical: "middle", horizontal: "left" };
    if (i % 2 === 0 && i !== 1) {
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEEEEEE" },
      };
    }
  });

  return wb.xlsx.writeBuffer(); // menghasilkan Buffer
}

module.exports = { buildRekap };
