// src/services/logger.js
const prisma = require("../config/prisma");

async function logNlp({ userPhone, text, predicted, confidence, entities }) {
  try {
    await prisma.nlpLog.create({
      data: {
        userPhone,
        text: String(text || "").slice(0, 2000),
        predicted: predicted || "fallback",
        confidence: Number(confidence || 0),
        entities: entities || {},
      },
    });
  } catch (e) {
    // ignore
  }
}

module.exports = { logNlp };
