// src/utils/phone.js
function normalizePhone(p) {
  p = String(p || "").replace(/[^\d]/g, ""); // ambil angka saja
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (p.startsWith("8")) p = "62" + p; // guard ekstra untuk "8xxxx"
  return p;
}
module.exports = { normalizePhone };
