// src/nlp/dialogManager.js
const { getState, setState, clearState } = require("../services/state");

const SLOT_RULES = {
  siswa_kumpul_tugas: ["kode_tugas"],
  siswa_tanya_deadline: ["kode_tugas"],
  guru_broadcast_tugas: ["kode_tugas", "kelas"],
};

const SLOT_PROMPTS = {
  kode_tugas: "Kodenya berapa? (contoh: BD-03)",
  kelas: "Untuk kelas mana? (contoh: XIITKJ2 atau XI TKJ 2)",
};

async function dialogManage(userPhone, intent, entities, rawText) {
  let state = await getState(userPhone);
  if (!state) state = { lastIntent: null, slots: {} };

  const inGuruWizard = state.lastIntent === "guru_buat_penugasan";
  const isSave = /^simpan$/i.test(rawText || "");
  const isCancel = /^(batal|cancel)$/i.test(rawText || "");
  if (inGuruWizard && !isSave && !isCancel) intent = "guru_buat_penugasan";

  // Jika user sedang dalam dialog (ada lastIntent) dan:
  // 1. Intent baru adalah fallback, ATAU
  // 2. User hanya memberikan entity (misal jawab kode saja)
  //    dan lastIntent membutuhkan entity tersebut
  if (state.lastIntent) {
    const lastNeeded = SLOT_RULES[state.lastIntent] || [];
    const hasKodeEntity =
      entities.kode || entities.kode_tugas || entities.assignmentCode;

    // Jika intent fallback, lanjutkan intent lama
    if (intent === "fallback") {
      intent = state.lastIntent;
    }
    // Jika lastIntent butuh kode dan user baru kasih kode (text pendek),
    // maka override intent ke lastIntent
    else if (
      lastNeeded.includes("kode_tugas") &&
      hasKodeEntity &&
      rawText.length < 20 &&
      !/kumpul|detail|info|tugas saya|status/i.test(rawText)
    ) {
      console.log(
        "🔄 Dialog continuation: overriding intent to",
        state.lastIntent
      );
      intent = state.lastIntent;
    }
  }

  // Update lastIntent hanya jika bukan fallback
  if (intent !== "fallback") {
    state.lastIntent = intent;
  }

  // JANGAN merge entities ke slots jika dalam wizard guru
  // Wizard guru menangani slot sendiri via guruController
  if (intent !== "guru_buat_penugasan") {
    state.slots = { ...state.slots, ...entities };
  }

  if (intent === "guru_buat_penugasan") {
    await setState(userPhone, state);
    return { done: true, action: "ROUTE", to: intent, slots: state.slots };
  }

  const needed = SLOT_RULES[intent] || [];
  const missing = needed.filter((s) => {
    // Cek dengan nama slot asli dan alias
    if (state.slots[s]) return false;
    // Cek alias untuk kode_tugas
    if (
      s === "kode_tugas" &&
      (state.slots.kode || state.slots.assignmentCode)
    ) {
      // Salin ke slot utama jika belum ada
      if (!state.slots.kode_tugas && state.slots.kode) {
        state.slots.kode_tugas = state.slots.kode;
      } else if (!state.slots.kode_tugas && state.slots.assignmentCode) {
        state.slots.kode_tugas = state.slots.assignmentCode;
      }
      return false;
    }
    return true;
  });

  if (missing.length > 0) {
    await setState(userPhone, state);
    const ask = SLOT_PROMPTS[missing[0]] || "Lengkapi datanya ya.";
    return {
      done: false,
      action: "ASK_SLOT",
      askFor: missing[0],
      message: ask,
      intent,
      slots: state.slots,
    };
  }

  // Jangan clear state untuk wizard/state yang ditangani controller
  const preserveStateIntents = [
    "guru_buat_penugasan",
    "guru_after_create",
    "guru_rekap_wizard",
    "guru_broadcast_wizard",
    "guru_listsiswa_wizard",
    "siswa_kumpul_wizard",
    "siswa_imgtopdf",
    "siswa_status_wizard",
  ];

  if (
    !preserveStateIntents.includes(intent) &&
    !preserveStateIntents.includes(state.lastIntent)
  ) {
    await clearState(userPhone);
  }

  return { done: true, action: "ROUTE", to: intent, slots: state.slots };
}

module.exports = { dialogManage };
