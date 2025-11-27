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

  console.log("\n========== NLP PIPELINE START ==========");
  console.log("📥 RAW INPUT:", raw);

  const text = normalize(raw);
  console.log("🔄 NORMALIZED:", text);

  const entities = extractEntities(text);
  console.log("🏷️  ENTITIES:", JSON.stringify(entities, null, 2));

  const { intent, confidence, score } = classify(text, entities);
  console.log("🎯 CLASSIFIED:");
  console.log("   - Intent:", intent);
  console.log("   - Score:", score);
  console.log("   - Confidence:", confidence);

  // Dialog management (slot filling & routing) — kirim raw untuk lock wizard
  const dm = await dialogManage(userPhone, intent, entities, raw);
  console.log("💬 DIALOG MANAGER:");
  console.log("   - Done:", dm.done);
  console.log("   - Action:", dm.action);
  console.log("   - To:", dm.to);
  console.log("   - Slots:", JSON.stringify(dm.slots, null, 2));
  if (dm.message) console.log("   - Message:", dm.message);
  console.log("========== NLP PIPELINE END ==========\n");

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
