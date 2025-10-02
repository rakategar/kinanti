// src/services/state.js
const prisma = require("../config/prisma");
const { normalizePhone } = require("../utils/phone");

async function getState(userPhone) {
  const key = normalizePhone(userPhone);
  const row = await prisma.conversationState
    .findUnique({ where: { userPhone: key } })
    .catch(() => null);
  if (!row) return null;
  return { lastIntent: row.lastIntent || null, slots: row.slots || {} };
}

function mergeSlots(oldSlots = {}, newSlots = {}) {
  // Jangan timpa nilai lama dengan null/undefined
  const merged = { ...oldSlots };
  for (const [k, v] of Object.entries(newSlots)) {
    if (v === null || v === undefined) continue;
    merged[k] = v;
  }
  return merged;
}

async function setState(userPhone, state) {
  const key = normalizePhone(userPhone);
  // baca state lama dulu untuk merge
  const existing = await prisma.conversationState
    .findUnique({ where: { userPhone: key } })
    .catch(() => null);
  const oldSlots = existing?.slots || {};
  const newSlots = state?.slots || {};

  const safeSlots = mergeSlots(oldSlots, newSlots); // <-- kunci anti "null overwrite"

  await prisma.conversationState.upsert({
    where: { userPhone: key },
    update: {
      lastIntent: state.lastIntent || existing?.lastIntent || null,
      slots: safeSlots,
    },
    create: {
      userPhone: key,
      lastIntent: state.lastIntent || null,
      slots: safeSlots,
    },
  });
}

async function clearState(userPhone) {
  const key = normalizePhone(userPhone);
  await prisma.conversationState
    .delete({ where: { userPhone: key } })
    .catch(() => null);
}

module.exports = { getState, setState, clearState };
