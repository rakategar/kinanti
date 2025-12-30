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

/**
 * Generate rekap Excel lengkap dengan format seperti API
 * @param {Object} params
 * @param {Object} params.assignment - Assignment data
 * @param {Array} params.rows - Array of row data
 * @param {string} params.kelas - Kelas name
 */
async function generateRekapExcel({ assignment, rows, kelas }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kinanti Bot";
  wb.created = new Date();

  const ws = wb.addWorksheet("Rekap", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // Kolom
  ws.columns = [
    { header: "Kelas", key: "kelas", width: 14 },
    { header: "Nama Siswa", key: "nama", width: 28 },
    { header: "No. HP", key: "phone", width: 16 },
    { header: "Kode", key: "kode", width: 12 },
    { header: "Judul", key: "judul", width: 40 },
    { header: "Deadline", key: "deadline", width: 20 },
    { header: "Status", key: "status", width: 18 },
    { header: "Submitted At", key: "submittedAt", width: 22 },
    { header: "File URL", key: "url", width: 60 },
    { header: "Evaluation", key: "evaluation", width: 50 },
    { header: "Grade", key: "grade", width: 12 },
    { header: "Score", key: "score", width: 12 },
  ];

  // Add rows
  ws.addRows(rows);

  // Styling header
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.height = 22;
  header.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0EA5E9" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF93C5FD" } },
      left: { style: "thin", color: { argb: "FF93C5FD" } },
      bottom: { style: "thin", color: { argb: "FF93C5FD" } },
      right: { style: "thin", color: { argb: "FF93C5FD" } },
    };
  });

  // Wrap text untuk kolom panjang
  ["judul", "url", "evaluation"].forEach((key) => {
    const col = ws.getColumn(key);
    col.alignment = { wrapText: true, vertical: "top" };
  });

  // Alignment untuk kolom numerik
  ws.getColumn("score").alignment = {
    horizontal: "center",
    vertical: "middle",
  };
  ws.getColumn("grade").alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  // AutoFilter
  ws.autoFilter = { from: "A1", to: "L1" };

  // Add table jika ada data
  if (rows.length > 0) {
    const tableRef = `A1:L${rows.length + 1}`;
    ws.addTable({
      name: "RekapTable",
      ref: tableRef,
      headerRow: true,
      totalsRow: false,
      style: {
        theme: "TableStyleMedium9",
        showRowStripes: true,
      },
      columns: [
        { name: "Kelas", filterButton: true },
        { name: "Nama Siswa", filterButton: true },
        { name: "No. HP", filterButton: true },
        { name: "Kode", filterButton: true },
        { name: "Judul", filterButton: true },
        { name: "Deadline", filterButton: true },
        { name: "Status", filterButton: true },
        { name: "Submitted At", filterButton: true },
        { name: "File URL", filterButton: true },
        { name: "Evaluation", filterButton: true },
        { name: "Grade", filterButton: true },
        { name: "Score", filterButton: true },
      ],
      rows: rows.map((row) => [
        row.kelas,
        row.nama,
        row.phone,
        row.kode,
        row.judul,
        row.deadline,
        row.status,
        row.submittedAt,
        row.url,
        row.evaluation,
        row.grade,
        row.score,
      ]),
    });
  }

  return wb.xlsx.writeBuffer();
}

module.exports = { buildRekap, generateRekapExcel };
