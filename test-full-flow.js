// Comprehensive test untuk debug NLP flow
const { normalize } = require("./src/nlp/normalizer");
const { extractEntities } = require("./src/nlp/entities");
const { classify } = require("./src/nlp/classifier");

// Mock dialog manager
const userStates = new Map();

async function getState(userPhone) {
  return userStates.get(userPhone) || null;
}

async function setState(userPhone, state) {
  userStates.set(userPhone, state);
}

async function clearState(userPhone) {
  userStates.delete(userPhone);
}

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

  // Jika user sedang dalam dialog (ada lastIntent)
  if (state.lastIntent) {
    const lastNeeded = SLOT_RULES[state.lastIntent] || [];
    const hasKodeEntity =
      entities.kode || entities.kode_tugas || entities.assignmentCode;

    console.log("   🔄 DIALOG CONTINUATION CHECK:");
    console.log("      lastIntent:", state.lastIntent);
    console.log("      current intent:", intent);
    console.log("      lastNeeded slots:", lastNeeded);
    console.log("      hasKodeEntity:", hasKodeEntity);
    console.log("      rawText length:", rawText.length);

    // Jika intent fallback, lanjutkan intent lama
    if (intent === "fallback") {
      console.log(
        "      → Fallback detected, continuing with",
        state.lastIntent
      );
      intent = state.lastIntent;
    }
    // Jika lastIntent butuh kode dan user baru kasih kode (text pendek)
    else if (
      lastNeeded.includes("kode_tugas") &&
      hasKodeEntity &&
      rawText.length < 20 &&
      !/kumpul|detail|info|tugas saya|status/i.test(rawText)
    ) {
      console.log("      → Override: continuing with", state.lastIntent);
      intent = state.lastIntent;
    } else {
      console.log("      → No override, using new intent:", intent);
    }
  }

  // Update lastIntent hanya jika bukan fallback
  if (intent !== "fallback") {
    state.lastIntent = intent;
  }

  state.slots = { ...state.slots, ...entities };

  if (intent === "guru_buat_penugasan") {
    await setState(userPhone, state);
    return { done: true, action: "ROUTE", to: intent, slots: state.slots };
  }

  const needed = SLOT_RULES[intent] || [];
  const missing = needed.filter((s) => {
    if (state.slots[s]) return false;
    if (
      s === "kode_tugas" &&
      (state.slots.kode || state.slots.assignmentCode)
    ) {
      if (!state.slots.kode_tugas && state.slots.kode) {
        state.slots.kode_tugas = state.slots.kode;
      } else if (!state.slots.kode_tugas && state.slots.assignmentCode) {
        state.slots.kode_tugas = state.slots.assignmentCode;
      }
      return false;
    }
    return true;
  });

  console.log("   📋 SLOT CHECK:");
  console.log("      needed:", needed);
  console.log("      current slots:", state.slots);
  console.log("      missing:", missing);

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

// Simulasi handler siswa
function handleSiswaCommand(intent, entities, body) {
  console.log("\n   🎓 SISWA HANDLER:");
  console.log("      intent:", intent);
  console.log("      entities:", entities);

  let kumpulKode = null;
  if (intent === "siswa_kumpul_tugas") {
    console.log("      ✅ Intent = siswa_kumpul_tugas");
    console.log("      entities.kode:", entities?.kode);
    console.log("      entities.kode_tugas:", entities?.kode_tugas);
    console.log("      entities.assignmentCode:", entities?.assignmentCode);

    const rawKode =
      entities?.kode || entities?.kode_tugas || entities?.assignmentCode;

    console.log("      rawKode:", rawKode);
    console.log("      rawKode type:", typeof rawKode);
    console.log("      rawKode truthy:", !!rawKode);

    if (rawKode) {
      kumpulKode = String(rawKode).trim();
      console.log("      ✅ Extracted kumpulKode:", kumpulKode);
    } else {
      console.log("      ❌ rawKode is falsy");
    }
  }

  if (!kumpulKode) {
    const m = body.toLowerCase().match(/kumpul\s+([a-z0-9_-]+)/i);
    if (m) {
      kumpulKode = m[1].toUpperCase();
      console.log("      ✅ Fallback regex matched:", kumpulKode);
    }
  }

  if (kumpulKode) {
    return `✅ SUCCESS: Will process submission for ${kumpulKode}`;
  } else {
    return "❌ FAIL: No kode extracted, reached fallback";
  }
}

// Full flow test
async function testFullFlow() {
  console.log("\n🧪 ========== FULL FLOW TEST ==========\n");

  const userPhone = "628123456789";

  // Test Case 1: Direct with code
  console.log("📝 TEST 1: saya ingin mengumpulkan tugas MTK-003");
  console.log("─".repeat(60));
  let raw = "saya ingin mengumpulkan tugas MTK-003";
  let normalized = normalize(raw);
  let entities = extractEntities(normalized);
  let { intent, score } = classify(normalized, entities);

  console.log("   Normalized:", normalized);
  console.log("   Entities:", entities);
  console.log("   Intent:", intent, "(score:", score + ")");

  let dialog = await dialogManage(userPhone, intent, entities, raw);
  console.log("   Dialog:", dialog);

  if (dialog.done) {
    let result = handleSiswaCommand(dialog.to, dialog.slots, raw);
    console.log("   Result:", result);
  } else {
    console.log("   Bot asks:", dialog.message);
  }

  // Reset
  await clearState(userPhone);

  // Test Case 2: Two-step (kumpulkan tugas → MTK-003)
  console.log("\n\n📝 TEST 2: kumpulkan tugas → MTK-003 (two-step)");
  console.log("─".repeat(60));

  // Step 1
  console.log("\n   STEP 1: kumpulkan tugas");
  raw = "kumpulkan tugas";
  normalized = normalize(raw);
  entities = extractEntities(normalized);
  ({ intent, score } = classify(normalized, entities));

  console.log("   Normalized:", normalized);
  console.log("   Entities:", entities);
  console.log("   Intent:", intent, "(score:", score + ")");

  dialog = await dialogManage(userPhone, intent, entities, raw);
  console.log("   Dialog:", dialog);

  if (dialog.done) {
    let result = handleSiswaCommand(dialog.to, dialog.slots, raw);
    console.log("   Result:", result);
  } else {
    console.log("   Bot asks:", dialog.message);
  }

  // Step 2
  console.log("\n   STEP 2: MTK-003");
  raw = "MTK-003";
  normalized = normalize(raw);
  entities = extractEntities(normalized);
  ({ intent, score } = classify(normalized, entities));

  console.log("   Normalized:", normalized);
  console.log("   Entities:", entities);
  console.log("   Intent:", intent, "(score:", score + ")");

  dialog = await dialogManage(userPhone, intent, entities, raw);
  console.log("   Dialog:", dialog);

  if (dialog.done) {
    let result = handleSiswaCommand(dialog.to, dialog.slots, raw);
    console.log("   Result:", result);
  } else {
    console.log("   Bot asks:", dialog.message);
  }

  console.log("\n\n🎯 ========== TEST COMPLETE ==========\n");
}

testFullFlow().catch(console.error);
