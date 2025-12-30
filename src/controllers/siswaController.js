// src/controllers/siswaController.js
// Fitur Siswa: daftar tugas, detail tugas, status tugas, dan kumpul tugas (unggah PDF ke Supabase)
// + Fitur Umum: Greeting (halo/assalamualaikum) untuk guru & siswa, serta nomor belum terdaftar.

const prismaMod = require("../config/prisma");
const prisma = prismaMod?.prisma ?? prismaMod?.default ?? prismaMod;
const { uploadPDFtoSupabase } = require("../utils/pdfUtils");
const { getState, setState, clearState } = require("../services/state");
const { normalizePhone } = require("../utils/phone");

// ========== State pengumpulan (in-memory) ==========
// key = JID pengirim → { step: "await_pdf", assignmentId: <tugas.id>, assignmentKode, requirePdf }
const PENDING = new Map();

// ========== Quotes semangat (acak) ==========
const QUOTES = [
  "Belajar itu maraton, bukan sprint. Pelan tapi konsisten! 🏃‍♂️",
  "Setiap hari adalah kesempatan baru buat jadi lebih keren dari kemarin. ✨",
  "Jangan takut salah, karena dari situ kita naik level. 🎮",
  "Sedikit demi sedikit, lama-lama jadi bukit. Keep going! ⛰️",
  "Ilmu itu bekal, mimpi itu bensin. Gas terus! ⛽🚀",
];

// ========== Utils ==========
function isGroupJid(jid = "") {
  return String(jid).endsWith("@g.us");
}
function phoneFromJid(jid = "") {
  return String(jid || "").replace(/@c\.us$/i, "");
}
function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    "_" +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}
function fmtDateWIB(dt) {
  try {
    const d = new Date(dt);
    const fmt = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    return fmt.format(d);
  } catch {
    return String(dt || "-");
  }
}
function matchAny(text, arr) {
  const s = (text || "").toLowerCase();
  return arr.some((k) => s.includes(k));
}
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ========== Data helpers ==========
async function getUserBySender(senderJid) {
  const phone = phoneFromJid(senderJid);
  return prisma.user.findFirst({ where: { phone } });
}
async function getStudentBySender(senderJid) {
  const phone = phoneFromJid(senderJid);
  return prisma.user.findFirst({
    where: { phone, role: "siswa" },
    select: { id: true, nama: true, phone: true, kelas: true }, // Include kelas
  });
}

// Daftar tugas BELUM_SELESAI (untuk menu "tugas saya")
async function listOpenAssignments(student) {
  // Filter berdasarkan siswaId, status, dan kelas siswa
  const items = await prisma.assignmentStatus.findMany({
    where: { siswaId: student.id, status: "BELUM_SELESAI" },
    include: { tugas: { include: { guru: true } } },
  });

  // Filter tugas yang kelasnya sesuai dengan kelas siswa
  if (student.kelas) {
    const studentKelas = String(student.kelas);
    return items.filter((item) => {
      const tugasKelas = String(item.tugas.kelas || "");
      // Cek apakah kelas tugas cocok dengan kelas siswa
      return tugasKelas === studentKelas;
    });
  }

  // Jika siswa tidak punya kelas, return semua (fallback)
  return items;
}

// Riwayat tugas (SELESAI)
async function listDoneAssignments(student) {
  const items = await prisma.assignmentStatus.findMany({
    where: { siswaId: student.id, status: "SELESAI" },
    include: { tugas: true },
    orderBy: { id: "desc" },
  });

  // Ambil submission untuk mendapatkan grade & score
  const itemsWithSubmission = await Promise.all(
    items.map(async (item) => {
      const submission = await prisma.assignmentSubmission.findFirst({
        where: { siswaId: student.id, tugasId: item.tugasId },
        select: {
          grade: true,
          score: true,
          evaluation: true,
          pdfUrl: true,
          createdAt: true,
        },
      });
      return { ...item, submission };
    })
  );

  // Filter tugas yang kelasnya sesuai dengan kelas siswa
  if (student.kelas) {
    const studentKelas = String(student.kelas);
    return itemsWithSubmission.filter((item) => {
      const tugasKelas = String(item.tugas.kelas || "");
      return tugasKelas === studentKelas;
    });
  }

  return itemsWithSubmission;
}

// Dapatkan tugas by kode (yang memang ditugaskan ke siswa tsb)
async function findAssignmentForStudentByKode(student, kode) {
  const asg = await prisma.assignment.findFirst({
    where: { kode },
    include: { guru: true },
  });
  if (!asg) return null;

  // Cek apakah kelas tugas sesuai dengan kelas siswa
  if (student.kelas) {
    const studentKelas = String(student.kelas);
    const tugasKelas = String(asg.kelas || "");
    if (tugasKelas !== studentKelas) {
      console.log(
        `⚠️ Tugas ${kode} tidak sesuai kelas. Siswa: ${studentKelas}, Tugas: ${tugasKelas}`
      );
      return null;
    }
  }

  const status = await prisma.assignmentStatus.findFirst({
    where: { tugasId: asg.id, siswaId: student.id },
  });
  if (!status) return null;

  return { assignment: asg, status };
}

// ========== Pengumpulan ==========

// Trigger penilaian otomatis via webhook n8n
async function triggerAutoGrading(
  submissionId,
  siswaId,
  tugasId,
  pdfUrl,
  answerKeyUrl,
  message
) {
  const WEBHOOK_URL =
    process.env.WEBHOOK_TUGAS_URL || "http://0.0.0.0:5678/webhook/nilai-tugas";

  try {
    console.log(`🤖 Triggering auto-grading for submission ${submissionId}...`);

    const payload = {
      id: submissionId,
      siswaId,
      tugasId,
      pdfUrl,
      answerKeyUrl,
    };

    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `Webhook POST failed (${res.status}): ${WEBHOOK_URL} - ${text}`
      );
      await message.reply(
        "⚠️ Gagal memproses penilaian otomatis. Guru akan menilai manual."
      );
      return;
    }

    console.log(`✅ Webhook POST success: ${WEBHOOK_URL}`);

    // Start background polling for grading result (non-blocking)
    // Poll in background and notify student when ready. We don't await here.
    (async () => {
      try {
        await pollGradingResult(submissionId, message, 30);
      } catch (err) {
        console.error("[triggerAutoGrading] background poll error:", err);
      }
    })();
  } catch (err) {
    console.error("[triggerAutoGrading] Error:", err);
    await message.reply(
      "⚠️ Gagal memproses penilaian otomatis. Guru akan menilai manual."
    );
  }
}

// Poll hasil penilaian dari database
async function pollGradingResult(submissionId, message, maxSeconds = 120) {
  const startTime = Date.now();
  const interval = 10000; // cek setiap 10 detik
  const maxTime = maxSeconds * 1000;

  while (Date.now() - startTime < maxTime) {
    await new Promise((resolve) => setTimeout(resolve, interval));

    try {
      const submission = await prisma.assignmentSubmission.findUnique({
        where: { id: submissionId },
        select: { evaluation: true, grade: true, score: true },
      });

      // Cek apakah sudah ada hasil (grade dan score terisi)
      if (
        submission?.grade &&
        submission?.score !== null &&
        submission?.score !== undefined
      ) {
        console.log(
          `✅ Grading result received for submission ${submissionId}`
        );

        // Format grade emoji
        const gradeEmoji = {
          A: "🌟",
          B: "⭐",
          C: "✨",
          D: "💫",
        };
        const emoji = gradeEmoji[submission.grade] || "📊";

        // Kirim hasil ke siswa
        await message.reply(
          `🎓 *HASIL PENILAIAN OTOMATIS*\n\n` +
            `${emoji} *Grade: ${submission.grade}*\n` +
            `📊 *Score: ${submission.score}/100*\n\n` +
            `💬 *Evaluasi:*\n${
              submission.evaluation || "Tidak ada catatan."
            }\n\n` +
            `Semangat terus belajarnya! 🚀`
        );
        return;
      }
    } catch (err) {
      console.error("[pollGradingResult] Error:", err);
      break;
    }
  }

  // Timeout - hasil belum tersedia
  console.warn(`⏱️ Grading timeout for submission ${submissionId}`);
  await message.reply(
    "⏱️ Penilaian memakan waktu lebih lama. Hasilnya akan diupdate nanti ya! Cek status tugas secara berkala."
  );
}

// Mulai sesi pengumpulan
async function beginSubmission(message, student, assignment) {
  const requirePdf = true; // untuk sementara wajib PDF
  // simpan state
  PENDING.set(message.from, {
    step: "await_pdf",
    assignmentId: assignment.id,
    assignmentKode: assignment.kode,
    requirePdf,
  });

  const lampiran = assignment.pdfUrl
    ? `\n📎 Lampiran dari guru: ${assignment.pdfUrl}`
    : "";

  await message.reply(
    "📝 *Pengumpulan Tugas!*\n" +
      `📌 Kode: *${assignment.kode}*\n` +
      `📖 Judul: *${assignment.judul}*\n` +
      `⏰ Deadline: ${fmtDateWIB(assignment.deadline)}\n` +
      lampiran +
      "\n\n👉 Kirim *PDF tugas* kamu di sini!\n" +
      "Kalau masih foto, balik ke menu pilih *4. Gambar ke PDF* dulu.\n\n" +
      "*0.* ❌ Batal\n\n" +
      "📌 Kirim file PDF atau ketik *0* untuk batal."
  );
}

// ========== Handler Kumpul Tugas Wizard ==========
async function handleSiswaKumpulTugas(message, { student }) {
  const phoneKey = normalizePhone(phoneFromJid(message.from));
  const currentState = await getState(phoneKey);

  // Jika sudah dalam wizard kumpul
  if (currentState?.lastIntent === "siswa_kumpul_wizard") {
    const raw = (message.body || "").trim();
    const tugasList = currentState.slots?.tugasList || [];

    // Opsi 0 = batal
    if (raw === "0") {
      PENDING.delete(message.from);
      await clearState(phoneKey);
      await setState(phoneKey, { menuMode: "siswa_menu_selection" });
      return message.reply(
        "❌ Pengumpulan dibatalkan.\n\n" +
          "Ketik angka untuk memilih menu lain, atau *0* untuk keluar."
      );
    }

    // Cek apakah input adalah nomor valid
    const choice = parseInt(raw, 10);
    if (isNaN(choice) || choice < 1 || choice > tugasList.length) {
      return message.reply(
        `⚠️ Pilihan tidak valid. Ketik angka *1-${tugasList.length}* atau *0* untuk batal.`
      );
    }

    // Ambil tugas yang dipilih
    const selectedTugas = tugasList[choice - 1];

    // Ambil data assignment lengkap
    const assignment = await prisma.assignment.findFirst({
      where: { id: selectedTugas.tugasId },
      include: { guru: true },
    });

    if (!assignment) {
      await clearState(phoneKey);
      await setState(phoneKey, { menuMode: "siswa_menu_selection" });
      return message.reply("❌ Tugas tidak ditemukan. Silakan coba lagi.");
    }

    // Mulai sesi pengumpulan
    await beginSubmission(message, student, assignment);
    return true;
  }

  // Jika belum dalam wizard, tampilkan daftar tugas belum selesai
  if (!student) {
    student = await getStudentBySender(message.from);
  }

  if (!student) {
    return message.reply(
      "📵 Nomor kamu belum terdaftar sebagai *siswa*. Daftar di https://kinantiku.com ya ✨"
    );
  }

  // Ambil tugas yang belum selesai
  const items = await listOpenAssignments(student);

  if (!items?.length) {
    await setState(phoneKey, { menuMode: "siswa_menu_selection" });
    return message.reply(
      "✅ Tidak ada tugas yang belum selesai. Mantap! 🎉\n\n" +
        "Ketik *halo* untuk kembali ke menu."
    );
  }

  // Simpan state wizard
  const tugasList = items.map((it) => ({
    tugasId: it.tugas.id,
    kode: it.tugas.kode,
    judul: it.tugas.judul,
    deadline: it.tugas.deadline,
  }));

  await setState(phoneKey, {
    lastIntent: "siswa_kumpul_wizard",
    slots: { tugasList },
  });

  // Tampilkan daftar tugas
  let teks = "📝 *Pilih Tugas untuk Dikumpul:*\n";
  items.forEach((it, i) => {
    const tg = it.tugas;
    const autoGradeIndicator = tg.kunciJawaban ? " 🟢" : "";
    teks += `\n*${i + 1}.* ${tg.kode}${autoGradeIndicator} — ${tg.judul}`;
    teks += `\n    ⏰ Deadline: ${fmtDateWIB(tg.deadline)}`;
  });
  teks += `\n\n*0.* ❌ Batal\n`;
  teks += `\n🟢 = Dinilai otomatis`;
  teks += `\n� *Balas dengan angka* untuk memilih tugas.`;

  return message.reply(teks);
}

// --- Status Wizard: tampilkan riwayat dan detail per nomor ---
async function handleSiswaStatusWizard(message, { student }) {
  const phoneKey = normalizePhone(phoneFromJid(message.from));
  const currentState = await getState(phoneKey);

  // Jika sudah dalam wizard dan ada pilihan
  if (currentState?.lastIntent === "siswa_status_wizard") {
    const raw = (message.body || "").trim();
    const list = currentState.slots?.doneList || [];

    // Opsi 0 = batal
    if (raw === "0") {
      await clearState(phoneKey);
      await setState(phoneKey, { menuMode: "siswa_menu_selection" });
      return message.reply(
        "❌ Batal.\n\nKetik angka untuk memilih menu lain, atau *0* untuk keluar."
      );
    }

    const choice = parseInt(raw, 10);
    if (isNaN(choice) || choice < 1 || choice > list.length) {
      return message.reply(
        `⚠️ Pilihan tidak valid. Ketik angka *1-${list.length}* atau *0* untuk batal.`
      );
    }

    // Tampilkan detail tugas pada indeks
    const item = list[choice - 1];
    // Ambil submission dan assignment detail
    const submission = await prisma.assignmentSubmission.findFirst({
      where: { siswaId: student.id, tugasId: item.tugasId },
      select: {
        grade: true,
        score: true,
        evaluation: true,
        pdfUrl: true,
        createdAt: true,
      },
    });

    const assignment = await prisma.assignment.findUnique({
      where: { id: item.tugasId },
      select: { kode: true, judul: true, pdfUrl: true, kunciJawaban: true },
    });

    await clearState(phoneKey);
    await setState(phoneKey, { menuMode: "siswa_menu_selection" });

    let teks = `🧾 *Detail Riwayat - ${assignment.kode}*\n\n`;
    teks += `• Judul: ${assignment.judul || "-"}\n`;
    if (submission) {
      teks += `• Grade: ${submission.grade || "-"}\n`;
      teks += `• Score: ${submission.score ?? "-"}\n`;
      teks += `• Waktu Kumpul: ${
        submission.createdAt ? fmtDateWIB(submission.createdAt) : "-"
      }\n`;
      teks += `• File: ${submission.pdfUrl || "-"}\n`;
      teks += `\n💬 *Evaluasi:*
${submission.evaluation || "Tidak ada catatan."}\n`;
    } else {
      teks += "• Tidak ada submission terdaftar.\n";
    }

    // Lampiran guru (jika ada) — jangan tampilkan kunci jawaban
    if (assignment.pdfUrl) {
      teks += `\n📎 Lampiran Guru: ${assignment.pdfUrl}\n`;
    }

    teks += `\nKetik *halo* untuk kembali ke menu.`;
    return message.reply(teks);
  }

  // Jika belum dalam wizard, tampilkan daftar riwayat dan simpan state
  if (!student) {
    student = await getStudentBySender(message.from);
  }
  if (!student) {
    return message.reply(
      "📵 Nomor kamu belum terdaftar sebagai *siswa*. Daftar di https://kinantiku.com ya ✨"
    );
  }

  const items = await listDoneAssignments(student);
  if (!items?.length) {
    await setState(phoneKey, { menuMode: "siswa_menu_selection" });
    return message.reply(
      "📭 Belum ada tugas yang dikumpul. Semangat! 💪\n\nKetik *halo* untuk kembali ke menu."
    );
  }

  // Simpan list ke state untuk pemilihan (PENTING: lastIntent harus ada untuk wizard)
  const doneList = items.map((it) => ({
    tugasId: it.tugas.id,
    kode: it.tugas.kode,
  }));
  await setState(phoneKey, {
    lastIntent: "siswa_status_wizard",
    slots: { doneList },
  });

  const gradeEmoji = { A: "🌟", B: "⭐", C: "✨", D: "💫" };
  const lines = items.slice(0, 20).map((it, i) => {
    const tg = it.tugas;
    const sub = it.submission || {};
    let gradeInfo = "";
    if (sub?.grade || sub?.score !== null) {
      const emoji = gradeEmoji[sub?.grade] || "📊";
      const gradeText = sub?.grade ? `${emoji} ${sub.grade}` : "";
      const scoreText =
        sub?.score !== null && sub?.score !== undefined ? `(${sub.score})` : "";
      gradeInfo = ` | ${gradeText}${
        gradeText && scoreText ? " " : ""
      }${scoreText}`;
    }
    return `*${i + 1}.* ${tg.kode} — ${tg.judul}${gradeInfo}`;
  });

  // Jangan timpa state wizard dengan menuMode!
  return message.reply(
    `🧾 *Riwayat Tugas Selesai:*\n\n` +
      `${lines.join("\n")}\n\n` +
      `*0.* ❌ Kembali ke Menu\n\n` +
      `📌 *Balas dengan angka* untuk lihat detail tugas.`
  );
}

/**
 * Upsert submission yang robust terhadap variasi skema:
 * - Coba composite unique siswaId_tugasId atau tugasId_siswaId
 * - Jika tidak ada, fallback: findFirst + update/create
 */
async function safeUpsertSubmission({ tugasId, siswaId, data }) {
  try {
    return await prisma.assignmentSubmission.upsert({
      where: { siswaId_tugasId: { siswaId, tugasId } },
      update: data,
      create: { tugasId, siswaId, ...data },
    });
  } catch {
    try {
      return await prisma.assignmentSubmission.upsert({
        where: { tugasId_siswaId: { tugasId, siswaId } },
        update: data,
        create: { tugasId, siswaId, ...data },
      });
    } catch {
      const existing = await prisma.assignmentSubmission.findFirst({
        where: { tugasId, siswaId },
        select: { id: true },
      });
      if (existing?.id) {
        return prisma.assignmentSubmission.update({
          where: { id: existing.id },
          data,
        });
      }
      return prisma.assignmentSubmission.create({
        data: { tugasId, siswaId, ...data },
      });
    }
  }
}

// Terima & proses PDF saat menunggu pengumpulan
async function handleMediaWhilePending(message, pending, student) {
  const mimeGuess = message._data?.mimetype || message.mimetype || "";
  const isPdfLike =
    message.type === "document" ||
    message.hasMedia ||
    /^application\/pdf$/i.test(mimeGuess);

  if (!isPdfLike) {
    await message.reply(
      "⚠️ Format belum cocok. Kirim *PDF* ya. Kalau masih foto, ketik *gambar ke pdf* dulu."
    );
    return;
  }

  try {
    const media = await message.downloadMedia();
    if (!media?.data) throw new Error("No media data");

    const buffer = Buffer.from(media.data, "base64");
    const subdir = `users/siswa/${student.phone}/submissions`;
    const origName = message._data?.filename || media?.filename || "tugas.pdf";
    const safeName = origName.toLowerCase().endsWith(".pdf")
      ? origName
      : `${origName}.pdf`;
    const fileName = `${pending.assignmentKode}_${nowStamp()}_${safeName}`;

    const url = await uploadPDFtoSupabase(
      buffer,
      fileName,
      "application/pdf",
      subdir
    );

    // Ambil data assignment untuk cek kunci jawaban
    const assignment = await prisma.assignment.findUnique({
      where: { id: pending.assignmentId },
      select: { kunciJawaban: true },
    });

    // Simpan submission + set status SELESAI
    const submissionRow = await safeUpsertSubmission({
      tugasId: pending.assignmentId,
      siswaId: student.id,
      data: {
        pdfUrl: url,
      },
    });

    await prisma.assignmentStatus.updateMany({
      where: {
        tugasId: pending.assignmentId,
        siswaId: student.id,
      },
      data: { status: "SELESAI" },
    });

    // PENTING: Clear semua state agar user bisa kembali ke menu
    PENDING.delete(message.from);
    const phoneKey = normalizePhone(phoneFromJid(message.from));
    await clearState(phoneKey);
    await setState(phoneKey, { menuMode: "siswa_menu_selection" });

    // Cek apakah tugas dinilai otomatis
    const isAutoGraded = assignment?.kunciJawaban ? true : false;

    if (isAutoGraded) {
      // Kirim notifikasi dan langsung keluarkan user
      await message.reply(
        "🎉 *Tugas sukses terkumpul!*\n" +
          `📌 Kode: *${pending.assignmentKode}*\n` +
          `📂 File: ${fileName}\n\n` +
          "🤖 *Tugas ini dinilai otomatis oleh AI*\n" +
          "⏳ Proses penilaian sedang berjalan...\n" +
          "📬 Hasilnya akan dikirim otomatis ke chat ini.\n\n" +
          "Ketik *halo* untuk kembali ke menu."
      );

      // Trigger webhook ke n8n untuk penilaian otomatis (fire-and-forget)
      triggerAutoGrading(
        submissionRow.id,
        student.id,
        pending.assignmentId,
        url,
        assignment.kunciJawaban,
        message
      ).catch((err) => {
        console.error("[siswaController] Auto-grading trigger error:", err);
      });
    } else {
      // Tugas manual
      await message.reply(
        "🎉 *Tugas sukses terkumpul!*\n" +
          `📌 Kode: *${pending.assignmentKode}*\n` +
          `📂 File: ${fileName}\n\n` +
          "Mantap! 🚀 Ketik *halo* untuk kembali ke menu."
      );
    }
  } catch (e) {
    console.error("[siswaController] upload/DB error:", e);
    await message.reply("😢 Oops, gagal simpan tugas. Coba lagi ya.");
  }
}

// ========== MENU & INTENT SEDERHANA ==========
function buildHelp(role) {
  const r = String(role || "").toLowerCase();
  if (r === "guru" || r === "teacher") {
    return (
      "📚 *Menu Guru:*\n" +
      "• *buat tugas* — buat tugas\n" +
      "• *rekap <KODE>* — rekap pengumpulan tugas\n" +
      "• *list siswa* — daftar siswa di kelas\n" +
      "• *gambar ke pdf* — ubah foto jadi PDF"
    );
  }
  // default siswa
  return (
    "🎒 *Menu Siswa:*\n" +
    "• *tugas saya* — cek tugas belum selesai\n" +
    "• *status tugas* — riwayat tugas selesai\n" +
    "• *detail <KODE>* — lihat detail tugas\n" +
    "• *kumpul <KODE>* — kumpulin tugas (PDF)\n" +
    "• *gambar ke pdf* — ubah foto jadi PDF"
  );
}

// ========== GREETING HANDLER ==========
function isGreeting(text = "") {
  const s = String(text || "")
    .trim()
    .toLowerCase();
  // Kata kunci umum salam/sapaan
  const keys = [
    "halo",
    "hallo",
    "assalamualaikum",
    "assalamu'alaikum",
    "asalamualaikum",
    "selamat pagi",
    "selamat siang",
    "selamat sore",
    "selamat malam",
    "hai",
    "hey",
    "hei",
  ];
  return keys.some((k) => s.startsWith(k));
}

// Intent matcher sederhana
function detectIntent(body = "") {
  const s = (body || "").trim().toLowerCase();
  if (isGreeting(s)) return "greeting";
  if (/^tugas\s+saya$/.test(s)) return "siswa_tugas_saya";
  if (/^status\s+tugas$/.test(s)) return "siswa_status_tugas";
  if (/^detail\s+[-\w]+/i.test(s)) return "siswa_detail_tugas";
  if (/^kumpul\s+[-\w]+/i.test(s)) return "siswa_kumpul_tugas";
  if (/^menu$|^help$|^bantuan$/.test(s)) return "siswa_help";
  return "unknown";
}

// ========== Handler utama siswa ==========
async function handleSiswaCommand(message, opts = {}) {
  try {
    console.log("\n🎓 === SISWA CONTROLLER START ===");
    console.log("📨 Message from:", message.from);
    console.log("📝 Message body:", message.body);
    console.log("🔧 Opts intent:", opts.intent);
    console.log("🔧 Opts entities:", opts.entities);

    // === NEW: Prioritaskan state PENDING lebih dulu ===
    const pending = PENDING.get(message.from);
    if (pending) {
      const bodyLower = String(message.body || "")
        .trim()
        .toLowerCase();

      // batal - support "0" juga
      if (
        bodyLower === "batal" ||
        bodyLower === "cancel" ||
        bodyLower === "0"
      ) {
        PENDING.delete(message.from);
        const phoneKey = normalizePhone(phoneFromJid(message.from));
        await clearState(phoneKey);
        await setState(phoneKey, { menuMode: "siswa_menu_selection" });
        await message.reply(
          "❌ Pengumpulan dibatalkan.\n\n" +
            "Ketik angka untuk memilih menu lain, atau *0* untuk keluar."
        );
        return;
      }

      // pastikan pengirim adalah siswa terdaftar
      const studentWhilePending = await getStudentBySender(message.from);
      if (!studentWhilePending) {
        PENDING.delete(message.from);
        await message.reply(
          "📵 Nomor kamu belum terdaftar sebagai *siswa*. Daftar di https://kinantiku.com ya ✨"
        );
        return;
      }

      // jika ada media/dokumen, proses sebagai submission
      if (
        message.hasMedia ||
        ["document", "image", "video"].includes(message.type)
      ) {
        await handleMediaWhilePending(message, pending, studentWhilePending);
        return;
      }

      // selain itu, ingatkan untuk kirim PDF
      await message.reply(
        "↪️ Kamu sedang dalam sesi *pengumpulan tugas*.\n" +
          "Silakan kirim *file PDF*-nya di sini ya.\n\n" +
          "Ketik *0* untuk batal."
      );
      return;
    }
    // === END NEW ===

    const phoneKey = normalizePhone(phoneFromJid(message.from));
    const currentState = await getState(phoneKey);

    // === Handler untuk wizard kumpul tugas ===
    if (currentState?.lastIntent === "siswa_kumpul_wizard") {
      const student = await getStudentBySender(message.from);
      return handleSiswaKumpulTugas(message, { student });
    }

    // === Handler untuk wizard status tugas (riwayat detail) ===
    if (currentState?.lastIntent === "siswa_status_wizard") {
      const student = await getStudentBySender(message.from);
      return handleSiswaStatusWizard(message, { student });
    }

    const body = String(message.body || "");
    const lbody = body.toLowerCase();
    // Gunakan intent dari NLP pipeline jika tersedia; fallback ke deteksi sederhana
    const intent = opts.intent || detectIntent(body);

    const needsStudent = () =>
      [
        "siswa_tugas_saya",
        "siswa_status_tugas",
        "siswa_detail_tugas",
        "siswa_kumpul_tugas",
      ].includes(intent) ||
      matchAny(lbody, [
        "tugas saya",
        "daftar tugas",
        "tugas belum",
        "lihat tugas",
        "list tugas",
        "status tugas",
        "riwayat tugas",
        "riwayat",
        "detail ",
        "info ",
        "kumpul ",
      ]);

    let student = null;
    if (needsStudent()) {
      student = await getStudentBySender(message.from);
      if (!student) {
        await message.reply(
          "📵 Nomor kamu belum terdaftar sebagai *siswa*. Daftar di https://kinantiku.com ya ✨"
        );
        return;
      }
    }

    // A. Daftar tugas (BELUM_SELESAI)
    if (
      intent === "siswa_list_tugas" ||
      intent === "siswa_tugas_saya" ||
      matchAny(lbody, [
        "tugas saya",
        "daftar tugas",
        "tugas belum",
        "lihat tugas",
        "list tugas",
      ])
    ) {
      const items = await listOpenAssignments(student);
      if (!items?.length) {
        await setState(phoneKey, { menuMode: "siswa_menu_selection" });
        await message.reply(
          "✅ Tidak ada tugas yang belum selesai. Mantap! 🎉\n\n" +
            "Ketik *halo* untuk kembali ke menu."
        );
        return;
      }
      const lines = items.map((it, i) => {
        const tg = it.tugas;
        // Indikator tugas dinilai otomatis (ada kunci jawaban)
        const autoGradeIndicator = tg.kunciJawaban ? " 🟢" : "";
        return (
          `*${i + 1}.* ${tg.kode}${autoGradeIndicator} — ${tg.judul}\n` +
          `    👨‍🏫 ${tg.guru?.nama || "-"} | ⏰ ${fmtDateWIB(tg.deadline)}`
        );
      });

      await setState(phoneKey, { menuMode: "siswa_menu_selection" });
      await message.reply(
        "📚 *Daftar Tugas Belum Selesai:*\n\n" +
          lines.join("\n") +
          "\n\n🟢 = Dinilai otomatis\n\n" +
          "Untuk kumpul tugas, pilih menu *3. Kumpul Tugas*\n" +
          "Ketik *halo* untuk kembali ke menu."
      );
      return;
    }

    // B. Riwayat (SELESAI)
    if (
      intent === "siswa_status_tugas" ||
      matchAny(lbody, ["status tugas", "riwayat tugas", "riwayat"])
    ) {
      return handleSiswaStatusWizard(message, { student });
    }

    // C. Kumpul Tugas (menu berbasis wizard)
    if (intent === "siswa_kumpul_tugas") {
      return handleSiswaKumpulTugas(message, { student });
    }

    // D. Detail <KODE> - untuk backward compatibility
    let detailKode = null;
    if (intent === "siswa_detail_tugas") {
      detailKode = (
        opts.entities?.kode ||
        opts.entities?.kode_tugas ||
        opts.entities?.assignmentCode ||
        ""
      )
        .toString()
        .trim();
    }
    if (!detailKode) {
      const m = lbody.match(/detail\s+([a-z0-9_-]+)/i);
      if (m) detailKode = m[1].toUpperCase();
    }
    if (detailKode) {
      const found = await findAssignmentForStudentByKode(student, detailKode);
      if (!found) {
        await message.reply(`😕 Tugas dengan kode *${detailKode}* ga ketemu.`);
        return;
      }
      const a = found.assignment;
      const lampiran = a.pdfUrl ? `\n📎 Lampiran: ${a.pdfUrl}` : "";
      await message.reply(
        "ℹ️ *Detail Tugas:*\n" +
          `• Kode: *${a.kode}*\n` +
          `• Judul: *${a.judul}*\n` +
          `• Instruksi: ${a.deskripsi || "-"}\n` +
          `• Deadline: ${fmtDateWIB(a.deadline)}${lampiran}`
      );
      return;
    }

    // D. Kumpul <KODE>
    let kumpulKode = null;
    if (intent === "siswa_kumpul_tugas") {
      console.log("✅ Intent = siswa_kumpul_tugas");
      console.log("   opts.entities:", opts.entities);
      console.log("   opts.entities?.kode:", opts.entities?.kode);
      console.log("   opts.entities?.kode_tugas:", opts.entities?.kode_tugas);
      console.log(
        "   opts.entities?.assignmentCode:",
        opts.entities?.assignmentCode
      );
      const rawKode =
        opts.entities?.kode ||
        opts.entities?.kode_tugas ||
        opts.entities?.assignmentCode;
      console.log("   rawKode result:", rawKode);
      console.log("   rawKode type:", typeof rawKode);
      console.log("   rawKode truthy?:", !!rawKode);
      if (rawKode) {
        kumpulKode = String(rawKode).trim();
        console.log("   ✅ Extracted kumpulKode from entities:", kumpulKode);
      } else {
        console.log("   ❌ rawKode is falsy, cannot extract");
      }
    }
    if (!kumpulKode) {
      const m = lbody.match(/kumpul\s+([a-z0-9_-]+)/i);
      if (m) {
        kumpulKode = m[1].toUpperCase();
        console.log("   Fallback regex matched:", kumpulKode);
      }
    }
    if (kumpulKode) {
      console.log("🔍 Searching for assignment with code:", kumpulKode);
      const found = await findAssignmentForStudentByKode(student, kumpulKode);
      if (!found) {
        console.log("❌ Assignment not found");
        await message.reply(`😕 Tugas dengan kode *${kumpulKode}* ga ketemu.`);
        return;
      }
      console.log("✅ Assignment found, starting submission");
      await beginSubmission(message, student, found.assignment);
      return;
    }
    console.log("⚠️  No kumpulKode extracted, continuing to next handler...");

    // F. Menu siswa (fallback bantuan)
    if (
      intent === "siswa_help" ||
      matchAny(lbody, ["bantuan", "help", "menu", "siswa"])
    ) {
      await setState(phoneKey, { menuMode: "siswa_menu_selection" });
      await message.reply(
        `❓ *Bantuan Kinanti Bot - Siswa*\n\n` +
          `📚 *Daftar Menu:*\n` +
          `*1.* 📚 Tugas Saya — Lihat tugas yang belum selesai\n` +
          `*2.* ✅ Status Tugas — Lihat riwayat tugas yang sudah dikumpul\n` +
          `*3.* 📝 Kumpul Tugas — Kumpulkan tugas dengan upload PDF\n` +
          `*4.* 🖼️ Gambar ke PDF — Konversi foto menjadi file PDF\n` +
          `*5.* ❓ Bantuan — Menampilkan halaman ini\n` +
          `*0.* 🚪 Keluar — Keluar dari menu\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━\n\n` +
          `📞 *Kontak Admin Kinanti:*\n` +
          `wa.me/62895378394020\n\n` +
          `Jika ada kendala, silakan hubungi nomor admin di atas.\n\n` +
          `Ketik *halo* untuk kembali ke menu utama.`
      );
      return;
    }

    // ===== Fallback =====
    console.log("❓ Reached fallback - perintah tidak dikenali");
    console.log("🎓 === SISWA CONTROLLER END (FALLBACK) ===\n");
    await setState(phoneKey, { menuMode: "siswa_menu_selection" });
    await message.reply(
      "🤷 Perintah tidak dikenali.\n\n" +
        "Ketik *halo* untuk melihat menu, atau pilih angka:\n" +
        "*1.* Tugas Saya | *2.* Status Tugas | *3.* Kumpul Tugas\n" +
        "*4.* Gambar ke PDF | *5.* Bantuan | *0.* Keluar"
    );
  } catch (e) {
    console.error("❌ handleSiswaCommand error:", e);
    await message.reply("😵 Aduh, ada error di fitur siswa. Coba lagi ya!");
  }
}

module.exports = { handleSiswaCommand };
