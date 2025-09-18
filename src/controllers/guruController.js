// src/controllers/guruController.js
const prisma = require("../config/prisma");
const { MessageMedia } = require("whatsapp-web.js");
const { getState, setState, clearState } = require("../services/state");
const { normalizePhone } = require("../utils/phone");

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
    `• Deadline: ${
      s.deadlineHari ? `${s.deadlineHari} hari` : "Belum diatur"
    }\n` +
    `• Kelas: ${s.kelas ?? "-"}\n` +
    (s.guruPdfReceived ? `• PDF Guru: *${s.guruPdfName || "terlampir"}*\n` : "")
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
      deadlineHari: null, // integer hari
      kelas: entities.kelas || null,

      // alur PDF guru
      awaitingPdf: false,
      guruPdfReceived: false,
      guruPdfName: null,
      guruPdfB64: null,
      guruPdfMime: null,
      guruPdfSize: null,
    };
  } else if (!state.slots.kelas && entities.kelas) {
    state.slots.kelas = entities.kelas;
  }

  await setState(user.phone, state);

  await message.reply(
    "📝 *Mulai buat penugasan*\n" +
      "Ketik sesuai format berikut (boleh satu per satu).\n" +
      "Jika sudah lengkap, balas: *simpan* (atau *batal* untuk membatalkan)."
  );

  const s = state.slots;
  const form = `- Kode: ${s.kode ?? ""}
- Judul: ${s.judul ?? ""}
- Deskripsi: ${s.deskripsi ?? ""}
- Lampirkan PDF (ya/tidak): ${s.lampirPdf ?? ""}
- Deadline: ${s.deadlineHari ?? "N"} (hari)
- Kelas: ${s.kelas ? `*${s.kelas}*` : "(ketik kelas, misal: XIITKJ2)"}`;

  return waClient.sendMessage(message.from, form);
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
        await message.reply(
          "⚠️ Gagal mengunduh file. Coba kirim ulang PDF-nya."
        );
        return true;
      }
      const mime = media.mimetype || "";
      if (!/^application\/pdf$/i.test(mime)) {
        await message.reply(
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
      await message.reply(
        `✅ *PDF diterima:* ${s.guruPdfName}\n\n${recap}\n` +
          "Jika sudah siap, ketik *simpan* untuk menyelesaikan. 💾"
      );
      return true;
    }

    if (/^lewati$/i.test(raw)) {
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

      await message.reply(
        "➡️ Lampiran PDF dibatalkan. Kamu bisa lanjut isi field lain atau ketik *simpan* jika sudah lengkap."
      );
      return true;
    }

    await message.reply(
      "⏳ Bot sedang menunggu *file PDF* dari guru. Kirim file PDF sekarang, atau ketik *lewati* untuk batal melampirkan."
    );
    return true;
  }

  // progress form bila ketik "buat tugas" lagi
  if (/^buat\s+tugas(\s+baru)?$/i.test(raw)) {
    const s = state.slots || {};
    const form = `- Kode: ${s.kode ?? ""}
- Judul: ${s.judul ?? ""}
- Deskripsi: ${s.deskripsi ?? ""}
- Lampirkan PDF (ya/tidak): ${s.lampirPdf ?? ""}
- Deadline: ${s.deadlineHari ?? "N"} (hari)
- Kelas: ${s.kelas ? `*${s.kelas}*` : "(ketik kelas, misal: XIITKJ2)"}`;
    await message.reply(
      "🧭 *Progress pengisian form*\nKetik sesuai format berikut (boleh satu per satu).\n" +
        "Jika sudah lengkap, balas: *simpan* (atau *batal* untuk membatalkan)."
    );
    await message.reply(form);
    return true;
  }

  // perintah khusus
  if (/^(batal|cancel)$/i.test(raw)) {
    await clearState(user.phone);
    await message.reply("❎ Pembuatan penugasan dibatalkan.");
    return true;
  }

  if (/^simpan$/i.test(raw)) {
    const s = state.slots || {};
    const missing = [];
    if (!s.kode) missing.push("Kode");
    if (!s.judul) missing.push("Judul");
    if (!s.deskripsi) missing.push("Deskripsi");
    if (!s.kelas || !/^(X|XI|XII)[A-Z]{2,8}\d{1,2}$/i.test(String(s.kelas))) {
      missing.push("Kelas");
    }
    if (s.lampirPdf === "ya" && !s.guruPdfReceived) {
      await message.reply(
        "📎 Kamu memilih *Lampirkan PDF: ya*.\n" +
          "Kirim file PDF sekarang (maks ~10MB), lalu ketik *simpan* lagi. Atau ketik *lewati* jika batal melampirkan."
      );
      s.awaitingPdf = true;
      state.slots = { ...s };
      await setState(user.phone, state);
      return true;
    }
    if (missing.length) {
      await message.reply(
        `⚠️ Field belum lengkap: ${missing.join(", ")}.\n` +
          "Lengkapi dulu, lalu ketik *simpan*."
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
      await message.reply(
        [
          `🚫 *Tugas dengan kode ${kodeFinal} sudah ada.*`,
          `• Kode: *${dup.kode}*`,
          `• Judul: ${dup.judul}`,
          `• Kelas: ${dup.kelas}`,
          `• Deadline: ${dup.deadline ? fmtWIB(dup.deadline) : "Belum diatur"}`,
          "",
          "Silakan membuat tugas dengan *kode baru*.",
          "Ketik misal: `Kode: MTK124` lalu *simpan* lagi. ✏️",
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

    // const pdfUrl = await uploadToStorageAndGetUrl(s.guruPdfName, s.guruPdfB64, s.guruPdfMime);
    const pdfUrl = null;

    try {
      const created = await prisma.assignment.create({
        data: {
          kode: kodeFinal,
          judul: s.judul,
          deskripsi: deskripsiFinal,
          deadline,
          kelas: kelasFinal,
          guruId: user.id,
          // pdfUrl: pdfUrl || null,
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

      await clearState(user.phone); // keluar wizard

      let recap =
        `✅ *Tugas berhasil dibuat!*\n` +
        `• Kode: *${created.kode}*\n` +
        `• Judul: ${created.judul}\n` +
        `• Kelas: ${created.kelas}\n` +
        `• Deadline: ${
          created.deadline ? fmtWIB(created.deadline) : "Belum diatur"
        }\n`;
      if (s.guruPdfReceived) recap += `• PDF Guru: *${s.guruPdfName}*\n`;
      recap += `\nUntuk mengirim ke siswa: ketik *kirim ${created.kode} ${created.kelas}* 📣`;

      await message.reply(recap);
      return true;
    } catch (err) {
      // balapan → P2002
      if (err.code === "P2002") {
        const existing = await prisma.assignment.findUnique({
          where: { kode: kodeFinal },
        });
        if (existing) {
          await message.reply(
            [
              `🚫 *Tugas dengan kode ${kodeFinal} sudah ada.*`,
              `• Kode: *${existing.kode}*`,
              `• Judul: ${existing.judul}`,
              `• Kelas: ${existing.kelas}`,
              `• Deadline: ${
                existing.deadline ? fmtWIB(existing.deadline) : "Belum diatur"
              }`,
              "",
              "Silakan membuat tugas dengan *kode baru*.",
              "Ketik misal: `Kode: MTK124` lalu *simpan* lagi. ✏️",
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
      const m = /\b([a-z]{2,8})[-_]?(\d{1,4})\b/i.exec(parsed.value);
      if (!m) continue;
      s.kode = `${m[1].toUpperCase()}-${m[2]}`;
      updated++;
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

        await message.reply(
          [
            `🚫 *Tugas dengan kode ${kodeCheck} sudah ada.*`,
            `• Kode: *${existed.kode}*`,
            `• Judul: ${existed.judul}`,
            `• Kelas: ${existed.kelas}`,
            `• Deadline: ${
              existed.deadline ? fmtWIB(existed.deadline) : "Belum diatur"
            }`,
            "",
            "Silakan membuat tugas dengan *kode baru*.",
            "Ketik misal: `Kode: MTK124` lalu *simpan* jika sudah lengkap. ✏️",
          ].join("\n")
        );

        if (s.awaitingPdf && !s.guruPdfReceived) {
          await message.reply(
            "📎 *Lampirkan PDF di pesan berikutnya.* Kirim file *PDF* (maks ~10MB)."
          );
        }
        return true;
      }
    }

    state.slots = { ...(state.slots || {}), ...s };
    await setState(user.phone, state);

    if (s.awaitingPdf && !s.guruPdfReceived) {
      await message.reply(
        "📎 *Lampirkan PDF di pesan berikutnya.*\n" +
          "Kirim file *PDF* (maks ~10MB). Setelah terkirim, bot akan menampilkan rangkuman dan kamu bisa ketik *simpan*."
      );
      return true;
    }

    await message.reply(
      `✔️ *${updated} field* disimpan. Ketik *simpan* jika sudah lengkap, atau lanjut isi field lain.`
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
      await message.reply(
        `✅ *PDF diterima:* ${s2.guruPdfName}\n\n${recap}\n` +
          "Jika sudah siap, ketik *simpan* untuk menyelesaikan. 💾"
      );
      return true;
    }
  }

  await message.reply(
    "❓ Format tidak dikenali. Gunakan format: *Field: nilai* (misal: `Kode: BD-03`).\n" +
      "Contoh kirim sekaligus:\n" +
      "- Kode: MTK123\n- Judul: Tugas MTK\n- Deskripsi: …\n- Lampirkan PDF: ya\n- Deadline: 3\n- Kelas: XIITKJ2\n\n" +
      "Ketik *simpan* jika sudah lengkap atau *batal* untuk membatalkan."
  );
  return true;
}

// ===== Broadcast tugas (teks ke siswa diperjelas)
async function handleGuruBroadcast(message, { entities, waClient }) {
  const { kode_tugas, kelas } = entities;
  if (!kode_tugas || !kelas) {
    return message.reply(
      'Butuh *kode_tugas* dan *kelas*. Contoh: "kirim tugas BD-03 untuk XIITKJ2".'
    );
  }

  const asg = await prisma.assignment.findUnique({
    where: { kode: kode_tugas.toUpperCase() },
    include: { guru: true },
  });
  if (!asg)
    return message.reply(`❌ Kode tugas *${kode_tugas}* tidak ditemukan.`);

  const siswa = await prisma.user.findMany({ where: { role: "siswa", kelas } });
  if (!siswa.length)
    return message.reply(`ℹ️ Tidak ada siswa di kelas *${kelas}*.`);

  const mustPdf = /\[Wajib melampirkan PDF/i.test(asg.deskripsi || "");
  const guruNama = asg.guru?.nama || "Guru";

  const header =
    `📢 *Tugas dari ${guruNama}*\n` +
    `🔖 *Kode:* ${asg.kode}\n` +
    `📚 *Judul:* ${asg.judul}\n` +
    `📝 *Deskripsi:*\n${asg.deskripsi || "-"}\n` +
    (asg.deadline
      ? `🗓️ *Deadline:* ${fmtWIB(asg.deadline)}\n`
      : `🗓️ *Deadline:* Belum diatur\n`) +
    (asg.pdfUrl
      ? `📎 *Lampiran PDF guru:* ${asg.pdfUrl}\n`
      : `📎 *Lampiran PDF guru:* -\n`) +
    `🧾 *Harus mengumpulkan PDF:* ${mustPdf ? "Ya" : "Tidak"}\n\n` +
    `🧭 *Cara mengumpulkan:*\n` +
    `1) Balas chat ini dengan: *kumpul ${asg.kode}*\n` +
    `2) ${
      mustPdf
        ? "Lampirkan *PDF* tugasmu (maks ~10MB)"
        : "Kirim jawaban sesuai instruksi guru"
    }\n` +
    `3) Tekan kirim dan tunggu konfirmasi ✅`;

  for (const s of siswa) {
    const jid = `${s.phone}@c.us`;
    try {
      await waClient.sendMessage(jid, header);
      // // Jika nanti pdfUrl aktif dan ingin kirim file:
      // if (asg.pdfUrl) {
      //   const media = await MessageMedia.fromUrl(asg.pdfUrl);
      //   await waClient.sendMessage(jid, media, { caption: `📎 Lampiran: ${asg.judul}` });
      // }
    } catch (e) {
      console.error("broadcast fail to", jid, e.message);
    }
  }

  return message.reply(
    `✅ Broadcast *${asg.kode}* terkirim ke kelas *${kelas}* (${siswa.length} siswa).`
  );
}

// ===== Rekap excel (tetap)
async function handleGuruRekapExcel(message, { entities, excelUtil }) {
  const kelas = entities.kelas || null;
  const siswa = await prisma.user.findMany({
    where: { role: "siswa", ...(kelas ? { kelas } : {}) },
    orderBy: { nama: "asc" },
  });
  if (!siswa.length)
    return message.reply(
      `ℹ️ Tidak ada siswa${kelas ? ` di kelas *${kelas}*` : ""}.`
    );

  const assignments = await prisma.assignment.findMany({
    ...(kelas ? { where: { kelas } } : {}),
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const rows = [];
  for (const st of await prisma.assignmentStatus.findMany({
    where: {
      siswaId: { in: siswa.map((s) => s.id) },
      tugasId: { in: assignments.map((a) => a.id) },
    },
    include: { tugas: true, siswa: true },
  })) {
    rows.push({
      Kelas: st.siswa.kelas || "-",
      Siswa: st.siswa.nama,
      Kode: st.tugas.kode,
      Judul: st.tugas.judul,
      Status: st.status,
    });
  }

  const buffer = await excelUtil.buildRekap(rows);
  const media = new MessageMedia(
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer.toString("base64"),
    `rekap_${kelas || "all"}.xlsx`
  );
  await message.reply(media);
  return;
}

// ===== Entry point fitur2 guru
async function handleGuruCommand(
  message,
  { waClient, entities, intent, excelUtil }
) {
  // ❌ Tolak grup: hanya chat pribadi
  const jid = String(message.from || "");
  if (/@g\.us$/i.test(jid)) {
    await message.reply(
      "👋 Fitur guru hanya tersedia di *chat pribadi* dengan bot.\n" +
        "Silakan lanjutkan via pesan langsung, ya. 🙏"
    );
    return;
  }

  // Ambil nomor pengirim (chat pribadi → @c.us) dan normalisasi ke 62…
  const phoneRaw = jid.replace(/@c\.us$/i, "");
  const phoneKey = normalizePhone(phoneRaw);
  const user = await getUserByPhone(phoneKey);

  try {
    ensureGuru(user);
  } catch (e) {
    if (e.code === "ROLE_FORBIDDEN") {
      return message.reply("🔒 Fitur ini khusus *Guru*.");
    }
    throw e;
  }

  // prioritas wizard
  const currentState = await getState(user.phone);
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

  // fitur lain
  switch (intent) {
    case "guru_broadcast_tugas":
      return handleGuruBroadcast(message, { entities, waClient });

    case "guru_rekap_excel":
      return handleGuruRekapExcel(message, { entities, excelUtil });

    case "guru_list_siswa": {
      const kelas = entities.kelas || null;
      const list = await prisma.user.findMany({
        where: { role: "siswa", ...(kelas ? { kelas } : {}) },
        orderBy: { nama: "asc" },
        take: 200,
      });
      if (!list.length)
        return message.reply(
          `ℹ️ Tidak ada siswa${kelas ? ` di kelas *${kelas}*` : ""}.`
        );
      const lines = list.map(
        (s, i) => `${i + 1}. ${s.nama} — ${s.kelas || "-"}`
      );
      return message.reply(
        `👥 Daftar siswa${kelas ? ` ${kelas}` : ""}:\n` + lines.join("\n")
      );
    }

    default:
      return;
  }
}

module.exports = { handleGuruCommand };
