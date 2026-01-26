// src/controllers/guruController.js

const prismaMod = require("../config/prisma");
const prisma = prismaMod?.prisma ?? prismaMod?.default ?? prismaMod;

const { MessageMedia } = require("whatsapp-web.js");
const { getState, setState, clearState } = require("../services/state");
const { normalizePhone } = require("../utils/phone");
const { uploadPDFtoSupabase } = require("../utils/pdfUtils");
const { safeReply, safeSendMessage } = require("../utils/waHelper");

const REKAP_WIZ = new Map();
// Map<JID, { step: 'pick_code' | 'pick_class', guruId, kode?: string }>

// Util kecil
function phoneFromJid(jid = "") {
  return String(jid || "").replace(/@c\.us$/i, "");
}
async function getGuruByJid(jid) {
  const phone = phoneFromJid(jid);
  return prisma.user.findFirst({ where: { phone, role: "guru" } });
}
function normKelas(s = "") {
  return String(s || "")
    .replace(/\s+/g, "")
    .toUpperCase(); // "XI TKJ 2" -> "XITKJ2"
}
function formatKelasShow(s = "") {
  return String(s || "-");
}
function wib(dt) {
  try {
    return new Date(dt).toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dt || "-");
  }
}

// ===== Helpers
async function getUserByPhone(phone) {
  return prisma.user.findUnique({ where: { phone } });
}

function ensureGuru(user) {
  const role = (user?.role ?? "").toString().trim().toUpperCase();
  if (role !== "GURU") {
    const err = new Error("ROLE_FORBIDDEN");
    err.code = "ROLE_FORBIDDEN";
    throw err;
  }
}

const fmtWIB = (d) =>
  new Date(d).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

function buildRecapText(s) {
  return (
    `📋 *Rangkuman Tugas*\n` +
    `• Kode: *${s.kode ?? "-"}*\n` +
    `• Judul: ${s.judul ?? "-"}\n` +
    `• Deskripsi: ${s.deskripsi ?? "-"}\n` +
    `• Wajib PDF (siswa): ${s.lampirPdf === "ya" ? "Ya" : "Tidak"}\n` +
    `• Penilaian Otomatis: ${
      s.penilaianOtomatis === "ya" ? "Ya 🟢" : "Tidak (manual)"
    }\n` +
    `• Deadline: ${
      s.deadlineHari ? `${s.deadlineHari} hari` : "Belum diatur"
    }\n` +
    `• Kelas: ${s.kelas ?? "-"}\n` +
    (s.guruPdfReceived
      ? `• PDF Guru: *${s.guruPdfName || "terlampir"}*\n`
      : "") +
    (s.kunciJawabanReceived
      ? `• Kunci Jawaban: *${s.kunciJawabanName || "terlampir"}* 🔑\n`
      : "")
  );
}

// ===== Wizard: kirim intro + FORM
async function handleGuruBuatPenugasan(message, { user, entities, waClient }) {
  let state = (await getState(user.phone)) || { lastIntent: null, slots: {} };
  const freshStart = state.lastIntent !== "guru_buat_penugasan";

  state.lastIntent = "guru_buat_penugasan";

  // init slot
  if (freshStart || !state.slots) {
    state.slots = {
      kode: null,
      judul: null,
      deskripsi: null,
      lampirPdf: null, // 'ya' | 'tidak' → juga berarti siswa wajib PDF
      penilaianOtomatis: null, // 'ya' | 'tidak' → apakah pakai auto-grading
      deadlineHari: null, // integer hari
      kelas: entities.kelas || null,

      // alur PDF guru (lampiran tugas)
      awaitingPdf: false,
      guruPdfReceived: false,
      guruPdfName: null,
      guruPdfB64: null,
      guruPdfMime: null,
      guruPdfSize: null,

      // alur kunci jawaban (untuk penilaian otomatis)
      awaitingKunciJawaban: false,
      kunciJawabanReceived: false,
      kunciJawabanName: null,
      kunciJawabanB64: null,
      kunciJawabanMime: null,
      kunciJawabanSize: null,
    };
  } else if (!state.slots.kelas && entities.kelas) {
    state.slots.kelas = entities.kelas;
  }

  await setState(user.phone, state);

  // Tampilkan form dengan format yang benar
  const s = state.slots;
  const form = `- Kode: ${s.kode ?? ""}
- Judul: ${s.judul ?? ""}
- Deskripsi: ${s.deskripsi ?? ""}
- Lampirkan PDF (ya/tidak): ${s.lampirPdf ?? ""}
- Penilaian Otomatis (ya/tidak): ${s.penilaianOtomatis ?? ""}
- Deadline: ${s.deadlineHari ?? "N"} (hari)
- Kelas: ${s.kelas ? `*${s.kelas}*` : "(ketik kelas, misal: XIITKJ2)"}`;

  await safeReply(message, 
    "🧭 *Progress pengisian form*\n" +
      "Ketik sesuai format berikut (boleh satu per satu)."
  );
  return safeSendMessage(waClient, message.from, form);
}

// ===== Parser baris "Field: nilai" (toleran kurung, spasi, awalan "- ")
function parseWizardLine(line) {
  const m = /^\s*-?\s*([a-zA-Z()[\]/ _-]+?)\s*:\s*(.+)\s*$/i.exec(line || "");
  if (!m) return null;

  let fieldRaw = m[1].toLowerCase();
  fieldRaw = fieldRaw.replace(/\([^)]*\)/g, ""); // buang "(ya/tidak)" dst
  fieldRaw = fieldRaw.replace(/\s+/g, " ").trim();

  const value = m[2].trim();
  const map = {
    kode: "kode",
    judul: "judul",
    deskripsi: "deskripsi",
    "lampirkan pdf": "lampirPdf",
    "penilaian otomatis": "penilaianOtomatis",
    deadline: "deadlineHari",
    kelas: "kelas",
  };
  const field = map[fieldRaw];
  if (!field) return null;

  // cegah placeholder
  if (field === "kelas" && /^\(ketik\s+kelas[,)]/i.test(value)) return null;

  return { field, value };
}

// ===== Handler pesan saat wizard aktif (multiline + media)
async function handleGuruWizardMessage(message, { user, waClient }) {
  let state = await getState(user.phone);
  if (!state || state.lastIntent !== "guru_buat_penugasan") return false;

  const raw = message.body || "";

  // ——— MENUNGGU PDF
  if (state.slots?.awaitingPdf) {
    if (message.hasMedia) {
      const media = await message.downloadMedia().catch(() => null);
      if (!media) {
        await safeReply(message, 
          "⚠️ Gagal mengunduh file. Coba kirim ulang PDF-nya."
        );
        return true;
      }
      const mime = media.mimetype || "";
      if (!/^application\/pdf$/i.test(mime)) {
        await safeReply(message, 
          "📎 File harus *PDF*. Kirim ulang dalam format PDF ya."
        );
        return true;
      }

      const s = state.slots || {};
      s.guruPdfReceived = true;
      s.awaitingPdf = false;
      s.guruPdfMime = mime;
      s.guruPdfB64 = media.data;
      s.guruPdfName = media.filename || "lampiran.pdf";
      s.guruPdfSize = media.filesize || null;

      state.slots = { ...s };
      await setState(user.phone, state);

      const recap = buildRecapText(s);
      await safeReply(message, 
        `✅ *PDF diterima:* ${s.guruPdfName}\n\n${recap}\n` +
          "*1.* ✅ Simpan tugas\n*0.* ❌ Batalkan"
      );
      return true;
    }

    // Ketik 0 untuk lewati/batal
    if (/^0$/i.test(raw)) {
      const s = state.slots || {};
      s.awaitingPdf = false;
      s.guruPdfReceived = false;
      s.guruPdfName = null;
      s.guruPdfB64 = null;
      s.guruPdfMime = null;
      s.guruPdfSize = null;
      s.lampirPdf = "tidak";
      state.slots = { ...s };
      await setState(user.phone, state);

      await safeReply(message, 
        "➡️ Lampiran PDF dibatalkan.\n\n*1.* ✅ Simpan tugas\n*0.* ❌ Batalkan semua"
      );
      return true;
    }

    await safeReply(message, 
      "⏳ Bot menunggu *file PDF* dari guru.\n\n" +
        "📎 Kirim file PDF sekarang (maks ~10MB)\n\n" +
        "*0.* Lewati (tidak melampirkan PDF)"
    );
    return true;
  }

  // ——— MENUNGGU KUNCI JAWABAN (untuk penilaian otomatis)
  if (state.slots?.awaitingKunciJawaban) {
    if (message.hasMedia) {
      const media = await message.downloadMedia().catch(() => null);
      if (!media) {
        await safeReply(message, 
          "⚠️ Gagal mengunduh file. Coba kirim ulang kunci jawaban PDF-nya."
        );
        return true;
      }
      const mime = media.mimetype || "";
      if (!/^application\/pdf$/i.test(mime)) {
        await safeReply(message, 
          "🔑 Kunci jawaban harus *PDF*. Kirim ulang dalam format PDF ya."
        );
        return true;
      }

      const s = state.slots || {};
      s.kunciJawabanReceived = true;
      s.awaitingKunciJawaban = false;
      s.kunciJawabanMime = mime;
      s.kunciJawabanB64 = media.data;
      s.kunciJawabanName = media.filename || "kunci_jawaban.pdf";
      s.kunciJawabanSize = media.filesize || null;

      state.slots = { ...s };
      await setState(user.phone, state);

      const recap = buildRecapText(s);
      await safeReply(message, 
        `✅ *Kunci jawaban diterima:* ${s.kunciJawabanName} 🔑\n\n${recap}\n` +
          "*1.* ✅ Simpan tugas\n*0.* ❌ Batalkan"
      );
      return true;
    }

    // Ketik 0 untuk lewati/batal kunci jawaban
    if (/^0$/i.test(raw)) {
      const s = state.slots || {};
      s.awaitingKunciJawaban = false;
      s.kunciJawabanReceived = false;
      s.kunciJawabanName = null;
      s.kunciJawabanB64 = null;
      s.kunciJawabanMime = null;
      s.kunciJawabanSize = null;
      s.penilaianOtomatis = "tidak";
      state.slots = { ...s };
      await setState(user.phone, state);

      await safeReply(message, 
        "➡️ Kunci jawaban dibatalkan. Tugas akan dinilai *manual* oleh guru.\n\n" +
          "*1.* ✅ Simpan tugas\n*0.* ❌ Batalkan semua"
      );
      return true;
    }

    await safeReply(message, 
      "⏳ Bot menunggu *kunci jawaban PDF*.\n" +
        "🔑 Kirim file PDF sekarang\n\n" +
        "*0.* Lewati (penilaian manual)"
    );
    return true;
  }

  // Perintah batalkan semua (0 tanpa sedang menunggu PDF)
  if (/^0$/i.test(raw)) {
    await clearState(user.phone);
    await safeReply(message, "❎ Pembuatan penugasan dibatalkan.");
    return true;
  }

  // Perintah simpan (1)
  if (/^1$/i.test(raw)) {
    const s = state.slots || {};
    const missing = [];
    if (!s.kode) missing.push("Kode");
    if (!s.judul) missing.push("Judul");
    if (!s.deskripsi) missing.push("Deskripsi");
    if (!s.kelas || !/^(X|XI|XII)[A-Z]{2,8}\d{1,2}$/i.test(String(s.kelas))) {
      missing.push("Kelas");
    }

    // Validasi lampiran PDF guru (opsional)
    if (s.lampirPdf === "ya" && !s.guruPdfReceived) {
      s.awaitingPdf = true;
      state.slots = { ...s };
      await setState(user.phone, state);
      await safeReply(message, 
        "⏳ Bot menunggu *file PDF* dari guru.\n\n" +
          "📎 Kirim file PDF sekarang (maks ~10MB)\n" +
          "*0.* Lewati (tidak melampirkan PDF)"
      );
      return true;
    }

    // Validasi kunci jawaban (wajib jika penilaian otomatis)
    if (s.penilaianOtomatis === "ya" && !s.kunciJawabanReceived) {
      s.awaitingKunciJawaban = true;
      state.slots = { ...s };
      await setState(user.phone, state);
      await safeReply(message, 
        "⏳ Bot menunggu *kunci jawaban PDF*.\n\n" +
          "🔑 Kirim file PDF sekarang\n" +
          "*0.* Lewati (penilaian manual)"
      );
      return true;
    }

    if (missing.length) {
      await safeReply(message, 
        `⚠️ Field belum lengkap: ${missing.join(", ")}.\n\n` +
          "Lengkapi dulu, lalu ketik *1* untuk simpan."
      );
      return true;
    }

    // guard duplikat (final)
    const kodeFinal = String(s.kode).toUpperCase();
    const kelasFinal = String(s.kelas).toUpperCase();
    const dup = await prisma.assignment.findUnique({
      where: { kode: kodeFinal },
    });
    if (dup) {
      await safeReply(message, 
        [
          `🚫 *Tugas dengan kode ${kodeFinal} sudah ada.*`,
          `• Kode: *${dup.kode}*`,
          `• Judul: ${dup.judul}`,
          `• Kelas: ${dup.kelas}`,
          `• Deadline: ${dup.deadline ? fmtWIB(dup.deadline) : "Belum diatur"}`,
          "",
          "Silakan ubah dengan *kode baru*.",
          "Ketik misal: `Kode: MTK124` lalu *1* untuk simpan. ✏️",
        ].join("\n")
      );
      return true;
    }

    // deadline → N hari dari sekarang
    let deadline = null;
    if (s.deadlineHari) {
      const n = parseInt(String(s.deadlineHari).replace(/\D/g, ""), 10);
      if (!isNaN(n) && n > 0) deadline = new Date(Date.now() + n * 86400000);
    }

    const deskripsiFinal =
      s.deskripsi +
      (s.lampirPdf === "ya"
        ? "\n\n[Wajib melampirkan PDF saat pengumpulan]"
        : "");

    // === Upload PDF guru (jika ada) ===
    let pdfUrl = null;
    if (s.guruPdfReceived && s.guruPdfB64 && s.guruPdfMime) {
      const safeKode = String(kodeFinal || "TANPAKODE").replace(
        /[^A-Za-z0-9_-]/g,
        ""
      );
      const ts = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .slice(0, 14); // YYYYMMDDhhmmss
      const baseName = s.guruPdfName?.toLowerCase().endsWith(".pdf")
        ? s.guruPdfName
        : `${safeKode}.pdf`;
      const fileName = `${safeKode}_${ts}_${baseName}`; // contoh: RPL1_20250919_141530_tugas.pdf

      const buffer = Buffer.from(s.guruPdfB64, "base64");
      pdfUrl = await uploadPDFtoSupabase(buffer, fileName, s.guruPdfMime);
    }

    // === Upload Kunci Jawaban (jika ada) ===
    let kunciJawabanUrl = null;
    if (s.kunciJawabanReceived && s.kunciJawabanB64 && s.kunciJawabanMime) {
      const safeKode = String(kodeFinal || "TANPAKODE").replace(
        /[^A-Za-z0-9_-]/g,
        ""
      );
      const ts = new Date()
        .toISOString()
        .replace(/[-:TZ.]/g, "")
        .slice(0, 14);
      const baseName = s.kunciJawabanName?.toLowerCase().endsWith(".pdf")
        ? s.kunciJawabanName
        : `${safeKode}_kunci.pdf`;
      const fileName = `kunci_${safeKode}_${ts}_${baseName}`;

      const buffer = Buffer.from(s.kunciJawabanB64, "base64");
      kunciJawabanUrl = await uploadPDFtoSupabase(
        buffer,
        fileName,
        s.kunciJawabanMime
      );
    }

    try {
      const created = await prisma.assignment.create({
        data: {
          kode: kodeFinal,
          judul: s.judul,
          deskripsi: deskripsiFinal,
          deadline,
          kelas: kelasFinal,
          guruId: user.id,
          pdfUrl: pdfUrl || null,
          kunciJawaban: kunciJawabanUrl || null, // Kunci jawaban untuk auto-grading
        },
      });

      // status siswa
      const siswa = await prisma.user.findMany({
        where: { role: "siswa", kelas: created.kelas },
      });
      if (siswa.length) {
        await prisma.assignmentStatus.createMany({
          data: siswa.map((st) => ({
            siswaId: st.id,
            tugasId: created.id,
            status: "BELUM_SELESAI",
          })),
          skipDuplicates: true,
        });
      }

      // Simpan state untuk opsi kirim tugas
      state.lastIntent = "guru_after_create";
      state.slots = {
        createdKode: created.kode,
        createdKelas: created.kelas,
      };
      console.log(
        "🔵 [wizard] Saving guru_after_create state with phone:",
        user.phone
      );
      console.log("🔵 [wizard] State to save:", JSON.stringify(state));
      await setState(user.phone, state);

      let recap =
        `✅ *Tugas berhasil dibuat!*\n` +
        `• Kode: *${created.kode}*${kunciJawabanUrl ? " 🟢" : ""}\n` +
        `• Judul: ${created.judul}\n` +
        `• Kelas: ${created.kelas}\n` +
        `• Penilaian: ${kunciJawabanUrl ? "*Otomatis* 🤖" : "Manual"}\n` +
        `• Deadline: ${
          created.deadline ? fmtWIB(created.deadline) : "Belum diatur"
        }\n`;
      if (s.guruPdfReceived) recap += `• PDF Guru: *${s.guruPdfName}*\n`;
      if (s.kunciJawabanReceived)
        recap += `• Kunci Jawaban: *${s.kunciJawabanName}* 🔑\n`;

      recap += `\n📌 *Pilih aksi:*\n`;
      recap += `*1.* 📣 Kirim tugas ke kelas ${created.kelas}\n`;
      recap += `*2.* 🏠 Kembali ke menu utama`;

      await safeReply(message, recap);
      return true;
    } catch (err) {
      // balapan → P2002
      if (err.code === "P2002") {
        const existing = await prisma.assignment.findUnique({
          where: { kode: kodeFinal },
        });
        if (existing) {
          await safeReply(message, 
            [
              `🚫 *Tugas dengan kode ${kodeFinal} sudah ada.*`,
              `• Kode: *${existing.kode}*`,
              `• Judul: ${existing.judul}`,
              `• Kelas: ${existing.kelas}`,
              `• Deadline: ${
                existing.deadline ? fmtWIB(existing.deadline) : "Belum diatur"
              }`,
              "",
              "Silakan ubah dengan *kode baru*.",
              "Ketik misal: `Kode: MTK124` lalu *1* untuk simpan. ✏️",
            ].join("\n")
          );
          return true;
        }
      }
      throw err;
    }
  }

  // === Multiline: proses semua baris valid
  const lines = raw.split(/\r?\n/);
  let updated = 0;
  let s = { ...(state.slots || {}) };
  const prev = { ...(state.slots || {}) };

  for (const line of lines) {
    const parsed = parseWizardLine(line);
    if (!parsed) continue;

    if (parsed.field === "kode") {
      // Support berbagai format kode:
      // 1. MTK-01, RPL_02 (huruf + angka dengan separator)
      // 2. MTK01, RPL02 (huruf + angka tanpa separator)
      // 3. PAKYON, TUGAS1 (huruf saja atau kombinasi bebas)
      const rawKode = parsed.value.trim();
      
      // Coba pattern huruf+angka dulu
      const m = /\b([a-z]{2,8})[-_]?(\d{1,4})\b/i.exec(rawKode);
      if (m) {
        s.kode = `${m[1].toUpperCase()}_${m[2]}`;
        updated++;
      } else {
        // Fallback: terima kode alfanumerik bebas (min 3 karakter)
        const cleanKode = rawKode.replace(/[^a-zA-Z0-9_-]/g, "").toUpperCase();
        if (cleanKode.length >= 3) {
          s.kode = cleanKode;
          updated++;
        }
      }
    } else if (parsed.field === "lampirPdf") {
      s.lampirPdf = /^(ya|yes|y)$/i.test(parsed.value) ? "ya" : "tidak";
      updated++;
      if (s.lampirPdf === "ya") {
        s.awaitingPdf = true;
        s.guruPdfReceived = false;
        s.guruPdfName = null;
        s.guruPdfB64 = null;
        s.guruPdfMime = null;
        s.guruPdfSize = null;
      }
    } else if (parsed.field === "penilaianOtomatis") {
      s.penilaianOtomatis = /^(ya|yes|y)$/i.test(parsed.value) ? "ya" : "tidak";
      updated++;
      if (s.penilaianOtomatis === "ya") {
        s.awaitingKunciJawaban = true;
        s.kunciJawabanReceived = false;
        s.kunciJawabanName = null;
        s.kunciJawabanB64 = null;
        s.kunciJawabanMime = null;
        s.kunciJawabanSize = null;
      }
    } else if (parsed.field === "deadlineHari") {
      const n = parseInt(parsed.value.replace(/\D/g, ""), 10);
      s.deadlineHari = isNaN(n) ? null : n;
      updated++;
    } else if (parsed.field === "kelas") {
      const rawKelas = parsed.value;
      if (!/^[()]/.test(rawKelas)) {
        s.kelas = rawKelas.replace(/\s+/g, "").toUpperCase();
        updated++;
      }
    } else {
      s[parsed.field] = parsed.value;
      updated++;
    }
  }

  // cek duplikat kode segera setelah update
  if (updated > 0) {
    if (s.kode && s.kode !== prev.kode) {
      const kodeCheck = String(s.kode).toUpperCase();
      const existed = await prisma.assignment.findUnique({
        where: { kode: kodeCheck },
      });
      if (existed) {
        // batalkan perubahan kode → kembali ke prev
        s.kode = prev.kode || null;

        state.slots = { ...(state.slots || {}), ...s };
        await setState(user.phone, state);

        await safeReply(message, 
          [
            `🚫 *Tugas dengan kode ${kodeCheck} sudah ada.*`,
            `• Kode: *${existed.kode}*`,
            `• Judul: ${existed.judul}`,
            `• Kelas: ${existed.kelas}`,
            `• Deadline: ${
              existed.deadline ? fmtWIB(existed.deadline) : "Belum diatur"
            }`,
            "",
            "Silakan ubah dengan *kode baru*.",
            "Ketik misal: `Kode: MTK124` lalu *1* untuk simpan. ✏️",
          ].join("\n")
        );

        if (s.awaitingPdf && !s.guruPdfReceived) {
          await safeReply(message, 
            "📎 *Lampirkan PDF di pesan berikutnya.* Kirim file *PDF* (maks ~10MB)."
          );
        }
        return true;
      }
    }

    state.slots = { ...(state.slots || {}), ...s };
    await setState(user.phone, state);

    if (s.awaitingPdf && !s.guruPdfReceived) {
      await safeReply(message, 
        "📎 *Lampirkan PDF di pesan berikutnya.*\n" +
          "Kirim file *PDF* (maks ~10MB).\n" +
          "*0.* Lewati (tidak melampirkan PDF)"
      );
      return true;
    }

    await safeReply(message, 
      `✔️ *${updated} field* disimpan.\n\n*1.* ✅ Simpan tugas\n*0.* ❌ Batalkan`
    );
    return true;
  }

  // tangkap PDF walau belum mode menunggu
  if (message.hasMedia) {
    const media = await message.downloadMedia().catch(() => null);
    if (media && /^application\/pdf$/i.test(media.mimetype || "")) {
      const s2 = state.slots || {};
      s2.lampirPdf = "ya";
      s2.awaitingPdf = false;
      s2.guruPdfReceived = true;
      s2.guruPdfName = media.filename || "lampiran.pdf";
      s2.guruPdfB64 = media.data;
      s2.guruPdfMime = media.mimetype;
      s2.guruPdfSize = media.filesize || null;

      state.slots = { ...s2 };
      await setState(user.phone, state);

      const recap = buildRecapText(s2);
      await safeReply(message, 
        `✅ *PDF diterima:* ${s2.guruPdfName}\n\n${recap}\n` +
          "*1.* ✅ Simpan tugas\n*0.* ❌ Batalkan"
      );
      return true;
    }
  }

  await safeReply(message, 
    "❓ Format tidak dikenali. Gunakan format: *Field: nilai* (misal: `Kode: BD-03`).\n" +
      "Contoh kirim sekaligus:\n" +
      "- Kode: MTK123\n- Judul: Tugas MTK\n- Deskripsi: …\n- Lampirkan PDF: ya\n- Deadline: 3\n- Kelas: XIITKJ2\n\n" +
      "*1.* ✅ Simpan tugas | *0.* ❌ Batalkan"
  );
  return true;
}

// ===== Broadcast tugas (teks ke siswa diperjelas)
async function handleGuruBroadcast(message, { entities, waClient, user }) {
  const phoneKey = normalizePhone(phoneFromJid(message.from));

  // Cek apakah sudah dalam wizard broadcast
  const currentState = await getState(phoneKey);

  // Jika sudah dalam wizard dan ada pilihan
  if (currentState?.lastIntent === "guru_broadcast_wizard") {
    const raw = (message.body || "").trim();
    const tugasList = currentState.slots?.tugasList || [];

    // Opsi 0 = batal
    if (raw === "0") {
      await clearState(phoneKey);
      await setState(phoneKey, { menuMode: "guru_menu_selection" });
      return safeReply(message, 
        "❌ Broadcast dibatalkan.\n\n" +
          "Ketik angka untuk memilih menu lain, atau *0* untuk keluar."
      );
    }

    // Cek apakah input adalah nomor valid
    const choice = parseInt(raw, 10);
    if (isNaN(choice) || choice < 1 || choice > tugasList.length) {
      return safeReply(message, 
        `⚠️ Pilihan tidak valid. Ketik angka *1-${tugasList.length}* atau *0* untuk batal.`
      );
    }

    // Ambil tugas yang dipilih
    const selectedTugas = tugasList[choice - 1];
    const { kode, kelas } = selectedTugas;

    // Clear state
    await clearState(phoneKey);

    // Lakukan broadcast
    const asg = await prisma.assignment.findUnique({
      where: { kode },
      include: { guru: true },
    });

    if (!asg) {
      return safeReply(message, `❌ Tugas *${kode}* tidak ditemukan.`);
    }

    const siswa = await prisma.user.findMany({
      where: { role: "siswa", kelas },
    });

    if (!siswa.length) {
      return safeReply(message, `ℹ️ Tidak ada siswa di kelas *${kelas}*.`);
    }

    const guruNama = asg.guru?.nama || "Guru";

    // Build broadcast message
    let header = `📢 *Tugas dari ${guruNama}*\n\n`;
    header += `🔖 *Kode:* ${asg.kode}\n`;
    header += `📚 *Judul:* ${asg.judul}\n`;
    header += `🗓️ *Deadline:* ${
      asg.deadline ? fmtWIB(asg.deadline) : "Belum ditentukan"
    }\n`;

    // Tambahkan link lampiran PDF guru (bukan kunci jawaban)
    if (asg.pdfUrl) {
      header += `📎 *Lampiran:* ${asg.pdfUrl}\n`;
    }

    header += `\n🧭 *Cara mengumpulkan:*\n`;
    header += `1) Ketik: *kumpul ${asg.kode}*\n`;

    let sent = 0;
    for (const s of siswa) {
      if (!s.phone) continue;
      const jid = `${s.phone}@c.us`;
      try {
        await safeSendMessage(waClient, jid, header);
        sent++;
      } catch (e) {
        console.error("broadcast fail to", jid, e.message);
      }
    }

    return safeReply(message, 
      `✅ Tugas *${asg.kode}* berhasil dikirim ke *${sent}* siswa di kelas *${kelas}*! 📣\n\n` +
        `Ketik *halo* untuk kembali ke menu utama.`
    );
  }

  // Jika belum dalam wizard, tampilkan daftar tugas guru
  const guru = user || (await getGuruByJid(message.from));
  if (!guru) {
    return safeReply(message, "🔒 Fitur ini khusus *Guru*.");
  }

  const tugas = await prisma.assignment.findMany({
    where: { guruId: guru.id },
    select: { kode: true, judul: true, kelas: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (!tugas.length) {
    return safeReply(message, 
      "ℹ️ Kamu belum punya tugas. Buat tugas dulu dengan menu *1. Buat Tugas Baru*."
    );
  }

  // Simpan state wizard
  await setState(phoneKey, {
    lastIntent: "guru_broadcast_wizard",
    slots: { tugasList: tugas },
  });

  // Tampilkan daftar tugas
  let teks = "📢 *Pilih Tugas untuk Broadcast:*\n";
  tugas.forEach((t, i) => {
    teks += `\n*${i + 1}.* ${t.kode} — ${t.judul} (${t.kelas || "-"})`;
  });
  teks += `\n\n*0.* ❌ Batal\n`;
  teks += `\n📌 *Balas dengan angka* untuk memilih tugas.`;

  return safeReply(message, teks);
}

// --- List Siswa: Tampilkan daftar kelas guru lalu siswa per kelas ---
async function handleGuruListSiswa(message, { user }) {
  const phoneKey = normalizePhone(phoneFromJid(message.from));

  // Cek apakah sudah dalam wizard list siswa
  const currentState = await getState(phoneKey);

  // Jika sudah dalam wizard dan ada pilihan
  if (currentState?.lastIntent === "guru_listsiswa_wizard") {
    const raw = (message.body || "").trim();
    const kelasList = currentState.slots?.kelasList || [];

    // Opsi 0 = batal
    if (raw === "0") {
      await clearState(phoneKey);
      await setState(phoneKey, { menuMode: "guru_menu_selection" });
      return safeReply(message, 
        "❌ Dibatalkan.\n\n" +
          "Ketik angka untuk memilih menu lain, atau *0* untuk keluar."
      );
    }

    // Cek apakah input adalah nomor valid
    const choice = parseInt(raw, 10);

    if (isNaN(choice) || choice < 1 || choice > kelasList.length) {
      return safeReply(message, 
        `⚠️ Pilihan tidak valid. Ketik angka *1-${kelasList.length}* atau *0* untuk batal.`
      );
    }

    // Clear state
    await clearState(phoneKey);
    await setState(phoneKey, { menuMode: "guru_menu_selection" });

    // Ambil kelas yang dipilih
    const selectedKelas = kelasList[choice - 1];

    // Query siswa
    const siswaList = await prisma.user.findMany({
      where: {
        role: "siswa",
        kelas: selectedKelas,
      },
      select: { nama: true, phone: true, kelas: true },
      orderBy: [{ nama: "asc" }],
      take: 200,
    });

    if (!siswaList.length) {
      return safeReply(message, `ℹ️ Tidak ada siswa di kelas *${selectedKelas}*.`);
    }

    // Format output
    let teks = `👥 *Daftar Siswa - ${selectedKelas}*\n`;
    teks += `📊 Total: ${siswaList.length} siswa\n\n`;

    siswaList.forEach((s, i) => {
      teks += `${i + 1}. ${s.nama || "-"}\n`;
    });

    teks += `\nKetik *halo* untuk kembali ke menu.`;

    return safeReply(message, teks);
  }

  // Jika belum dalam wizard, tampilkan daftar kelas
  const guru = user || (await getGuruByJid(message.from));
  if (!guru) {
    return safeReply(message, "🔒 Fitur ini khusus *Guru*.");
  }

  // Ambil daftar kelas unik dari tugas yang pernah dibuat guru
  const tugasKelas = await prisma.assignment.findMany({
    where: { guruId: guru.id },
    select: { kelas: true },
    distinct: ["kelas"],
  });

  const kelasList = tugasKelas
    .map((t) => t.kelas)
    .filter((k) => k) // filter null/empty
    .sort();

  if (!kelasList.length) {
    return safeReply(message, 
      "ℹ️ Kamu belum punya tugas di kelas manapun.\n" +
        "Buat tugas dulu dengan menu *1. Buat Tugas Baru*."
    );
  }

  // Simpan state wizard
  await setState(phoneKey, {
    lastIntent: "guru_listsiswa_wizard",
    slots: { kelasList },
  });

  // Tampilkan daftar kelas
  let teks = "👥 *Pilih Kelas untuk Lihat Daftar Siswa:*\n";
  kelasList.forEach((k, i) => {
    teks += `\n*${i + 1}.* 🏫 ${k}`;
  });
  teks += `\n\n*0.* ❌ Batal\n`;
  teks += `\n📌 *Balas dengan angka* untuk memilih.`;

  return safeReply(message, teks);
}

// --- Rekap Excel: Tampilkan list tugas untuk dipilih ---
async function handleGuruRekapExcel(message, { user, excelUtil }) {
  const phoneKey = normalizePhone(phoneFromJid(message.from));

  // Cek apakah sudah dalam wizard rekap
  const currentState = await getState(phoneKey);

  // Jika sudah dalam wizard dan ada pilihan
  if (currentState?.lastIntent === "guru_rekap_wizard") {
    const raw = (message.body || "").trim();
    const tugasList = currentState.slots?.tugasList || [];

    // Opsi 0 = batal
    if (raw === "0") {
      await clearState(phoneKey);
      await setState(phoneKey, { menuMode: "guru_menu_selection" });
      return safeReply(message, 
        "❌ Rekap dibatalkan.\n\n" +
          "Ketik angka untuk memilih menu lain, atau *0* untuk keluar."
      );
    }

    // Cek apakah input adalah nomor valid
    const choice = parseInt(raw, 10);
    if (isNaN(choice) || choice < 1 || choice > tugasList.length) {
      return safeReply(message, 
        `⚠️ Pilihan tidak valid. Ketik angka *1-${tugasList.length}* atau *0* untuk batal.`
      );
    }

    // Ambil tugas yang dipilih
    const selectedTugas = tugasList[choice - 1];
    const { kode, kelas } = selectedTugas;

    // Clear state
    await clearState(phoneKey);

    // Kirim notifikasi sedang memproses
    await safeReply(message, `⏳ Sedang membuat rekap untuk tugas *${kode}*...`);

    // Generate Excel rekap
    try {
      // Ambil data assignment
      const assignment = await prisma.assignment.findFirst({
        where: { kode, kelas },
        select: {
          id: true,
          kode: true,
          judul: true,
          deadline: true,
          kelas: true,
        },
      });

      if (!assignment) {
        return safeReply(message, `❌ Tugas *${kode}* tidak ditemukan.`);
      }

      // Parallel query
      const [students, statuses, submissions] = await Promise.all([
        prisma.user.findMany({
          where: { role: "siswa", kelas },
          select: { id: true, nama: true, phone: true },
          orderBy: [{ nama: "asc" }],
        }),
        prisma.assignmentStatus.findMany({
          where: { tugasId: assignment.id },
          select: { siswaId: true, status: true },
        }),
        prisma.assignmentSubmission.findMany({
          where: { tugasId: assignment.id },
          select: {
            siswaId: true,
            pdfUrl: true,
            createdAt: true,
            evaluation: true,
            grade: true,
            score: true,
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      if (!students.length) {
        return safeReply(message, `ℹ️ Tidak ada siswa di kelas *${kelas}*.`);
      }

      // Build maps
      const stBySiswa = new Map(statuses.map((st) => [st.siswaId, st.status]));
      const subBySiswa = new Map();
      for (const sub of submissions) {
        if (!subBySiswa.has(sub.siswaId)) {
          subBySiswa.set(sub.siswaId, sub);
        }
      }

      // Generate Excel menggunakan excelUtil
      const deadlineStr = assignment.deadline
        ? new Date(assignment.deadline).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })
        : "—";

      const rows = students.map((s) => {
        const status = stBySiswa.get(s.id) || "BELUM_SELESAI";
        const sub = subBySiswa.get(s.id);
        return {
          kelas: assignment.kelas || kelas,
          nama: s.nama || `Siswa ${s.id}`,
          phone: s.phone || "",
          kode: assignment.kode,
          judul: assignment.judul,
          deadline: deadlineStr,
          status,
          submittedAt: sub?.createdAt
            ? new Date(sub.createdAt).toLocaleString("id-ID", {
                timeZone: "Asia/Jakarta",
              })
            : "",
          url: sub?.pdfUrl || "",
          evaluation: sub?.evaluation || "",
          grade: sub?.grade ?? "",
          score:
            sub?.score !== null && sub?.score !== undefined ? sub.score : "",
        };
      });

      // Hitung statistik
      const sudahKumpul = rows.filter((r) => r.status === "SELESAI").length;
      const belumKumpul = rows.length - sudahKumpul;

      // Generate Excel file
      const buffer = await excelUtil.generateRekapExcel({
        assignment,
        rows,
        kelas,
      });

      // Kirim file Excel via WhatsApp
      const media = new MessageMedia(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer.toString("base64"),
        `rekap_${kode}_${kelas}.xlsx`
      );

      await safeReply(message, media, null, {
        caption:
          `📊 *Rekap Tugas ${kode}*\n\n` +
          `📚 Judul: ${assignment.judul}\n` +
          `🏫 Kelas: ${kelas}\n` +
          `👥 Total Siswa: ${rows.length}\n` +
          `✅ Sudah Kumpul: ${sudahKumpul}\n` +
          `❌ Belum Kumpul: ${belumKumpul}\n\n` +
          `Ketik *halo* untuk kembali ke menu.`,
      });

      return;
    } catch (err) {
      console.error("🔴 [guru_rekap] Error generating Excel:", err);
      return safeReply(message, 
        `❌ Gagal membuat rekap: ${err.message}\n\n` +
          `Silakan coba lagi dengan memilih menu *3*.`
      );
    }
  }

  // Jika belum dalam wizard, tampilkan daftar tugas guru
  const guru = user || (await getGuruByJid(message.from));
  if (!guru) {
    return safeReply(message, "🔒 Fitur ini khusus *Guru*.");
  }

  const tugas = await prisma.assignment.findMany({
    where: { guruId: guru.id },
    select: { kode: true, judul: true, kelas: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  if (!tugas.length) {
    return safeReply(message, 
      "ℹ️ Kamu belum punya tugas. Buat tugas dulu dengan menu *1. Buat Tugas Baru*."
    );
  }

  // Simpan state wizard
  await setState(phoneKey, {
    lastIntent: "guru_rekap_wizard",
    slots: { tugasList: tugas },
  });

  // Tampilkan daftar tugas
  let teks = "📊 *Pilih Tugas untuk Rekap Excel:*\n";
  tugas.forEach((t, i) => {
    teks += `\n*${i + 1}.* ${t.kode} — ${t.judul} (${t.kelas || "-"})`;
  });
  teks += `\n\n*0.* ❌ Batal\n`;
  teks += `\n📌 *Balas dengan angka* untuk memilih tugas.`;

  return safeReply(message, teks);
}

// --- Langkah 1: mulai wizard / daftar kode tugas milik guru (OLD - kept for backward compatibility) ---
async function startRekapWizard(message) {
  const guru = await getGuruByJid(message.from);
  if (!guru) {
    return safeReply(message, 
      "👋 Hai! Fitur ini khusus *guru*. Jika belum punya akun guru, silakan daftar dulu di https://kinantiku.com ✨"
    );
  }

  const tugas = await prisma.assignment.findMany({
    where: { guruId: guru.id },
    select: { kode: true, judul: true, kelas: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  await setState(guru.phone, { lastIntent: "guru_rekap_wizard" });

  if (!tugas.length) {
    return safeReply(message, 
      "ℹ️ Kamu belum punya tugas yang terdata. Buat dulu ya. 🙂"
    );
  }

  let teks = "📚 *Daftar Tugas Kamu* (pilih salah satu kodenya):\n";
  tugas.forEach((t, i) => {
    teks += `\n${i + 1}. *${t.kode}* — ${t.judul} (${formatKelasShow(
      t.kelas
    )})`;
  });
  teks += `\n\nKetik *kode tugas* yang ingin direkap. Contoh: _${tugas[0].kode}_`;

  REKAP_WIZ.set(message.from, { step: "pick_code", guruId: guru.id });
  await safeReply(message, teks);
}

// --- Langkah 2: setelah guru ketik kode → minta kelas ---
async function onPickCode(message, excelUtil) {
  const state = REKAP_WIZ.get(message.from);
  const kode = String(message.body || "")
    .trim()
    .toUpperCase();

  const tugas = await prisma.assignment.findFirst({
    where: { kode, guruId: state.guruId },
    select: { id: true, kode: true, judul: true, kelas: true },
  });

  if (!tugas) {
    return safeReply(message, 
      "😕 Kode tugas tidak ditemukan di daftar kamu. Ketik lagi ya (pastikan sesuai)."
    );
  }

  REKAP_WIZ.set(message.from, { ...state, step: "pick_class", kode });

  // Jika tugas punya kelas bawaan, tetap minta konfirmasi kelas (bisa beda paralel)
  let teks = `✅ Kode *${tugas.kode}* — ${tugas.judul}\n`;
  teks += "Kelas mana yang ingin direkap? (contoh: *XITKJ2* atau *XI TKJ 2*)";
  return safeReply(message, teks);
}

// --- Langkah 3: setelah guru ketik kelas → kirim rekap belum kumpul + Excel ---
async function onPickClass(message, excelUtil) {
  const state = REKAP_WIZ.get(message.from);
  const kelasRaw = String(message.body || "").trim();
  const kelas = normKelas(kelasRaw);
  REKAP_WIZ.delete(message.from);

  // Ambil tugas by kode (punya guru ini)
  const tugas = await prisma.assignment.findFirst({
    where: { kode: state.kode },
    select: { id: true, kode: true, judul: true, kelas: true },
  });
  if (!tugas) {
    REKAP_WIZ.delete(message.from);
    return safeReply(message, 
      "😕 Tugasnya tidak ditemukan. Ulangi perintah *rekap* ya."
    );
  }

  // Ambil roster kelas
  const siswaKelas = await prisma.user.findMany({
    where: {
      role: "siswa",
      kelas: { contains: kelas.replace(/\s/g, ""), mode: "insensitive" },
    },
    select: { id: true, nama: true, kelas: true },
    orderBy: { nama: "asc" },
  });
  if (!siswaKelas.length) {
    REKAP_WIZ.delete(message.from);
    return safeReply(message, `ℹ️ Tidak ada siswa di kelas *${kelasRaw}*.`);
  }

  // Ambil status & submission
  const stList = await prisma.assignmentStatus.findMany({
    where: { tugasId: tugas.id, siswaId: { in: siswaKelas.map((s) => s.id) } },
    include: { siswa: true },
  });
  const subList = await prisma.assignmentSubmission.findMany({
    where: { tugasId: tugas.id, siswaId: { in: siswaKelas.map((s) => s.id) } },
    select: { siswaId: true, submittedAt: true },
  });
  const subMap = new Map(subList.map((s) => [s.siswaId, s.submittedAt]));

  // Tentukan yang belum kumpul
  // Catatan: kalau status belum ada sama sekali, kita anggap BELUM kumpul
  const statusBySiswa = new Map(
    stList.map((st) => [st.siswaId, String(st.status).toUpperCase()])
  );
  const belum = siswaKelas.filter((s) => statusBySiswa.get(s.id) !== "SELESAI");

  // Kirim daftar text
  if (!belum.length) {
    await safeReply(message, 
      `🎉 Semua siswa *${kelasRaw}* sudah mengumpulkan untuk *${tugas.kode}* — ${tugas.judul}.`
    );
  } else {
    let teks = `📋 *Belum Mengumpulkan* — *${tugas.kode}* (${tugas.judul})\nKelas: *${kelasRaw}*\n`;
    belum.forEach((s, i) => {
      teks += `\n${i + 1}. ${s.nama}`;
    });
    await safeReply(message, teks);
  }

  // Susun data Excel (lengkap: Kelas, Siswa, Kode, Judul, Status, Waktu)
  const rows = siswaKelas.map((s) => {
    const status = statusBySiswa.get(s.id) || "BELUM_SELESAI";
    const submittedAt = subMap.get(s.id) || null;
    return {
      Kelas: s.kelas || "-",
      Siswa: s.nama || "-",
      Kode: tugas.kode,
      Judul: tugas.judul,
      Status: status,
      Waktu: submittedAt ? new Date(submittedAt) : "-", // excelUtil akan format kalau Date
    };
  });

  const buffer = await excelUtil.buildRekap(rows);
  const media = new MessageMedia(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    Buffer.from(buffer).toString("base64"),
    `rekap_${tugas.kode}_${kelas}.xlsx`
  );
  await safeReply(message, media);

  const guru = await getGuruByJid(message.from);
  if (guru?.phone) await clearState(guru.phone);
}

// --- Router kecil untuk fitur rekap (LEGACY - hanya untuk shortcut "rekap <KODE>") ----
async function routeGuruRekap(message, { intent, entities, excelUtil }) {
  const body = String(message.body || "").trim();
  // >>> ADD: suport batal untuk legacy wizard
  if (REKAP_WIZ.has(message.from) && /^batal$/i.test(body)) {
    REKAP_WIZ.delete(message.from);
    // hapus state wizard
    const guru = await getGuruByJid(message.from);
    if (guru?.phone) await clearState(guru.phone);
    return safeReply(message, "❎ Wizard rekap dibatalkan.");
  }
  // 1) Kalau sedang di legacy wizard (REKAP_WIZ Map), teruskan step
  if (REKAP_WIZ.has(message.from)) {
    const { step } = REKAP_WIZ.get(message.from);
    if (step === "pick_code") return onPickCode(message, excelUtil);
    if (step === "pick_class") return onPickClass(message, excelUtil);
  }

  // NOTE: guru_rekap_excel sekarang ditangani oleh handleGuruRekapExcel (wizard baru dengan pilih angka)
  // Jangan tangkap intent guru_rekap_excel di sini, biarkan handler baru yang jalan
  // if (
  //   intent === "guru_rekap_excel" ||
  //   intent === "guru_rekap" ||
  //   /^rekap\s*$/i.test(body)
  // ) {
  //   return startRekapWizard(message);
  // }

  // 3) Shortcut: "rekap <KODE>" → langsung minta kelas
  const m = body.match(/^rekap\s+([^\s]+)$/i);
  if (m) {
    const guru = await getGuruByJid(message.from);
    if (!guru) {
      return safeReply(message, 
        "👋 Hai! Fitur ini khusus *guru*. Jika belum punya akun guru, silakan daftar dulu di https://kinantiku.com ✨"
      );
    }
    REKAP_WIZ.set(message.from, {
      step: "pick_class",
      guruId: guru.id,
      kode: String(m[1]).toUpperCase(),
    });
    return safeReply(message, 
      "Oke! Kelas mana yang ingin direkap? (contoh: *XITKJ2* atau *XI TKJ 2*)"
    );
  }

  return false; // tidak ditangani, biarkan handler lain jalan
}

// ===== Entry point fitur2 guru
async function handleGuruCommand(
  message,
  { waClient, entities, intent, excelUtil }
) {
  // ❌ Tolak grup: hanya chat pribadi
  const jid = String(message.from || "");
  if (/@g\.us$/i.test(jid)) {
    await safeReply(message, 
      "👋 Fitur guru hanya tersedia di *chat pribadi* dengan bot.\n" +
        "Silakan lanjutkan via pesan langsung, ya. 🙏"
    );
    return;
  }

  // Ambil nomor pengirim (chat pribadi → @c.us) dan normalisasi ke 62…
  const phoneRaw = jid.replace(/@c\.us$/i, "");
  const phoneKey = normalizePhone(phoneRaw);
  console.log("🔵 [handleGuruCommand] phoneKey:", phoneKey);

  const user = await getUserByPhone(phoneKey);
  console.log("🔵 [handleGuruCommand] user:", user ? user.nama : "null");

  const takenByRekap = await routeGuruRekap(message, { intent, excelUtil });
  if (takenByRekap !== false) return;

  try {
    ensureGuru(user);
  } catch (e) {
    console.log("🔵 [handleGuruCommand] ensureGuru error:", e.code);
    if (e.code === "ROLE_FORBIDDEN") {
      return safeReply(message, "🔒 Fitur ini khusus *Guru*.");
    }
    throw e;
  }

  // prioritas wizard - gunakan phoneKey untuk konsistensi dengan server.js
  const currentState = await getState(phoneKey);
  console.log(
    "🔵 [handleGuruCommand] currentState:",
    JSON.stringify(currentState)
  );

  // Handler untuk setelah buat tugas (pilih kirim atau kembali ke menu)
  if (currentState?.lastIntent === "guru_after_create") {
    console.log("🔵 [guru_after_create] Handler triggered");
    console.log("🔵 [guru_after_create] waClient available:", !!waClient);
    const raw = (message.body || "").trim();
    const { createdKode, createdKelas } = currentState.slots || {};
    console.log(
      "🔵 [guru_after_create] raw:",
      raw,
      "createdKode:",
      createdKode,
      "createdKelas:",
      createdKelas
    );

    if (/^1$/.test(raw)) {
      console.log(
        "🔵 [guru_after_create] User chose option 1 - sending to class"
      );

      try {
        console.log("� [guru_after_create] Fetching assignment...");
        // Kirim tugas ke kelas - tanpa retry untuk simplifikasi
        const asg = await prisma.assignment.findUnique({
          where: { kode: createdKode },
          include: { guru: true },
        });
        console.log(
          "🔵 [guru_after_create] Assignment found:",
          asg ? asg.kode : "null"
        );

        if (!asg) {
          await clearState(phoneKey);
          return safeReply(message, 
            `❌ Kode tugas *${createdKode}* tidak ditemukan.`
          );
        }

        console.log("🔵 [guru_after_create] Fetching students...");
        const siswa = await prisma.user.findMany({
          where: { role: "siswa", kelas: createdKelas },
        });
        console.log("🔵 [guru_after_create] Students found:", siswa.length);

        if (!siswa.length) {
          await clearState(phoneKey);
          return safeReply(message, 
            `ℹ️ Tidak ada siswa di kelas *${createdKelas}*.`
          );
        }

        const guruNama = asg.guru?.nama || "Guru";

        // Build broadcast message
        let header = `📢 *Tugas dari ${guruNama}*\n\n`;
        header += `🔖 *Kode:* ${asg.kode}\n`;
        header += `📚 *Judul:* ${asg.judul}\n`;
        header += `🗓️ *Deadline:* ${
          asg.deadline ? fmtWIB(asg.deadline) : "Belum ditentukan"
        }\n`;

        // Tambahkan link lampiran PDF guru (bukan kunci jawaban)
        if (asg.pdfUrl) {
          header += `📎 *Lampiran:* ${asg.pdfUrl}\n`;
        }

        header += `\n🧭 *Cara mengumpulkan:*\n`;
        header += `1) Ketik: *kumpul ${asg.kode}*\n`;

        console.log("🔵 [guru_after_create] Sending to students...");
        let sent = 0;
        for (const st of siswa) {
          if (!st.phone) continue;
          const jidSiswa = `${st.phone}@c.us`;
          try {
            await safeSendMessage(waClient, jidSiswa, header);
            sent++;
            console.log(`🔵 [guru_after_create] Sent to ${jidSiswa}`);
          } catch (sendErr) {
            console.error(
              `🔴 [guru_after_create] Failed to send to ${jidSiswa}:`,
              sendErr.message
            );
          }
        }

        console.log("🔵 [guru_after_create] Clearing state and replying...");
        await clearState(phoneKey);
        await safeReply(message, 
          `✅ Tugas *${createdKode}* berhasil dikirim ke *${sent}* siswa di kelas *${createdKelas}*! 📣\n\n` +
            `Ketik *halo* untuk kembali ke menu utama.`
        );
        console.log("🔵 [guru_after_create] Done!");
        return;
      } catch (err) {
        console.error("🔴 [guru_after_create] Error:", err);
        return safeReply(message, 
          `❌ *Gagal mengirim tugas:* ${err.message}\n\n` +
            `Silakan coba lagi dengan mengetik *1* untuk kirim, atau *2* untuk kembali ke menu.`
        );
      }
    }

    if (/^2$/.test(raw)) {
      // Kembali ke menu utama
      await clearState(phoneKey);

      // Set ke menu mode
      await setState(phoneKey, { menuMode: "guru_menu_selection" });

      const userName = user.nama || "Guru";
      const menuGuru =
        `👋 Halo, *${userName}*!\n\n` +
        `Selamat datang di *Kinanti Bot*.\n\n` +
        `📚 *Menu Guru:*\n` +
        `*1.* 📝 Buat Tugas Baru\n` +
        `*2.* 📢 Broadcast Tugas ke Kelas\n` +
        `*3.* 📊 Rekap Excel Pengumpulan\n` +
        `*4.* 👥 Lihat Daftar Siswa\n` +
        `*5.* 🖼️ Gambar ke PDF\n` +
        `*6.* ❓ Bantuan\n` +
        `*0.* 🚪 Keluar\n\n` +
        `📌 *Balas dengan angka* untuk memilih menu.`;
      return safeReply(message, menuGuru);
    }

    // Input tidak valid
    return safeReply(message, 
      `⚠️ Pilihan tidak valid.\n\n` +
        `*1.* 📣 Kirim tugas ke kelas ${createdKelas}\n` +
        `*2.* 🏠 Kembali ke menu utama`
    );
  }

  // Handler untuk broadcast wizard (pilih tugas untuk broadcast)
  if (currentState?.lastIntent === "guru_broadcast_wizard") {
    return handleGuruBroadcast(message, { entities, waClient, user });
  }

  // Handler untuk rekap wizard (pilih tugas untuk rekap Excel)
  if (currentState?.lastIntent === "guru_rekap_wizard") {
    return handleGuruRekapExcel(message, { user, excelUtil });
  }

  // Handler untuk list siswa wizard (pilih kelas untuk lihat daftar siswa)
  if (currentState?.lastIntent === "guru_listsiswa_wizard") {
    return handleGuruListSiswa(message, { user });
  }

  if (currentState?.lastIntent === "guru_buat_penugasan") {
    const handled = await handleGuruWizardMessage(message, { user, waClient });
    if (handled) return;
  }

  // raw trigger buat tugas
  if (/^buat\s+tugas(\s+baru)?$/i.test(message.body || "")) {
    return handleGuruBuatPenugasan(message, { user, entities, waClient });
  }

  // intent starter dari NLP
  if (intent === "guru_buat_penugasan") {
    return handleGuruBuatPenugasan(message, { user, entities, waClient });
  }
  // if (
  //   intent === "guru_rekap_belum_kumpul" || // intent dari NLP (opsional)
  //   /^rekap\s+\S+/i.test(String(message.body || "")) // fallback ketik manual
  // ) {
  //   return handleGuruRekapBelumKumpul(message, { entities });
  // }

  // fitur lain
  switch (intent) {
    case "guru_broadcast_tugas":
      return handleGuruBroadcast(message, { entities, waClient, user });

    case "guru_rekap_excel":
      return handleGuruRekapExcel(message, { user, excelUtil });

    case "guru_list_siswa":
      return handleGuruListSiswa(message, { user });

    case "guru_help": {
      // Tampilkan bantuan dan kontak admin
      const bantuanTeks =
        `❓ *Bantuan Kinanti Bot*\n\n` +
        `📚 *Daftar Menu:*\n` +
        `*1.* 📝 Buat Tugas Baru\n` +
        `*2.* 📢 Broadcast Tugas ke Kelas\n` +
        `*3.* 📊 Rekap Excel Pengumpulan\n` +
        `*4.* 👥 Lihat Daftar Siswa\n` +
        `*5.* 🖼️ Gambar ke PDF\n` +
        `*6.* ❓ Bantuan\n` +
        `*0.* 🚪 Keluar\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `📞 *Kontak Admin Kinanti:*\n` +
        `wa.me/62895378394020\n\n` +
        `Jika ada kendala terkait penggunaan atau ada yang ingin ditanyakan, silakan hubungi nomor admin di atas.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Ketik *halo* untuk kembali ke menu utama.`;
      return safeReply(message, bantuanTeks);
    }

    default:
      return;
  }
}

module.exports = { handleGuruCommand };
