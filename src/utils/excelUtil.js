const ExcelJS = require("exceljs");

/**
 * Build rekap tugas → return Buffer (.xlsx)
 * rows: Array<{ Kelas, Siswa, Kode, Judul, Status, Waktu }>
 */
async function buildRekap(rows = []) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Rekap Tugas");

  ws.columns = [
    { header: "Kelas", key: "Kelas", width: 15 },
    { header: "Siswa", key: "Siswa", width: 25 },
    { header: "Kode Tugas", key: "Kode", width: 15 },
    { header: "Judul Tugas", key: "Judul", width: 30 },
    { header: "Status", key: "Status", width: 16 },
    { header: "Waktu Pengumpulan", key: "Waktu", width: 22 }, // NEW
  ];

  rows.forEach((r) => {
    const row = ws.addRow(r);
    const c = row.getCell("Waktu");
    if (r.Waktu instanceof Date && !isNaN(r.Waktu)) {
      c.value = r.Waktu;
      c.numFmt = "yyyy-mm-dd hh:mm";
    }
  });

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

  return wb.xlsx.writeBuffer();
}

module.exports = { buildRekap };
