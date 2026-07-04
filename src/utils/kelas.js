export const KELAS_OPTIONS = [
  "XTKJ1",
  "XTKJ2",
  "XITKJ1",
  "XITKJ2",
  "XIITKJ1",
  "XIITKJ2",
  "TPTUP",
];

export function normalizeKelas(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function isValidKelas(value, kelasOptions = KELAS_OPTIONS) {
  const normalized = normalizeKelas(value);
  return kelasOptions.includes(normalized);
}
