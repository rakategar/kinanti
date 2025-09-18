// src/nlp/pipeline.js
// Pipeline: normalize → entities → classify → dialog manage → log

const { normalize } = require("./normalizer");
const { extractEntities } = require("./entities");
const { classify } = require("./classifier");
const { dialogManage } = require("./dialogManager");
const { logNlp } = require("../services/logger");

async function nlpPipeline(message) {
  const userPhone = String(message.from || "").replace(/@c\.us$/i, "");
  const raw = message.body || "";

  const text = normalize(raw);
  const entities = extractEntities(text);
  const { intent, confidence, score } = classify(text, entities);

  // Dialog management (slot filling & routing) — kirim raw untuk lock wizard
  const dm = await dialogManage(userPhone, intent, entities, raw);

  // Logging (non-blocking)
  logNlp({
    userPhone,
    text: raw,
    predicted: intent,
    confidence,
    entities,
  }).catch(() => {});

  return {
    userPhone,
    textRaw: raw,
    textNormalized: text,
    intent,
    confidence,
    score,
    entities,
    dialog: dm,
  };
}

module.exports = { nlpPipeline };
