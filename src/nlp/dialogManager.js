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

  if (state.lastIntent && intent === "fallback") intent = state.lastIntent;
  else state.lastIntent = intent;

  state.slots = { ...state.slots, ...entities };

  if (intent === "guru_buat_penugasan") {
    await setState(userPhone, state);
    return { done: true, action: "ROUTE", to: intent, slots: state.slots };
  }

  const needed = SLOT_RULES[intent] || [];
  const missing = needed.filter((s) => !state.slots[s]);

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

  await clearState(userPhone);
  return { done: true, action: "ROUTE", to: intent, slots: state.slots };
}

module.exports = { dialogManage };
