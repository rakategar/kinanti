// src/config/prisma.js
const { PrismaClient } = require("@prisma/client");

const globalForPrisma = globalThis; // aman untuk hot-reload dev

const prisma =
  globalForPrisma.__prisma__ ||
  new PrismaClient({
    // optional: log: ['query', 'error', 'warn']
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__prisma__ = prisma;
}

module.exports = prisma; // <<< ekspor instance langsung (BUKAN { prisma })
